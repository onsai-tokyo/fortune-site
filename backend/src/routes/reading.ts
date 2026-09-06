import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import rateLimit from 'express-rate-limit'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { revokeAppleToken } from '../lib/appleSignIn.js'
import { getSupabaseUser } from '../lib/supabaseUser.js'
import { validateConversationTitle, validateReadingQuestion } from '../lib/readingValidation.js'
import { buildPublicReadingShare } from '../lib/readingShare.js'
import { hasPremiumAccess, PremiumAccessUnavailable } from '../lib/premium.js'
import { buildStructuredReport } from '../lib/reportCards.js'
import { StreamingAnswerParser } from '../lib/sseAnswerParser.js'
import { buildAnswerSystemPrompt } from '../lib/report/answerPrompt.js'
import { randomUUID } from 'node:crypto'
import { questionRPC, QuestionDependencyError } from '../lib/questionOperation.js'
import { storedReportFromCalculatedData } from '../lib/report/storedReport.js'
import { buildChartSections } from '../lib/report/chartSections.js'
import { correlationId } from '../lib/apiError.js'
import { chatReadingTitle, compatibilityReadingTitle, personalReadingTitle } from '../lib/conversationTitle.js'

import { readingSnapshot, saveReadingSnapshot, ReadingSaveError } from '../lib/readingRevision.js'

export const readingRouter = Router()
const FREE_QUESTION_LIMIT = Math.max(0, Number(process.env.FREE_QUESTION_LIMIT ?? 2))
const PREMIUM_MONTHLY_QUESTION_LIMIT = Math.max(0, Number(process.env.PREMIUM_MONTHLY_QUESTION_LIMIT ?? 100))
const AI_CHAT_MONTHLY_GLOBAL_LIMIT = Math.max(0, Number(process.env.AI_CHAT_MONTHLY_GLOBAL_LIMIT ?? 5000))
const questionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Math.max(1, Number(process.env.READING_QUESTION_RATE_LIMIT ?? 6)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).userId!,
  message: { error: '短時間に質問が続いています。少し待ってから再度お試しください。' },
})

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 0, fetch: globalThis.fetch as unknown as NonNullable<ConstructorParameters<typeof Anthropic>[0]>['fetch'] })
}

// 共有ページは出生情報や鑑定書本文を返さず、明示的に作成された要点だけを返す。
readingRouter.get('/shares/:shareId', async (req, res) => {
  const { data, error } = await getSupabaseAdmin().from('reading_shares')
    .select('share_id,summary,created_at').eq('share_id', req.params.shareId).eq('is_active', true).maybeSingle()
  if (error) { res.status(500).json({ error: '共有ページを取得できませんでした' }); return }
  if (!data) { res.status(404).json({ error: '共有ページが見つかりません' }); return }
  res.json({ share: data })
})

readingRouter.get('/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const db = getSupabaseUser(req.accessToken!)
    const [{ data: usage, error: usageError }, premium, { count: approvedCount, error: approvedError }, { data: latestConversations, error: latestError }] = await Promise.all([
      db.from('reading_usage').select('free_questions_used').eq('user_id', req.userId!).maybeSingle(),
      hasPremiumAccess(req.userId!),
      db.from('profile_traits').select('id', { count: 'exact', head: true }).eq('user_id', req.userId!).eq('status', 'approved'),
      db.from('reading_conversations').select('id').eq('user_id', req.userId!)
        .or('kind.is.null,kind.eq.personal,kind.eq.self')
        .order('updated_at', { ascending: false }).limit(1),
    ])
    if (latestError || usageError || approvedError) throw new PremiumAccessUnavailable()
    const used = usage?.free_questions_used ?? 0
    const latestConversationId = latestConversations?.[0]?.id ?? null
    res.json({ premium, isPremium: premium, used, limit: FREE_QUESTION_LIMIT, remaining: premium ? null : Math.max(0, FREE_QUESTION_LIMIT - used), approvedCount: approvedCount ?? 0, hasReading: Boolean(latestConversationId), latestConversationId })
  } catch (error) {
    console.error('Reading status failed:', error)
    res.status(503).json({ code: 'DEPENDENCY_NOT_READY', retryable: true, error: '利用状況を確認できませんでした' })
  }
})

