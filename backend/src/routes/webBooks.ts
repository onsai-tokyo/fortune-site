import { Router, type Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { BookError, BOOK_PRODUCT, bookRPC, bookSources, uuidPattern, validateBookQuestion } from '../lib/aiBooks.js'
import { questionLimiter } from './reading.js'
import { requireAIConsent } from '../middleware/aiConsent.js'
import { countAvailableBookCredits } from '../lib/webBookCredits.js'
import { publicBook as appPublicBook } from './aiBooks.js'
export const webBooksRouter = Router()
webBooksRouter.use(requireAuth)
const projection = 'id,source_id,title,target_title,theme,question,state,created_at,delivered_at,document,source_snapshot,metadata,funding_source'
const AI_CONSENT_VERSION = 'anthropic-inline-2026-10-11-v3'
export function bookQuestionMonthlyLimits() {
  return {
    user: Math.max(0, Number(process.env.PREMIUM_MONTHLY_QUESTION_LIMIT ?? 100)),
    global: Math.max(0, Number(process.env.AI_CHAT_MONTHLY_GLOBAL_LIMIT ?? 5000)),
  }
}
export function publicBook(b: Record<string, unknown>) {
  const used = Array.isArray(b.ai_book_questions) ? b.ai_book_questions.filter((q: {state: string; created_at: string}) => q.state === 'completed' || (q.state === 'generating' && Date.parse(q.created_at) > Date.now() - 600_000)).length : 0
  return {...appPublicBook(b),sourceId:b.source_id,questionsLeft:Math.max(0,2-used)}
}
function fail(res: Response,error: unknown) {
  const e = error instanceof BookError ? error : new BookError('BOOK_UNAVAILABLE',503,'本棚を取得できませんでした。時間をおいてお試しください。')
  res.status(e.status).json({code:e.code,error:e.message})
}
async function settings() {
  const {data,error} = await getSupabaseAdmin().from('ai_book_settings').select('enabled,monthly_credits').eq('id',true).single()
  if (error) throw error
  return data
}
webBooksRouter.get('/status',async(req:AuthRequest,res)=>{
  try {
    const config = await settings()
    if (!config.enabled) { res.json({enabled:false,monthlyCredits:config.monthly_credits,remaining:0,memberRemaining:0,purchasedRemaining:0,memberExpiresAt:null,productId:BOOK_PRODUCT}); return }
    const {data,error} = await getSupabaseAdmin().from('ai_book_grants').select('source,starts_at,expires_at,ai_book_credits(consumed_by,recovery_until)').eq('user_id',req.userId!).eq('revoked',false).eq('environment','Web').eq('source','web')
    if (error) throw error
    const credits = countAvailableBookCredits(data ?? [])
    res.json({enabled:true,monthlyCredits:config.monthly_credits,...credits,productId:BOOK_PRODUCT})
  } catch(e) { fail(res,e) }
})
webBooksRouter.get('/',async(req:AuthRequest,res)=>{
  try {
    const limit=60; const before=typeof req.query.before==='string'?req.query.before:null
    if(before && !uuidPattern.test(before)) throw new BookError('BOOK_INPUT',400,'ページ指定が正しくありません。')
    let query=getSupabaseAdmin().from('ai_books').select(`${projection},ai_book_questions(state,created_at)`).eq('user_id',req.userId!).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit+1)
    if(before) {
      const {data,error}=await getSupabaseAdmin().from('ai_books').select('id,created_at').eq('user_id',req.userId!).eq('id',before).single()
      if(error||!data) throw new BookError('BOOK_NOT_FOUND',404,'本が見つかりません。')
      query=query.or(`created_at.lt.${data.created_at},and(created_at.eq.${data.created_at},id.lt.${before})`)
    }
    const {data,error}=await query; if(error) throw error
    const rows=(data??[]).slice(0,limit)
    res.json({books:rows.map(publicBook),nextCursor:(data?.length??0)>limit?rows.at(-1)?.id:null})
  } catch(e) { fail(res,e) }
})
webBooksRouter.post('/operations/:id/cancel-unsubmitted',async(req:AuthRequest,res)=>{
  try {
    if(!uuidPattern.test(req.params.id)) throw new BookError('BOOK_INPUT',400,'受付番号が正しくありません。')
    const id=await bookRPC('ai_book_cancel_unsubmitted',{p_user:req.userId!,p_operation:req.params.id})
    if(!id) {res.json({book:null});return}
    const {data,error}=await getSupabaseAdmin().from('ai_books').select(projection).eq('user_id',req.userId!).eq('id',id).single()
    if(error) throw error; res.json({book:publicBook(data)})
  } catch(e) { fail(res,e) }
})
webBooksRouter.get('/operations/:id',async(req:AuthRequest,res)=>{
  try {
    if(!uuidPattern.test(req.params.id)) throw new BookError('BOOK_INPUT',400,'受付番号が正しくありません。')
    const {data,error}=await getSupabaseAdmin().from('ai_books').select(`${projection},ai_book_questions(state,created_at)`).eq('user_id',req.userId!).eq('operation_id',req.params.id).maybeSingle()
    if(error) throw error; res.json({book:data?publicBook(data):null})
  } catch(e) { fail(res,e) }
})
webBooksRouter.get('/:id',async(req:AuthRequest,res)=>{
  try {
    if(!uuidPattern.test(req.params.id)) throw new BookError('BOOK_INPUT',400,'本の指定が正しくありません。')
    const {data,error}=await getSupabaseAdmin().from('ai_books').select(`${projection},ai_book_questions(state,created_at)`).eq('user_id',req.userId!).eq('id',req.params.id).maybeSingle()
    if(error) throw error; if(!data) throw new BookError('BOOK_NOT_FOUND',404,'本が見つかりません。')
    res.json({book:publicBook(data)})
  } catch(e) { fail(res,e) }
})

