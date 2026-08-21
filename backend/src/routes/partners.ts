import { Router, type NextFunction, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { assertPartnerCapacity, MAX_PARTNER_PROFILES, validatePartnerProfile } from '../lib/partnerProfiles.js'
import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { calcShichu, calcNayin, calcSanmei, getSukuyo, calcLifePathNumber } from './calc.js'
import type { ReportCard, StructuredReport } from '../lib/reportCards.js'
import { correlationId, sendApiError } from '../lib/apiError.js'
import { requirePoints } from '../middleware/points.js'

export const partnersRouter = Router()
partnersRouter.use(requireAuth)

partnersRouter.get('/', async (req: AuthRequest, res) => {
  const { data, error } = await getSupabaseAdmin().from('partner_profiles').select('*').eq('user_id', req.userId!).order('created_at')
  if (error) { res.status(500).json({ error: '相手一覧を取得できませんでした' }); return }
  res.json({ partners: data ?? [], limit: MAX_PARTNER_PROFILES, remaining: Math.max(0, MAX_PARTNER_PROFILES - (data?.length ?? 0)) })
})

partnersRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const db = getSupabaseAdmin()
    const { count, error: countError } = await db.from('partner_profiles').select('id', { count: 'exact', head: true }).eq('user_id', req.userId!)
    if (countError) throw countError
    assertPartnerCapacity(count ?? 0)
    const profile = validatePartnerProfile(req.body as Record<string, unknown>)
    const { data, error } = await db.from('partner_profiles').insert({ user_id: req.userId, ...profile }).select('*').single()
    if (error) {
      if (error.message.includes('partner_profile_limit')) { res.status(409).json({ error: `登録できる相手は${MAX_PARTNER_PROFILES}人までです` }); return }
      throw error
    }
    res.status(201).json({ partner: data, remaining: Math.max(0, MAX_PARTNER_PROFILES - (count ?? 0) - 1) })
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500
    res.status(status).json({ error: error instanceof Error ? error.message : '相手を登録できませんでした' })
  }
})

partnersRouter.delete('/:id', async (req: AuthRequest, res) => {
  const { error } = await getSupabaseAdmin().from('partner_profiles').delete().eq('id', req.params.id).eq('user_id', req.userId!)
  if (error) { res.status(500).json({ error: '相手を削除できませんでした' }); return }
  res.status(204).end()
})