readingRouter.get('/profile/traits', requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await getSupabaseUser(req.accessToken!).from('profile_traits')
    .select('id,reading_id,conversation_id,category,text,status,created_at,approved_at')
    .eq('user_id', req.userId!).eq('status', 'approved').order('approved_at', { ascending: false }).limit(300)
  if (error) { res.status(500).json({ error: 'プロフィールを取得できませんでした' }); return }
  res.json({ traits: data ?? [] })
})

readingRouter.delete('/account', requireAuth, async (req: AuthRequest, res) => {
  try {
    const admin = getSupabaseAdmin()
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(req.userId!)
    if (userError) throw userError
    const usesApple = userResult.user?.identities?.some(identity => identity.provider === 'apple') ?? false
    if (usesApple) {
      try {
        const { data: stored, error: tokenError } = await admin.from('apple_sign_in_tokens')
          .select('refresh_token').eq('user_id', req.userId!).maybeSingle()
        if (tokenError) throw tokenError
        if (stored?.refresh_token) await revokeAppleToken(stored.refresh_token)
        else console.warn('Apple token revoke skipped: refresh token missing', { userId: req.userId })
      } catch (revokeError) {
        // Apple availability or configuration must never prevent local account deletion.
        console.error('Apple token revoke failed; continuing account deletion', {
          userId: req.userId,
          errorName: revokeError instanceof Error ? revokeError.name : 'UnknownError',
          errorMessage: revokeError instanceof Error ? revokeError.message : String(revokeError),
        })
      }
    }
    const { error } = await admin.auth.admin.deleteUser(req.userId!)
    if (error) throw error
    res.status(204).end()
  } catch (error) {
    console.error('Delete account failed:', error)
    res.status(500).json({ error: 'アカウントを削除できませんでした' })
  }
})

readingRouter.patch('/profile/traits/:id', requireAuth, async (req: AuthRequest, res) => {
  const status = req.body?.status
  if (!['approved', 'rejected'].includes(status)) { res.status(400).json({ error: '回答を選んでください' }); return }
  const db = getSupabaseUser(req.accessToken!)
  const { data, error } = await db.from('profile_traits').update({
    status, approved_at: status === 'approved' ? new Date().toISOString() : null,
  }).eq('id', req.params.id).eq('user_id', req.userId!).select('id,status,approved_at').maybeSingle()
  if (error) { res.status(500).json({ error: '回答を保存できませんでした' }); return }
  if (!data) { res.status(404).json({ error: '確認項目が見つかりません' }); return }
  const { count } = await db.from('profile_traits').select('id', { count: 'exact', head: true })
    .eq('user_id', req.userId!).eq('status', 'approved')
  res.json({ trait: data, approvedCount: count ?? 0 })
})

readingRouter.delete('/profile/traits/:id', requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await getSupabaseUser(req.accessToken!).from('profile_traits').delete()
    .eq('id', req.params.id).eq('user_id', req.userId!).eq('status', 'approved').select('id').maybeSingle()
  if (error) { res.status(500).json({ error: '項目を削除できませんでした' }); return }
  if (!data) { res.status(404).json({ error: '項目が見つかりません' }); return }
  res.status(204).end()
})

readingRouter.post('/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const payload = readingSnapshot(req.body as Record<string,unknown>)
    const result = await saveReadingSnapshot(req.accessToken!, payload, personalReadingTitle(), req.header('Idempotency-Key'))
    res.status(result.reused ? 200 : 201).json(result)
  } catch (error) {
    const failure = error instanceof ReadingSaveError ? error : new ReadingSaveError(503,'DEPENDENCY_NOT_READY')
    res.status(failure.status).json({code:failure.code,error:failure.status===409 ? '同じ保存操作に異なる鑑定データが送信されました' : '鑑定履歴を保存できませんでした',retryable:failure.status===503})
  }
})