function requireAiConsent(req: AuthRequest, res: Response): boolean {
  if (req.header('X-FateLab-AI-Consent') === AI_CONSENT_VERSION) return true
  res.status(428).json({ code: 'AI_CONSENT_REQUIRED', error: 'AIへの情報送信に同意してからお試しください。' })
  return false
}

function validateBookFollowup(value: unknown): string {
  if (typeof value !== 'string' || [...value.trim()].length < 1 || [...value].length > 1200) throw new BookError('BOOK_QUESTION_INPUT', 422, '質問を1〜1200文字で入力してください。')
  const question = value.normalize('NFKC').trim()
  if (/自殺|自傷|死にたい|消えたい|命を絶|生きていたくない|寿命|余命|妊娠|不妊|病気|診断|癌|がん|服薬|薬を|治療|訴訟|裁判|法律判断|投資|株価|銘柄|殺す|傷つける方法|監視|ストーキング/.test(question)) {
    throw new BookError('BOOK_QUESTION_POLICY', 422, '健康・妊娠・生死、法律や投資の判断、他者への加害や監視は扱えません。')
  }
  return question
}

async function bookQuestionRPC(name: string, args: Record<string, unknown>) {
  const { data, error } = await getSupabaseAdmin().rpc(name, args)
  if (error) {
    const message = error.message ?? ''
    if (message.includes('BOOK_QUESTION_LIMIT')) throw new BookError('BOOK_QUESTION_LIMIT', 409, 'このブックへの質問は2回までです。')
    if (message.includes('BOOK_QUESTION_OPERATION_CONFLICT')) throw new BookError('BOOK_QUESTION_OPERATION_CONFLICT', 409, '同じ操作IDで質問内容を変更できません。')
    if (message.includes('BOOK_NOT_FOUND')) throw new BookError('BOOK_NOT_FOUND', 404, 'ブックが見つかりません。')
    if (message.includes('AI_BOOK_MONTHLY_USER_LIMIT')) throw new BookError('AI_BOOK_MONTHLY_USER_LIMIT', 402, '今月のAI利用上限に達しました。')
    if (message.includes('AI_BOOK_MONTHLY_GLOBAL_LIMIT')) throw new BookError('AI_BOOK_MONTHLY_GLOBAL_LIMIT', 503, '今月のAI利用上限に達しました。時間をおいてお試しください。')
    throw error
  }
  return data as Record<string, unknown>
}

webBooksRouter.get('/:bookId/questions/operations/:operationId', async (req: AuthRequest, res) => {
  try {
    if (!uuidPattern.test(req.params.bookId) || !uuidPattern.test(req.params.operationId)) throw new BookError('BOOK_INPUT', 400, '操作番号が正しくありません。')
    const { data, error } = await getSupabaseAdmin().from('ai_book_questions').select('id,book_id,operation_id,question,answer,state,created_at').eq('user_id', req.userId!).eq('book_id', req.params.bookId).eq('operation_id', req.params.operationId).maybeSingle()
    if (error) throw error
    res.json({ question: data ?? null })
  } catch (e) { fail(res, e) }
})