export function parseCompatibility(raw: string): StructuredReport {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('相性カードJSONが見つかりません')
  const cleaned = unfenced.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1')
  const value = JSON.parse(cleaned) as { cards?: ReportCard[] }
  if (!Array.isArray(value.cards) || value.cards.length < 3) throw new Error('相性カードが不足しています')
  for (const card of value.cards) {
    if (!card.title || /^恋愛|友人|相性$/.test(card.title) || !Array.isArray(card.pages) || card.pages.length < 8 || card.pages.length > 12) throw new Error('相性カード形式が不正です')
    if (card.pages.some(page => !page.text || [...page.text].length > 120)) throw new Error('相性カード本文が不正です')
  }
  return { version: 2, cards: value.cards, reportText: value.cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n'), generator: 'ai' }
}

type CompatibilityGeneration = { text: string; stopReason?: string | null }
type CompatibilityCardSpec = { id: string; purpose: string; titleDirection: string }
export type CompatibilityCardCache = {
  read: (spec: CompatibilityCardSpec) => Promise<ReportCard | null>
  write: (spec: CompatibilityCardSpec, card: ReportCard) => Promise<void>
}

const compatibilityCardSpecs: CompatibilityCardSpec[] = [
  { id: 'compat-attraction', purpose: '引き合う力', titleDirection: '二人が自然に惹かれ合う理由を表す断定文' },
  { id: 'compat-friction', purpose: '衝突するとき', titleDirection: 'すれ違いが生まれる条件を表す断定文' },
  { id: 'compat-growth', purpose: '関係を育てる方法', titleDirection: '二人の関係を育てる具体的な鍵を表す断定文' },
]

function extractJsonObject(raw: string): Record<string, unknown> {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('相性カードJSONが見つかりません')
  return JSON.parse(unfenced.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1')) as Record<string, unknown>
}

export function parseCompatibilityCard(raw: string, minimumPages = 8): ReportCard {
  const value = extractJsonObject(raw)
  const card = (value.card ?? (Array.isArray(value.cards) ? value.cards[0] : undefined)) as ReportCard | undefined
  if (!card?.title || /^恋愛|友人|相性$/.test(card.title) || !Array.isArray(card.pages) || card.pages.length < minimumPages || card.pages.length > 12) {
    throw new Error('相性カード形式が不正です')
  }
  if (card.pages.some(page => !page.text || [...page.text].length > 120)) throw new Error('相性カード本文が不正です')
  return card
}

function validateCompatibilityCard(card: ReportCard | null, spec: CompatibilityCardSpec): ReportCard | null {
  if (!card || card.id !== spec.id) return null
  try {
    return { ...parseCompatibilityCard(JSON.stringify({ card }), 6), id: spec.id }
  } catch {
    return null
  }
}

function compatibilityFailureKind(error: unknown, stopReason?: string | null) {
  if (stopReason === 'max_tokens') return 'truncated'
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof SyntaxError || /JSON|見つかりません/.test(message)) return 'syntax'
  return 'validation'
}

function assembleCompatibilityReport(cards: ReportCard[]): StructuredReport {
  return {
    version: 2,
    cards,
    reportText: cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n'),
    generator: 'ai',
  }
}

export async function generateCompatibilityCards(
  basePrompt: string,
  generate: (prompt: string, spec: CompatibilityCardSpec, attempt: number) => Promise<CompatibilityGeneration>,
  onCardComplete?: (completed: number, total: number) => void,
  cache?: CompatibilityCardCache,
): Promise<StructuredReport> {
  let completed = 0
  const results = await Promise.all(compatibilityCardSpecs.map(async spec => {
    if (cache) {
      try {
        const cached = validateCompatibilityCard(await cache.read(spec), spec)
        if (cached) return cached
      } catch (error) {
        console.warn('Compatibility card cache read failed', { cardId: spec.id, reason: error instanceof Error ? error.message : String(error) })
      }
    }
    const prompt = `${basePrompt}\n今回生成するカード: ${spec.purpose}\nID: ${spec.id}\nタイトル方針: ${spec.titleDirection}\n形式は {"card":{...}}。カードは1枚だけ、ページは8〜12枚。JSON以外を返さないでください。`
    let first: CompatibilityGeneration
    try {
      first = await generate(prompt, spec, 1)
      if (first.stopReason !== 'max_tokens') {
        const card = { ...parseCompatibilityCard(first.text, 8), id: spec.id }
        if (cache) await cache.write(spec, card).catch(error => console.warn('Compatibility card cache write failed', { cardId: spec.id, reason: error instanceof Error ? error.message : String(error) }))
        return card
      }
      console.warn('Compatibility card initial generation failed', { cardId: spec.id, kind: 'truncated', reason: 'max_tokens' })
    } catch (error) {
      first = { text: '', stopReason: null }
      console.warn('Compatibility card initial generation failed', { cardId: spec.id, kind: compatibilityFailureKind(error), reason: error instanceof Error ? error.message : String(error) })
    }

    const retryPrompt = `${prompt}\n前回の出力は${first.stopReason === 'max_tokens' ? '長すぎて途中で切れました' : '形式検証に失敗しました'}。説明を簡潔にし、必ず完結したJSONにしてください。ページは8枚を目標とし、最低6枚を含めてください。前回の壊れたJSONの修復ではなく、このカードを最初から生成し直してください。`
    try {
      const retry = await generate(retryPrompt, spec, 2)
      if (retry.stopReason === 'max_tokens') throw new Error('再生成も最大トークン数に到達しました')
      const card = { ...parseCompatibilityCard(retry.text, 6), id: spec.id }
      if (cache) await cache.write(spec, card).catch(error => console.warn('Compatibility card cache write failed', { cardId: spec.id, reason: error instanceof Error ? error.message : String(error) }))
      return card
    } catch (error) {
      console.error('Compatibility card regeneration failed', { cardId: spec.id, kind: compatibilityFailureKind(error, error instanceof Error && /最大トークン/.test(error.message) ? 'max_tokens' : null), reason: error instanceof Error ? error.message : String(error) })
      return null
    }
  }).map(async promise => {
    const card = await promise
    completed += 1
    onCardComplete?.(completed, compatibilityCardSpecs.length)
    return card
  }))
  const cards = results.filter((card): card is ReportCard => card !== null)
  if (cards.length < 2) throw new Error('表示できる相性カードが不足しています')
  return assembleCompatibilityReport(cards)
}

async function loadCompatibilityContext(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) {
      sendApiError(res, 409, 'SELF_READING_REQUIRED', 'まず「あなたについて」の鑑定を作成してください。', false, correlationId(req)); return
    }
    const db = getSupabaseAdmin()
    const [{ data: partner }, { data: self }] = await Promise.all([
      db.from('partner_profiles').select('*').eq('id', req.params.id).eq('user_id', req.userId!).maybeSingle(),
      db.from('reading_conversations').select('id,birth_data,calculated_data').eq('id', conversationId).eq('user_id', req.userId!).maybeSingle(),
    ])
    if (!partner) { res.status(404).json({ error: '相手が見つかりません' }); return }
    if (!self?.birth_data || !self?.calculated_data) {
      sendApiError(res, 409, 'SELF_READING_REQUIRED', 'まず「あなたについて」の鑑定を作成してください。', false, correlationId(req)); return
    }
    res.locals.compatibility = { db, partner, self }
    next()
  } catch (error) {
    next(error)
  }
}