readingRouter.get('/conversations', requireAuth, async (req: AuthRequest, res) => {
  const db = getSupabaseUser(req.accessToken!)
  const primary = await db.from('reading_conversations')
    .select('id,secret_token,title,kind,is_saved,partner_profile_id,birth_data,source_section,source_year,created_at,updated_at,reading_revision_id,reading_revisions(reading_id),reading_messages(count)')
    .eq('user_id', req.userId!).order('updated_at', { ascending: false }).order('is_saved', { ascending: false }).limit(100)
  if (!primary.error) {
    const seen = new Set<string>()
    const conversations = (primary.data ?? []).filter(item => {
      if (item.kind === 'chat') return true
      const relation = item.reading_revisions as unknown as {reading_id?:string}|null
      const key = relation?.reading_id ?? item.id
      if (seen.has(key)) return false
      seen.add(key); return true
    }).map(item => {
      if (item.kind !== 'compatibility') return item
      const birth = item.birth_data as { self?: { nickname?: unknown }, partner?: { displayName?: unknown } } | null
      return { ...item, title: compatibilityReadingTitle(birth?.self?.nickname, birth?.partner?.displayName) }
    })
    res.json({ conversations }); return
  }
  if (!['42703', 'PGRST204'].includes(primary.error.code ?? '')) {
    res.status(500).json({ error: '鑑定履歴を取得できませんでした' }); return
  }
  // DB migrationとアプリ配信の短いずれでも一覧自体は利用可能にする。
  const legacy = await db.from('reading_conversations')
    .select('id,secret_token,title,kind,source_section,source_year,created_at,updated_at,reading_messages(count)')
    .eq('user_id', req.userId!).order('updated_at', { ascending: false }).limit(100)
  if (legacy.error) { res.status(500).json({ error: '鑑定履歴を取得できませんでした' }); return }
  res.json({ conversations: (legacy.data ?? []).map(item => ({ ...item, is_saved: false })) })
})

readingRouter.post('/conversations/:id/chat', requireAuth, async (req: AuthRequest, res) => {
  try {
    const operationId=req.header('Idempotency-Key')
    if(!operationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
      res.status(400).json({code:'OPERATION_ID_REQUIRED',error:'アプリを更新してから再試行してください'});return
    }
    const checked=validateReadingQuestion(req.body?.question)
    if(!checked.ok) {res.status(checked.status).json({error:checked.error});return}
    const {data,error}=await getSupabaseUser(req.accessToken!).rpc('create_reading_chat', {
      p_op:operationId,p_source:req.params.id,p_question:checked.value,p_title:chatReadingTitle(checked.value),
    })
    if(error) throw error
    if(data?.state==='conflict') {res.status(409).json({code:'OPERATION_PAYLOAD_CONFLICT',error:'同じ操作に異なる質問が指定されました'});return}
    if(data?.state==='deleted') {res.status(410).json({code:'CHAT_DELETED',error:'この対話は削除されています'});return}
    if(data?.state==='not_found') {res.status(404).json({error:'もとの鑑定書が見つかりません'});return}
    if(data?.state!=='completed' || typeof data.id!=='string' || typeof data.reused!=='boolean') throw new Error('Invalid chat acknowledgement')
    res.status(data.reused?200:201).json({id:data.id,reused:data.reused})
  } catch (error) {
    console.error('Create chat operation failed:',{correlationId:correlationId(req),sourceId:req.params.id,error})
    res.status(503).json({code:'DEPENDENCY_NOT_READY',error:'対話の保存状況を確認できませんでした。時間をおいて再試行してください'})
  }
})

readingRouter.get('/conversations/:id', requireAuth, async (req: AuthRequest, res) => {
  const db = getSupabaseUser(req.accessToken!)
  const { data: conversation } = await db.from('reading_conversations')
    .select('id,secret_token,title,kind,is_saved,partner_profile_id,birth_data,report_text,source_section,source_year,created_at,updated_at')
    .eq('id', req.params.id).eq('user_id', req.userId!).maybeSingle()
  if (!conversation) { res.status(404).json({ error: '鑑定履歴が見つかりません' }); return }
  const { data: messages } = await db.from('reading_messages').select('id,role,content,referenced_systems,created_at')
    .eq('conversation_id', conversation.id).eq('user_id', req.userId!).order('created_at')
  const { data: traits } = await db.from('profile_traits').select('id,source_message_id,category,text,status,created_at')
    .eq('conversation_id', conversation.id).eq('user_id', req.userId!).order('created_at')
  res.json({ conversation, messages: messages ?? [], traits: traits ?? [] })
})