webBooksRouter.post('/:bookId/questions', questionLimiter, async (req: AuthRequest, res) => {
  if (!requireAiConsent(req, res)) return
  let operationId: string | undefined
  let ownsOperation = false
  try {
    if (!uuidPattern.test(req.params.bookId) || !uuidPattern.test(req.body?.operationId ?? '')) throw new BookError('BOOK_INPUT', 422, '受付番号が必要です。')
    operationId = req.body.operationId
    const question = validateBookFollowup(req.body?.question)
    const monthlyLimits = bookQuestionMonthlyLimits()
    const started = await bookQuestionRPC('ai_book_question_begin', { p_user: req.userId!, p_book: req.params.bookId, p_operation: operationId, p_question: question, p_user_limit: monthlyLimits.user, p_global_limit: monthlyLimits.global })
    if (started.state === 'completed') { res.json({ operationId, state: 'completed', answer: started.answer ?? '' }); return }
    if (started.state !== 'generating') throw new BookError('BOOK_QUESTION_UNAVAILABLE', 503, '質問を開始できませんでした。')
    if (started.created !== true) { res.status(409).json({operationId,state:'generating',code:'BOOK_QUESTION_PENDING',error:'この質問は処理中です。少し待ってから状態を確認してください。'}); return }
    ownsOperation = true

    const { data: book, error } = await getSupabaseAdmin().from('ai_books').select('title,question,document,source_snapshot').eq('id', req.params.bookId).eq('user_id', req.userId!).eq('state', 'delivered').single()
    if (error || !book) throw new BookError('BOOK_NOT_FOUND', 404, 'ブックが見つかりません。')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 0 })
    const prompt = `相談のブック「${String(book.title).slice(0, 100)}」について、読者から追加質問が届きました。\n\n元の相談:\n${String(book.question).slice(0, 800)}\n\nブック本文:\n${JSON.stringify(book.document).slice(0, 12000)}\n\n根拠となった読みもの:\n${JSON.stringify(book.source_snapshot).slice(0, 12000)}\n\n追加質問:\n${question}\n\nブック本文と根拠の範囲だけで、断定や予言を避け、具体的で穏当な日本語で答えてください。医療・法律・投資・生死・加害に関する判断は行わず、必要なら専門家への相談を勧めてください。`
    const message = await client.beta.promptCaching.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, system: [{ type: 'text', text: 'あなたはFATE LABの相談ブック補足案内です。安全対策と本文の根拠を守ります。', cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: prompt }] })
    const answer = message.content.filter(item => item.type === 'text').map(item => item.text).join('').trim()
    if (!answer) throw new Error('EMPTY_BOOK_ANSWER')
    const completed = await bookQuestionRPC('ai_book_question_complete', { p_user: req.userId!, p_operation: operationId, p_answer: answer })
    if (completed.state !== 'completed') throw new BookError('BOOK_QUESTION_FAILED', 409, 'この質問は完了しませんでした。状態を確認してから再度お試しください。')
    res.json({ operationId, state: 'completed', answer: completed.answer ?? answer })
  } catch (e) {
    if (operationId && ownsOperation) { try { await bookQuestionRPC('ai_book_question_fail', { p_user: req.userId!, p_operation: operationId }) } catch { /* preserve unknown result for status recovery */ } }
    fail(res, e)
  }
})
async function prepare(req:AuthRequest) {
  const question=validateBookQuestion(req.body?.question,req.body?.theme)
  if(!uuidPattern.test(req.body?.sourceId??'')) throw new BookError('BOOK_INPUT',422,'もとになる鑑定書を選んでください。')
  const {data,error}=await getSupabaseAdmin().from('reading_conversations').select('id,title,kind,report_text,calculated_data').eq('user_id',req.userId!).eq('id',req.body.sourceId).maybeSingle()
  if(error) throw error
  if(!data || data.kind==='chat') throw new BookError('BOOK_SOURCE',422,'保存済みの自己鑑定または相性鑑定を選んでください。')
  const sources=bookSources(data,req.body.theme)
  if(sources.length<3) throw new BookError('BOOK_SOURCE',422,'この鑑定書には必要な原稿が揃っていません。別の鑑定書を選んでください。')
  return {question,sources,row:data}
}
webBooksRouter.post('/validate',async(req:AuthRequest,res)=>{
  try { if(!(await settings()).enabled) throw new BookError('BOOK_DISABLED',503,'AI鑑定書は準備中です。'); await prepare(req); res.json({valid:true}) } catch(e) {fail(res,e)}
})
webBooksRouter.post('/',requireAIConsent,async(req:AuthRequest,res)=>{
  try {
    if(!uuidPattern.test(req.body?.operationId??'')) throw new BookError('BOOK_INPUT',422,'受付番号が必要です。')
    // Read retries before source lookup: source deletion must not strand an accepted order.
    const {data:old,error}=await getSupabaseAdmin().from('ai_books').select('id,title,target_title,theme,question,state,created_at,delivered_at,document,source_snapshot,source_id').eq('user_id',req.userId!).eq('operation_id',req.body.operationId).maybeSingle()
    if(error) throw error
    if(old) {
      if(old.source_id!==String(req.body.sourceId).toLowerCase() || old.theme!==req.body.theme || old.question!==String(req.body.question).trim()) throw new BookError('BOOK_OPERATION_CONFLICT',409,'受付済みの相談と内容が異なります。')
      res.json({book:publicBook(old)}); return
    }
    const {question,sources,row}=await prepare(req)
    await bookRPC('ai_book_sync_member',{p_user:req.userId!})
    const id=await bookRPC('ai_book_order_web',{p_user:req.userId!,p_operation:req.body.operationId,p_source:row.id,p_target:row.title,p_theme:req.body.theme,p_question:question,p_snapshot:sources})
    const result=await getSupabaseAdmin().from('ai_books').select(projection).eq('user_id',req.userId!).eq('id',id).single()
    if(result.error) throw result.error
    res.status(201).json({book:publicBook(result.data)})
  } catch(e) {fail(res,e)}
})

