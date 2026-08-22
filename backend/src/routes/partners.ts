import { Router, type NextFunction, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { assertPartnerCapacity, MAX_PARTNER_PROFILES, normalizeRelationship, validatePartnerProfile } from '../lib/partnerProfiles.js'
import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { calcShichu, calcNayin, calcSanmei, getSukuyo, calcLifePathNumber, calcTimingCycles, calcExpandedDivination, calcSanmeiRelations, calcNumerologyProfile, calcKyuseiProfile, calcHonmeiStar, KYUSEI_NAMES } from './calc.js'
import type { ReportCard, StructuredReport } from '../lib/reportCards.js'
import { correlationId, sendApiError } from '../lib/apiError.js'
import { addPoints, requirePoints } from '../middleware/points.js'
import { calculatedDataWithReport } from '../lib/report/storedReport.js'
import { appendCoupleTimingCards, buildCoupleTimingCards, findCoupleTurningPoints } from '../lib/report/coupleTimingCards.js'
import { buildCoupleChartSections } from '../lib/report/chartSections.js'
import { calcZiwei } from '../lib/ziwei.js'
import { calcAstrology } from '../lib/astrology.js'
import { compactCompatibilityContext } from '../lib/compatibilityContext.js'
import { compatibilityReadingTitle } from '../lib/conversationTitle.js'
import { japanDateContext, japanDateParts } from '../lib/japanDate.js'
import { stripMarkdown } from '../lib/markdown.js'

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

const compatibilityBaseSpecs: CompatibilityCardSpec[] = [
  { id: 'compat-overview', purpose: '二人はどのような関係になりやすいか', titleDirection: '二人の関係の全体像を表す断定文' },
  { id: 'compat-beginning', purpose: '関係が始まりやすい瞬間', titleDirection: '出会いから関係が始まる場面を表す断定文' },
  { id: 'compat-attraction', purpose: '惹かれ合う理由', titleDirection: '相手に感じやすい魅力を表す断定文' },
  { id: 'compat-caution', purpose: '関係の中で気をつけたいこと', titleDirection: '関係を守るための注意点を表す断定文' },
  { id: 'compat-friction', purpose: 'すれ違いが起きやすい場面', titleDirection: 'すれ違いが生まれる具体的な場面を表す断定文' },
  { id: 'compat-repair', purpose: '拗れたときに二人がすると良いこと', titleDirection: '関係を立て直す具体的な行動を表す断定文' },
  { id: 'compat-growth', purpose: '長く続けるために大切なこと', titleDirection: '二人の関係を長く育てる鍵を表す断定文' },
]
const compatibilityMarriageSpec: CompatibilityCardSpec = { id: 'compat-marriage', purpose: '結婚したらどんな夫婦になりやすいか', titleDirection: '結婚後の二人の暮らし方を表す断定文' }
const compatibilityForbiddenTerms = /天中殺|日柱|日主|干支|五行|通変星|宿曜|納音|命宮|夫妻宮|壬水|乙亥|巨門|調舒星/

function compatibilityCardSpecs(relationshipType: 'romantic' | 'friend' | 'family') {
  return relationshipType === 'romantic' ? [...compatibilityBaseSpecs, compatibilityMarriageSpec] : compatibilityBaseSpecs
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('相性カードJSONが見つかりません')
  return JSON.parse(unfenced.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1')) as Record<string, unknown>
}

export function parseCompatibilityCard(raw: string, minimumPages = 8): ReportCard {
  const value = extractJsonObject(raw)
  const source = (value.card ?? (Array.isArray(value.cards) ? value.cards[0] : undefined)) as ReportCard | undefined
  const card = source ? {
    ...source,
    title: stripMarkdown(source.title ?? ''),
    summary: stripMarkdown(source.summary ?? ''),
    pages: Array.isArray(source.pages) ? source.pages.map(page => ({ ...page, label: stripMarkdown(page.label), text: stripMarkdown(page.text) })) : source.pages,
  } : undefined
  if (!card?.title || /^恋愛|友人|相性$/.test(card.title) || !Array.isArray(card.pages) || card.pages.length < minimumPages || card.pages.length > 12) {
    throw new Error('相性カード形式が不正です')
  }
  if (card.pages.some(page => !page.text || [...page.text].length > 120)) throw new Error('相性カード本文が不正です')
  const readerFacingText = [card.title, card.summary, ...card.pages.flatMap(page => [page.label, page.text])].join('\n')
  if (compatibilityForbiddenTerms.test(readerFacingText)) throw new Error('相性カード本文に占術用語が含まれています')
  if (!Array.isArray(card.evidence) || card.evidence.length === 0) throw new Error('相性カードの根拠が不足しています')
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
  _basePrompt: string,
  generate: (prompt: string, spec: CompatibilityCardSpec, attempt: number) => Promise<CompatibilityGeneration>,
  onCardComplete?: (completed: number, total: number) => void,
  cache?: CompatibilityCardCache,
  relationshipType: 'romantic' | 'friend' | 'family' = 'romantic',
): Promise<StructuredReport> {
  const specs = compatibilityCardSpecs(relationshipType)
  let completed = 0
  const results = await Promise.all(specs.map(async spec => {
    if (cache) {
      try {
        const cached = validateCompatibilityCard(await cache.read(spec), spec)
        if (cached) return cached
      } catch (error) {
        console.warn('Compatibility card cache read failed', { cardId: spec.id, reason: error instanceof Error ? error.message : String(error) })
      }
    }
    const prompt = `今回生成する章: ${spec.purpose}\nID: ${spec.id}\nタイトル方針: ${spec.titleDirection}\n形式は {"card":{...}}。章は1枚だけ、ページは8〜12枚。JSON以外を返さないでください。本文・タイトル・要約・ページラベルに占術の専門語を書かず、起きることの言葉へ翻訳してください。主語は「二人」または「あなた／あの人」にし、占いの解説ではなく二人の物語として書いてください。根拠となる占術データは本文に出さず evidence にだけ残してください。`
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
    onCardComplete?.(completed, specs.length)
    return card
  }))
  const cards = results.filter((card): card is ReportCard => card !== null)
  if (cards.length < specs.length - 1) throw new Error('表示できる相性カードが不足しています')
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
  const complete = (report: StructuredReport, conversationId: string) => { if (useSse) { progress(100, '関係性の鑑定ができました', '二人のパターンを読み始められます'); res.write(`data: ${JSON.stringify({ type: 'complete', report, conversationId })}\n\n`); res.write('data: [DONE]\n\n'); res.end() } else res.json({ ...report, conversationId }) }
  try {
    const { db, partner, self } = res.locals.compatibility
    if (useSse) { res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Accel-Buffering', 'no'); res.flushHeaders() }
    progress(5, '二人の情報を確認しています', '鑑定に使うプロフィールを準備しています')
    const normalizedRelationship = normalizeRelationship(req.body?.relationshipLabel, req.body?.relationshipType)
    const relationshipType = normalizedRelationship.relationshipType
    const relationshipLabel = normalizedRelationship.relationshipLabel
    const [year, month, day] = String(partner.birth_date).split('-').map(Number)
    const [hour, minute] = partner.birth_time ? String(partner.birth_time).split(':').map(Number) : [undefined, 0]
    progress(22, '相手のデータを読み解いています', '二人の命式を重ねる準備をしています')
    const shichu = calcShichu(year, month, day, hour, minute)
    const partnerTiming = calcTimingCycles(year, month, day, hour, minute, partner.gender === 'male' ? 'male' : 'female')
    const partnerSanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
    const partnerExpanded = calcExpandedDivination(shichu)
    const partnerCalculated = {
      birthDate: partner.birth_date,
      birthTime: partner.birth_time ?? '',
      birthplace: partner.birthplace,
      gender: partner.gender,
      shichuYear: shichu.year.kanshi,
      shichuMonth: shichu.month.kanshi,
      shichuDay: shichu.day.kanshi,
      shichuHour: shichu.hour?.kanshi ?? null,
      nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx),
      sanmeiStar: partnerSanmei.shukumeiStar,
      chusatsu: partnerSanmei.chusatsu,
      sukuyo: getSukuyo(year, month, day),
      lifePathNumber: calcLifePathNumber(String(partner.birth_date)),
      numerologyProfile: calcNumerologyProfile(year, month, day),
      honmeiName: KYUSEI_NAMES[calcHonmeiStar(year, month, day)],
      kyuseiProfile: calcKyuseiProfile(year, month, day, hour, minute),
      timing: partnerTiming,
      sanmeiRelations: calcSanmeiRelations(shichu, partnerSanmei.chusatsu),
      ziwei: calcZiwei(year, month, day, hour, partner.gender === 'male' ? 'male' : 'female', partner.birthplace),
      astrology: calcAstrology(year, month, day, hour, minute, partner.birthplace),
      ...partnerExpanded,
    }
    const selfHash = createHash('sha256').update(JSON.stringify(self.calculated_data)).digest('hex')
    const compactContext = compactCompatibilityContext(self.calculated_data, partnerCalculated, relationshipType)
    const currentYear = japanDateParts().year
    const cardInputIdentity = createHash('sha256').update(`compat-card-v2|${currentYear}|${JSON.stringify(compactContext)}`).digest('hex')
    const compatibilityIdentity = createHash('sha256').update(`compat-v7|${currentYear}|${self.id}|${selfHash}|${partner.id}|${partner.updated_at ?? partner.created_at ?? ''}|${relationshipType}|${relationshipLabel}`).digest('hex')
    progress(42, '関係の共通点を探しています', '引き合う力とすれ違う条件を整理しています')
    const prompt = `現在日は${japanDateContext()}です。過去と未来をこの日付を基準に区別してください。
本人と相手の命式事実を照合し、「${relationshipLabel}」という${relationshipType === 'romantic' ? '恋愛' : relationshipType === 'family' ? '家族' : '友人・知人'}関係のカードを作成してください。
具体的な関係名を文章の前提にしてください。元恋人は「もし関係が戻り共に暮らすなら」、片思いは「関係が始まり続いた先に」、夫婦は現在進行形で結婚章を書いてください。
本人: ${JSON.stringify(compactContext.self)}
相手: ${JSON.stringify({ name: partner.display_name, ...compactContext.partner })}
カード形式: {"card":{"id":"指定されたID","kind":"essence","title":"裸のカテゴリ名ではない断定文","summary":"120字以内","tags":["相性"],"period":null,"evidence":[{"family":"内部の占術系統","system":"内部の占術名","detail":"判断に使った計算上の根拠"}],"metadataRefs":["self.day","partner.day"],"pages":[{"role":"opening","label":"物語上の短い見出し","text":"120字以内"}]}}
opening/core/scene/shadow/exception/question/action/closingを含める。一文60字以内。断定調。弱点も書く。
出力にMarkdown記法を使わない。**、*、#、-、バッククォート、>などの記号で装飾しない。強調も文章として書く。
本文に天中殺、日柱、日主、干支、五行、通変星、宿曜、納音、命宮、夫妻宮、星名、干支名などの占術用語を一切書かない。根拠は evidence にのみ保存し、本文では二人に起きる場面や行動へ翻訳する。`
    progress(66, '二人の関係を書いています', '読み進められる関係性の物語に整えています')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const compatibilityStartedAt = Date.now()
    let generationAttempt = 0
    const keepAlive = useSse ? setInterval(() => res.write(': keep-alive\n\n'), 10_000) : null
    const relationshipReport = await generateCompatibilityCards(prompt, async (generationPrompt, spec, cardAttempt) => {
      generationAttempt += 1
      const attemptStartedAt = Date.now()
      const message = await client.beta.promptCaching.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 8000, temperature: 0,
        system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: generationPrompt }],
      })
      const block = message.content.find(item => item.type === 'text')
      if (!block || block.type !== 'text') throw new Error('AI応答がありません')
      console.info('Compatibility generation metric', {
        attempt: generationAttempt,
        cardId: spec.id,
        cardAttempt,
        phase: cardAttempt === 1 ? 'initial' : 'regenerate',
        stopReason: message.stop_reason,
        outputTokens: message.usage.output_tokens,
        cacheCreationInputTokens: message.usage.cache_creation_input_tokens,
        cacheReadInputTokens: message.usage.cache_read_input_tokens,
        outputChars: block.text.length,
        attemptDurationMs: Date.now() - attemptStartedAt,
        totalDurationMs: Date.now() - compatibilityStartedAt,
      })
      return { text: block.text, stopReason: message.stop_reason }
    }, (completed, total) => progress(66 + Math.floor(completed / total * 24), '二人の関係を書いています', `${completed}/${total}の関係性カードを整えました`), {
      read: async spec => {
        const cardCacheKey = createHash('sha256').update(`${cardInputIdentity}|${spec.id}`).digest('hex')
        const { data, error } = await db.from('ai_report_cache').select('payload').eq('cache_key', cardCacheKey).maybeSingle()
        if (error) throw error
        return (data?.payload as ReportCard | undefined) ?? null
      },
      write: async (spec, card) => {
        const cardCacheKey = createHash('sha256').update(`${cardInputIdentity}|${spec.id}`).digest('hex')
        const { error } = await db.from('ai_report_cache').upsert({ cache_key: cardCacheKey, generator_version: 'compat-card-v1', payload: card })
        if (error) throw error
      },
    }, relationshipType)
      .finally(() => { if (keepAlive) clearInterval(keepAlive) })
    const selfBirth = self.birth_data as Record<string, unknown>
    const selfBirthDate = String(selfBirth.birthDate ?? selfBirth.birth_date ?? '')
    const selfBirthYear = Number(selfBirthDate.slice(0, 4))
    const selfTiming = (self.calculated_data as { timing?: { annual?: Array<{ year: number; score: number; themes: string[] }> } }).timing?.annual ?? []
    const turningPoints = findCoupleTurningPoints(selfTiming, partnerTiming.annual, selfBirthYear, year)
    const timingReport = appendCoupleTimingCards(relationshipReport, buildCoupleTimingCards(turningPoints))
    const report: StructuredReport = {
      ...timingReport,
      cards: timingReport.cards.map(card => ({ ...card, scope: 'couple' as const })),
      chartSections: buildCoupleChartSections(self.calculated_data, partnerCalculated),
    }
    progress(90, '最後の確認をしています', 'ページの長さと重複を確認しています')
    const { data: existingConversation, error: conversationLookupError } = await db.from('reading_conversations')
      .select('id').eq('user_id', req.userId!).eq('idempotency_key', compatibilityIdentity).limit(1).maybeSingle()
    if (conversationLookupError) throw conversationLookupError
    let compatibilityConversationId = existingConversation?.id as string | undefined
    if (!compatibilityConversationId) {
      const partnerBirth = {
        birthDate: partner.birth_date,
        birthTime: partner.birth_time ?? '',
        birthplace: partner.birthplace,
        gender: partner.gender,
        displayName: partner.display_name,
      }
      const insertPayload = {
        user_id: req.userId,
        title: compatibilityReadingTitle(partner.display_name),
        kind: 'compatibility',
        partner_profile_id: partner.id,
        idempotency_key: compatibilityIdentity,
        birth_data: { self: self.birth_data, partner: partnerBirth, relationshipType },
        calculated_data: calculatedDataWithReport(compactContext, report),
        report_text: report.reportText,
        source_section: '二人の関係',
      }
      const { data: createdConversation, error: conversationCreateError } = await db.from('reading_conversations')
        .insert(insertPayload).select('id').single()
      if (conversationCreateError?.code === '23505') {
        const { data: racedConversation, error: racedLookupError } = await db.from('reading_conversations')
          .select('id').eq('user_id', req.userId!).eq('idempotency_key', compatibilityIdentity).limit(1).maybeSingle()
        if (racedLookupError) throw racedLookupError
        compatibilityConversationId = racedConversation?.id
      } else if (conversationCreateError) throw conversationCreateError
      else compatibilityConversationId = createdConversation?.id
    }
    if (!compatibilityConversationId) throw new Error('相性鑑定の会話を保存できませんでした')
    console.info('Compatibility conversation persistence metric', {
      conversationPersisted: true,
      conversationReused: Boolean(existingConversation?.id),
      sourceConversationPresent: true,
    })
    complete(report, compatibilityConversationId)
  } catch (error) {
    console.error('Partner compatibility failed', error)
    // Generation starts after the usage cost is deducted. Do not charge the user
    // when generation, validation, or persistence fails before a result is returned.
    if (req.isPremium === false && req.userId && req.accessToken && req.pointsAfter !== undefined) {
      try {
        await addPoints(req.userId, req.accessToken, 3)
        console.info('Compatibility points refunded', { correlationId: correlationId(req), cost: 3 })
      } catch (refundError) {
        console.error('Compatibility points refund failed', { correlationId: correlationId(req), refundError })
      }
    }
    if (res.headersSent) { res.write(`data: ${JSON.stringify({ type: 'error', code: 'GENERATION_FAILED', error: '相性鑑定を作成できませんでした', retryable: true })}\n\n`); res.write('data: [DONE]\n\n'); res.end() }
    else sendApiError(res, 500, 'GENERATION_FAILED', '相性鑑定を作成できませんでした', true, correlationId(req))
  }
})