readingRouter.get('/:id/cards', requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await getSupabaseUser(req.accessToken!).from('reading_conversations')
    .select('report_text,calculated_data,birth_data,kind,updated_at').eq('id', req.params.id).eq('user_id', req.userId!).maybeSingle()
  if (error) { res.status(500).json({ error: 'カードを取得できませんでした' }); return }
  if (!data) { res.status(404).json({ error: '鑑定履歴が見つかりません' }); return }
  const etag = `W/"${req.params.id}-${data.updated_at}"`
  res.setHeader('ETag', etag)
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
  if (req.headers['if-none-match'] === etag) { res.status(304).end(); return }
  const report = storedReportFromCalculatedData(data.calculated_data) ?? buildStructuredReport(data.report_text)
  const birth = data.birth_data as { _sourceKind?: string } | null
  const expectedScope = data.kind === 'compatibility' || birth?._sourceKind === 'compatibility' ? 'couple' : 'self'
  const cards = report.cards
    .filter(card => card.tab !== 'chart' && card.kind !== 'chart')
    .filter(card => !card.scope || card.scope === expectedScope)
    .map(card => ({ ...card, scope: card.scope ?? expectedScope }))
  res.json({ ...report, cards, chartSections: report.chartSections ?? buildChartSections(data.calculated_data) })
})

readingRouter.get('/reports/:token', requireAuth, async (req: AuthRequest, res) => {
  const db = getSupabaseUser(req.accessToken!)
  const { data: conversation } = await db.from('reading_conversations').select('*')
    .eq('secret_token', req.params.token).eq('user_id', req.userId!).maybeSingle()
  if (!conversation) { res.status(404).json({ error: '鑑定書が見つかりません' }); return }
  const { data: messages } = await db.from('reading_messages').select('id,role,content,referenced_systems,created_at')
    .eq('conversation_id', conversation.id).eq('user_id', req.userId!).order('created_at')
  const { data: traits } = await db.from('profile_traits').select('id,source_message_id,category,text,status,created_at')
    .eq('conversation_id', conversation.id).eq('user_id', req.userId!).order('created_at')
  res.json({ conversation, messages: messages ?? [], traits: traits ?? [] })
})

readingRouter.post('/reports/:token/share', requireAuth, async (req: AuthRequest, res) => {
  const db = getSupabaseUser(req.accessToken!)
  const { data: conversation } = await db.from('reading_conversations').select('*')
    .eq('secret_token', req.params.token).eq('user_id', req.userId!).maybeSingle()
  if (!conversation) { res.status(404).json({ error: '鑑定書が見つかりません' }); return }
  const summary = buildPublicReadingShare(conversation)
  const { data, error } = await db.from('reading_shares').upsert({
    conversation_id: conversation.id, user_id: req.userId, summary, is_active: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'conversation_id' }).select('share_id').single()
  if (error) { res.status(500).json({ error: '共有リンクを作成できませんでした' }); return }
  res.json({ shareId: data.share_id })
})

readingRouter.delete('/reports/:token/share', requireAuth, async (req: AuthRequest, res) => {
  const db = getSupabaseUser(req.accessToken!)
  const { data: conversation } = await db.from('reading_conversations').select('id')
    .eq('secret_token', req.params.token).eq('user_id', req.userId!).maybeSingle()
  if (!conversation) { res.status(404).json({ error: '鑑定書が見つかりません' }); return }
  const { error } = await db.from('reading_shares').update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('conversation_id', conversation.id).eq('user_id', req.userId!)
  if (error) { res.status(500).json({ error: '共有を停止できませんでした' }); return }
  res.status(204).end()
})