partnersRouter.post('/:id/compatibility', loadCompatibilityContext, requirePoints(3), async (req: AuthRequest, res) => {
  const useSse = req.query.format === 'sse'
  const progress = (percent: number, title: string, detail: string) => { if (useSse) res.write(`data: ${JSON.stringify({ type: 'progress', percent, title, detail })}\n\n`) }
  const complete = (report: StructuredReport) => { if (useSse) { progress(100, '関係性の鑑定ができました', '二人のパターンを読み始められます'); res.write(`data: ${JSON.stringify({ type: 'complete', report })}\n\n`); res.write('data: [DONE]\n\n'); res.end() } else res.json(report) }
  try {
    const { db, partner, self } = res.locals.compatibility
    if (useSse) { res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Accel-Buffering', 'no'); res.flushHeaders() }
    progress(5, '二人の情報を確認しています', '鑑定に使うプロフィールを準備しています')
    const relationshipType = req.body?.relationshipType === 'friend' ? 'friend' : 'romantic'
    const [year, month, day] = String(partner.birth_date).split('-').map(Number)
    const [hour, minute] = partner.birth_time ? String(partner.birth_time).split(':').map(Number) : [undefined, 0]
    progress(22, '相手のデータを読み解いています', '二人の命式を重ねる準備をしています')
    const shichu = calcShichu(year, month, day, hour, minute)
    const partnerFacts = {
      name: partner.display_name, birthDate: partner.birth_date, gender: partner.gender,
      day: shichu.day.kanshi, nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx),
      sanmei: calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays),
      sukuyo: getSukuyo(year, month, day), lifePathNumber: calcLifePathNumber(String(partner.birth_date)),
    }
    const selfHash = createHash('sha256').update(JSON.stringify(self.calculated_data)).digest('hex')
    const compatibilityIdentity = createHash('sha256').update(`compat-v3|${self.id}|${selfHash}|${partner.id}|${partner.updated_at ?? partner.created_at ?? ''}|${relationshipType}`).digest('hex')
    progress(42, '関係の共通点を探しています', '引き合う力とすれ違う条件を整理しています')
    const prompt = `本人と相手の命式事実を照合し、${relationshipType === 'friend' ? '友人' : '恋愛'}関係のカードを作成してください。
本人: ${JSON.stringify({ birth: self.birth_data, calculated: self.calculated_data })}
相手: ${JSON.stringify(partnerFacts)}
カード形式: {"card":{"id":"指定されたID","kind":"essence","title":"裸のカテゴリ名ではない断定文","summary":"120字以内","tags":["相性"],"period":null,"evidence":[{"family":"干支系","system":"四柱推命","detail":"二人の日柱"}],"metadataRefs":["self.day","partner.day"],"pages":[{"role":"opening","label":"二人の核","text":"120字以内"}]}}
opening/core/scene/shadow/exception/question/action/closingを含める。一文60字以内。断定調。弱点も書く。`
    progress(66, '二人の関係を書いています', '読み進められる関係性の物語に整えています')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const compatibilityStartedAt = Date.now()
    let generationAttempt = 0
    const keepAlive = useSse ? setInterval(() => res.write(': keep-alive\n\n'), 10_000) : null
    const report = await generateCompatibilityCards(prompt, async (generationPrompt, spec, cardAttempt) => {
      generationAttempt += 1
      const attemptStartedAt = Date.now()
      const message = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 8000, temperature: 0, messages: [{ role: 'user', content: generationPrompt }] })
      const block = message.content.find(item => item.type === 'text')
      if (!block || block.type !== 'text') throw new Error('AI応答がありません')
      console.info('Compatibility generation metric', {
        attempt: generationAttempt,
        cardId: spec.id,
        cardAttempt,
        phase: cardAttempt === 1 ? 'initial' : 'regenerate',
        stopReason: message.stop_reason,
        outputTokens: message.usage.output_tokens,
        outputChars: block.text.length,
        attemptDurationMs: Date.now() - attemptStartedAt,
        totalDurationMs: Date.now() - compatibilityStartedAt,
      })
      return { text: block.text, stopReason: message.stop_reason }
    }, completed => progress(66 + completed * 8, '二人の関係を書いています', `${completed}/3の関係性カードを整えました`), {
      read: async spec => {
        const cardCacheKey = createHash('sha256').update(`${compatibilityIdentity}|${spec.id}`).digest('hex')
        const { data, error } = await db.from('ai_report_cache').select('payload').eq('cache_key', cardCacheKey).maybeSingle()
        if (error) throw error
        return (data?.payload as ReportCard | undefined) ?? null
      },
      write: async (spec, card) => {
        const cardCacheKey = createHash('sha256').update(`${compatibilityIdentity}|${spec.id}`).digest('hex')
        const { error } = await db.from('ai_report_cache').upsert({ cache_key: cardCacheKey, generator_version: 'compat-v3-card', payload: card })
        if (error) throw error
      },
    })
      .finally(() => { if (keepAlive) clearInterval(keepAlive) })
    progress(90, '最後の確認をしています', 'ページの長さと重複を確認しています')
    complete(report)
  } catch (error) {
    console.error('Partner compatibility failed', error)
    if (res.headersSent) { res.write(`data: ${JSON.stringify({ type: 'error', code: 'GENERATION_FAILED', error: '相性鑑定を作成できませんでした', retryable: true })}\n\n`); res.write('data: [DONE]\n\n'); res.end() }
    else sendApiError(res, 500, 'GENERATION_FAILED', '相性鑑定を作成できませんでした', true, correlationId(req))
  }
})