readingRouter.patch('/conversations/:id', requireAuth, async (req: AuthRequest, res) => {
  const title = validateConversationTitle(req.body?.title)
  if (!title) { res.status(400).json({ error: '鑑定履歴の名前を入力してください' }); return }
  const { data, error } = await getSupabaseUser(req.accessToken!).from('reading_conversations').update({ title, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('user_id', req.userId!).select('id,title,updated_at').maybeSingle()
  if (error) { res.status(500).json({ error: '鑑定履歴の名前を変更できませんでした' }); return }
  if (!data) { res.status(404).json({ error: '鑑定履歴が見つかりません' }); return }
  res.json({ conversation: data })
})

readingRouter.patch('/conversations/:id/saved', requireAuth, async (req: AuthRequest, res) => {
  if (typeof req.body?.isSaved !== 'boolean') { res.status(400).json({ error: '保存状態が正しくありません' }); return }
  const { data, error } = await getSupabaseUser(req.accessToken!).from('reading_conversations')
    .update({ is_saved: req.body.isSaved })
    .eq('id', req.params.id).eq('user_id', req.userId!).select('id,is_saved').maybeSingle()
  if (error) { res.status(500).json({ error: '鑑定を保存できませんでした' }); return }
  if (!data) { res.status(404).json({ error: '鑑定履歴が見つかりません' }); return }
  res.json({ conversation: data })
})

readingRouter.delete('/conversations/:id', requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await getSupabaseUser(req.accessToken!).from('reading_conversations').delete()
    .eq('id', req.params.id).eq('user_id', req.userId!).select('id').maybeSingle()
  if (error) { res.status(500).json({ error: '鑑定履歴を削除できませんでした' }); return }
  if (!data) { res.status(404).json({ error: '鑑定履歴が見つかりません' }); return }
  res.status(204).end()
})

// Status lookup also expires abandoned workers. Only the authenticated owner's
// operation in this conversation may be reconciled; no result is inferred locally.
readingRouter.get('/conversations/:id/questions/:opId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {data,error}=await getSupabaseAdmin().from('reading_question_operations').select('op_id')
      .eq('user_id',req.userId!).eq('target_conversation_id',req.params.id).eq('op_id',req.params.opId).maybeSingle()
    if(error) throw new QuestionDependencyError('Status unavailable')
    if(!data) {res.json({state:'not_found'});return}
    res.json(await questionRPC('fail_reading_question',{p_user:req.userId,p_op:req.params.opId,p_worker:null,p_expired_only:true}))
  } catch {res.status(503).json({code:'DEPENDENCY_NOT_READY',error:'質問の保存状況を確認できませんでした'})}
})

readingRouter.post('/conversations/:id/questions', requireAuth, questionLimiter, async (req: AuthRequest, res) => {
  const db = getSupabaseUser(req.accessToken!)
  const operationId = req.header('Idempotency-Key')
  const workerId = randomUUID()
  let started = false
  // True before the complete RPC: an uncertain response must never cause a refund.
  let completionAttempted = false
  try {
    if (!operationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
      res.status(400).json({code:'OPERATION_ID_REQUIRED',error:'アプリを更新してから再試行してください'});return
    }
    const checkedQuestion = validateReadingQuestion(req.body?.question)
    if (!checkedQuestion.ok) { res.status(checkedQuestion.status).json({ error: checkedQuestion.error }); return }
    const question = checkedQuestion.value
    const { data: conversation } = await db.from('reading_conversations').select('*')
      .eq('id', req.params.id).eq('user_id', req.userId!).maybeSingle()
    if (!conversation) {
      console.warn('Reading conversation lookup miss', {
        correlationId: correlationId(req),
        conversationId: req.params.id,
        route: 'questions',
      })
      res.status(404).json({ error: '鑑定履歴が見つかりません' }); return
    }

    const premium = await hasPremiumAccess(req.userId!)
    const operation = await questionRPC('begin_reading_question', {
      p_user:req.userId,p_op:operationId,p_conversation:conversation.id,p_question:question,p_worker:workerId,
      p_free_limit:premium ? null : FREE_QUESTION_LIMIT,
      p_user_limit:premium ? PREMIUM_MONTHLY_QUESTION_LIMIT : FREE_QUESTION_LIMIT,p_global_limit:AI_CHAT_MONTHLY_GLOBAL_LIMIT,
    })
    if (operation.state==='completed') {
      res.setHeader('Content-Type','text/event-stream')
      res.setHeader('Cache-Control','private, no-store')
      res.write(`data: ${JSON.stringify({delta:{text:operation.result!.answer}})}\n\n`)
      res.write(`data: ${JSON.stringify({meta:{...operation.result,operationId}})}\n\n`)
      res.end('data: [DONE]\n\n');return
    }
    if (operation.state!=='started') {
      const code=operation.code ?? (operation.state==='conflict' ? 'OPERATION_PAYLOAD_CONFLICT' : operation.state==='pending'||operation.state==='busy' ? 'QUESTION_PENDING' : 'QUESTION_FAILED')
      const status=code==='FREE_LIMIT_REACHED'||code==='MONTHLY_QUESTION_LIMIT_REACHED' ? 402 : code==='AI_MONTHLY_BUDGET_REACHED' ? 503 : operation.state==='not_found' ? 404 : operation.state==='deleted' ? 410 : 409
      res.status(status).json({state:operation.state,code,error:code==='QUESTION_PENDING'?'前の質問を処理中です。少し待ってから確認してください':'質問を開始できませんでした'});return
    }
    started = true

    const { data: prior, error: priorError } = await db.from('reading_messages').select('role,content,created_at')
      .eq('conversation_id', conversation.id).eq('user_id', req.userId!).order('created_at', { ascending: false }).limit(20)
    if (priorError) throw priorError
    const system = buildAnswerSystemPrompt(conversation)

    const history = [...(prior ?? [])].reverse().map(item => ({ role: item.role as 'user' | 'assistant', content: String(item.content).slice(0, 2500) }))
    history.push({ role: 'user', content: question })
    while (history[0]?.role === 'assistant') history.shift()

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()
    const parser = new StreamingAnswerParser()
    let disconnected = false
    let stopReason: string | null = null
    const stream = getClient().beta.promptCaching.messages.stream({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: history,
    })
    res.once('close', () => {
      if (!res.writableEnded) { disconnected = true; stream.abort() }
    })
    for await (const event of stream) {
      if (disconnected) throw new Error('Client disconnected')
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const safeText = parser.push(event.delta.text)
        if (safeText) res.write(`data: ${JSON.stringify({ delta: { text: safeText } })}\n\n`)
      }
      if (event.type === 'message_delta') stopReason = event.delta.stop_reason
    }
    if (stopReason !== 'end_turn') {
      console.warn('Reading answer truncated', { correlationId: correlationId(req), stopReason })
      throw new Error('Reading answer did not finish normally')
    }
    const { answer, suggestions, finalDelta } = parser.finish()
    if (!answer.trim()) throw new Error('Empty reading answer')
    if (finalDelta) res.write(`data: ${JSON.stringify({ delta: { text: finalDelta } })}\n\n`)
    const systems = [...new Set((answer.match(/四柱推命|算命学|紫微斗数|西洋占星術|インド占星術|宿曜|九星気学|数秘術|納音/g) ?? []))]
    if (disconnected || res.destroyed) throw new Error('Client disconnected before save')
    completionAttempted = true
    const completed = await questionRPC('complete_reading_question', {
      p_user:req.userId,p_op:operationId,p_worker:workerId,p_answer:answer,p_systems:systems,p_suggestions:suggestions,
    })
    if (completed.state!=='completed') throw new QuestionDependencyError('Completion not acknowledged')
    // No profile-trait extraction: questions do not create personal supplementation.
    res.write(`data: ${JSON.stringify({meta:{referencedSystems:systems,suggestions,operationId,answerId:completed.result!.answerId}})}\n\n`)
    res.write('data: [DONE]\n\n'); res.end()
  } catch (error) {
    if (started && !completionAttempted) {
      try { await questionRPC('fail_reading_question',{p_user:req.userId,p_op:operationId,p_worker:workerId,p_expired_only:false}) }
      catch { /* Leave a durable pending operation for lease-expiry reconciliation. */ }
    }
    console.error('Reading question failed:', {userId:req.userId,conversationId:req.params.id,operationId,completionAttempted,error})
    if (res.destroyed || res.writableEnded) return
    if (!res.headersSent && (error instanceof PremiumAccessUnavailable || error instanceof QuestionDependencyError)) res.status(503).json({ code: 'DEPENDENCY_NOT_READY', retryable: true, error: '質問の受付・保存状況を確認できませんでした。時間をおいて再試行してください。' })
    else if (!res.headersSent) res.status(500).json({ error: '読み解きを続けられませんでした。時間をおいて再度お試しください。' })
    else { res.write(`data: ${JSON.stringify({ error: '読み解きを続けられませんでした' })}\n\n`); res.write('data: [DONE]\n\n'); res.end() }
  }
})
