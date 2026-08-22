import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '../supabaseAdmin.js'
import type { StructuredReport, ReportCard, ReportCardPage, ReportPageRole } from '../reportCards.js'
import type { ReportMetadata } from './metadata.js'
import { japanDateContext, japanDateParts } from '../japanDate.js'

const GENERATOR_VERSION = 'ai-cards-v6-domain-contract'
const AI_REWRITE_TIMEOUT_MS = Math.max(1_000, Number(process.env.AI_REPORT_TIMEOUT_MS ?? 60_000))
const AI_TOTAL_TIMEOUT_MS = Math.max(1_000, Number(process.env.AI_REPORT_TOTAL_TIMEOUT_MS ?? 100_000))
const AI_MAX_CONCURRENCY = Math.max(1, Number(process.env.AI_REPORT_MAX_CONCURRENCY ?? 4))
const roles = new Set<ReportPageRole>(['opening', 'core', 'scene', 'shadow', 'exception', 'question', 'action', 'closing'])
const nakedTitles = new Set(['仕事', '恋愛', '恋愛・結婚', '結婚', '人間関係', '本質', '性格', '時期の流れ'])

function logGeneration(event: 'cache_hit' | 'generated' | 'fallback' | 'timeout' | 'validation_failure', startedAt: number, reason?: string, cardId?: string) {
  console.info('AI report generation metric', {
    event,
    generator: ['fallback', 'timeout', 'validation_failure'].includes(event) ? 'deterministic' : 'ai',
    durationMs: Date.now() - startedAt,
    ...(reason ? { reason } : {}),
    ...(cardId ? { cardId } : {}),
  })
}

export interface AiWriterDependencies {
  readCache(key: string): Promise<StructuredReport | null>
  writeCache(key: string, report: StructuredReport): Promise<void>
  readCardCache?(key: string): Promise<ReportCard | null>
  writeCardCache?(key: string, card: ReportCard): Promise<void>
  generate(prompt: string): Promise<string>
  overallTimeoutMs?: number
  cardTimeoutMs?: number
  maxConcurrency?: number
}

function cacheKey(seed: string, metadata: ReportMetadata) {
  return createHash('sha256').update(`${GENERATOR_VERSION}|${japanDateParts().year}|${seed}|${metadata.combinationSignature}`).digest('hex')
}

function cardCacheKey(seed: string, metadata: ReportMetadata, cardId: string) {
  return createHash('sha256').update(`${GENERATOR_VERSION}|${japanDateParts().year}|card|${seed}|${metadata.combinationSignature}|${cardId}`).digest('hex')
}

function cleanJson(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}

function titleBigrams(value: string): Set<string> {
  const normalized = value.normalize('NFKC').toLowerCase().replace(/[\s「」『』。、！？・]/g, '')
  if (normalized.length < 2) return new Set([normalized])
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2)))
}

export function titlesAreSimilar(left: string, right: string): boolean {
  const a = titleBigrams(left); const b = titleBigrams(right)
  if (a.size === 0 || b.size === 0) return false
  const intersection = [...a].filter(value => b.has(value)).length
  return intersection / Math.min(a.size, b.size) >= 0.72
}

function validatePage(value: unknown): value is ReportCardPage {
  if (!value || typeof value !== 'object') return false
  const page = value as Record<string, unknown>
  return typeof page.role === 'string' && roles.has(page.role as ReportPageRole)
    && typeof page.label === 'string' && typeof page.text === 'string'
    && page.text.trim().length > 0 && [...page.text.trim()].length <= 120
}

const loveForbidden = /仕事|職場|キャリア|上司/u
const workForbidden = /恋愛|恋人|結婚|パートナー/u

function containsForbiddenDomain(cardId: string, pages: ReportCardPage[]) {
  const content = pages.map(page => `${page.label}\n${page.text}`).join('\n')
  if (cardId.startsWith('love-')) return loveForbidden.test(content)
  if (cardId.startsWith('work-')) return workForbidden.test(content)
  return false
}

function parseAndValidateAiCard(raw: string, fallback: ReportCard): ReportCard {
  const parsed = JSON.parse(cleanJson(raw)) as Record<string, unknown>
  const value = parsed.card ?? (Array.isArray(parsed.cards) ? parsed.cards[0] : parsed)
  if (!value || typeof value !== 'object') throw new Error('Invalid AI card')
  const card = value as Record<string, unknown>
  const title = typeof card.title === 'string' ? card.title.trim() : ''
  const summary = typeof card.summary === 'string' ? card.summary.trim() : ''
  const pages = Array.isArray(card.pages) ? card.pages : []
  const metadataRefs = Array.isArray(card.metadataRefs) ? card.metadataRefs.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
  if (!title || nakedTitles.has(title) || !summary || [...summary].length > 120) throw new Error('Invalid AI title or summary')
  const minimumPages = fallback.kind === 'timing' ? 8 : 15
  const maximumPages = fallback.kind === 'timing' ? 12 : 20
  if (pages.length < minimumPages || pages.length > maximumPages || !pages.every(validatePage)) throw new Error('Invalid AI pages')
  if (containsForbiddenDomain(fallback.id, pages as ReportCardPage[])) throw new Error('AI card mixed an unrelated domain')
  if (metadataRefs.length === 0) throw new Error('AI card did not reference metadata')
  return { ...fallback, title, summary, pages, metadataRefs }
}

export function parseAndValidateAiReport(raw: string, fallback: StructuredReport): StructuredReport {
  const parsed = JSON.parse(cleanJson(raw)) as { cards?: unknown[] }
  if (!Array.isArray(parsed.cards) || parsed.cards.length !== fallback.cards.length) throw new Error('AI cards count mismatch')
  const cards = parsed.cards.map((value, index) => parseAndValidateAiCard(JSON.stringify(value), fallback.cards[index]))
  const reportText = cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n')
  return { version: 3, reportText, cards, generator: 'ai' }
}

function pageContractFor(card: ReportCard): string {
  if (card.id.startsWith('love-')) return `この章は恋愛だけを扱う。15〜20ページで書く。
惹かれ方、距離の取り方、関係の始まり、安心できる条件、すれ違いが起きる場面、続くとき／終わるとき、相手に見せる顔と見せない顔、余韻を別々のページにする。
仕事・キャリア・職場・上司の話は一切書かない。`
  if (card.id.startsWith('work-')) return `この章は仕事だけを扱う。15〜20ページで書く。
進め方、任され方、力が出る環境、消耗する環境、評価のされ方、判断の癖、役割が変わるとき、余韻を別々のページにする。
恋愛・恋人・結婚・パートナーの話は一切書かない。`
  const theme = card.tags[0] ?? card.title
  return `この章は「${theme}」だけを扱う。15〜20ページで書く。
導入、核、表の顔、内側の感情、強み、苦手、人との距離、過去からの変化、今後の使い方、余韻を別々のページにする。
恋愛と仕事は、それぞれ最大1ページまでにする。`
}

function promptForCard(card: ReportCard, metadata: ReportMetadata, index: number, total: number) {
  const source = { id: card.id, kind: card.kind, title: card.title, summary: card.summary, pages: card.pages, evidence: card.evidence }
  const pageContract = card.kind === 'timing'
    ? 'この時期章だけを8〜12ページで書く。'
    : pageContractFor(card)
  return `現在日は${japanDateContext()}です。過去の年を未来として、未来の年を過去として書かないでください。
全${total}章のうち第${index + 1}章だけを書きます。次の鑑定事実を、読み手本人について断定するカードJSONへ書き換えてください。JSON以外は返さないでください。
入力メタデータ: ${JSON.stringify(metadata)}
この章の元データ: ${JSON.stringify(source)}

出力は {"card":{"title":"...","summary":"...","metadataRefs":["missingElements:火"],"pages":[{"role":"opening","label":"はじまり","text":"..."}]}}。
${pageContract}
openingは短く、sceneは60〜120字にする。各textは120字以内で1ページ1主張。具体的な場面を先に書き、感情、葛藤、余韻まで描く。同じ内容を語尾だけ変えて繰り返さない。二面性と都合の悪い面を含める。断定調にする。
「かもしれません」「傾向がある人もいます」「大切です」「意識しましょう」を使わない。裸のカテゴリ名をtitleにしない。
元ページの情報を捨てず、根拠と入力メタデータの具体値を最低1つ本文に反映し、そのパスをmetadataRefsへ入れる。内部仕様やmetadataという語は本文に書かない。`
}

async function generateCard(card: ReportCard, prompt: string, dependencies: AiWriterDependencies): Promise<ReportCard> {
  const startedAt = Date.now()
  const timeoutMs = Math.min(dependencies.cardTimeoutMs ?? AI_REWRITE_TIMEOUT_MS, dependencies.overallTimeoutMs ?? Number.POSITIVE_INFINITY)
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const raw = await Promise.race([
      dependencies.generate(prompt),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('AI report rewrite timed out')), timeoutMs) }),
    ])
    return parseAndValidateAiCard(raw, card)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    const event = /timed out/i.test(reason) ? 'timeout' : 'validation_failure'
    logGeneration(event, startedAt, reason, card.id)
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function writeReportWithAi(
  seed: string,
  fallback: StructuredReport,
  metadata: ReportMetadata,
  dependencies: AiWriterDependencies = productionDependencies(),
): Promise<StructuredReport> {
  const startedAt = Date.now()
  const key = cacheKey(seed, metadata)
  try {
    const cached = await dependencies.readCache(key)
    if (cached) {
      logGeneration('cache_hit', startedAt)
      return { ...cached, generator: 'ai' }
    }
    const overallTimeoutMs = dependencies.overallTimeoutMs ?? AI_TOTAL_TIMEOUT_MS
    const deadlineAt = Date.now() + overallTimeoutMs
    const generatedCards = [...fallback.cards]
    const completedByAi = new Set<number>()
    let nextIndex = 0
    const worker = async () => {
      while (true) {
        const index = nextIndex++
        if (index >= fallback.cards.length) return
        const card = fallback.cards[index]
        const cardKey = cardCacheKey(seed, metadata, card.id)
        try {
          const cardCached = await dependencies.readCardCache?.(cardKey)
          if (cardCached) {
            generatedCards[index] = cardCached
            completedByAi.add(index)
            logGeneration('cache_hit', startedAt, undefined, card.id)
            continue
          }
          const generated = await generateCard(card, promptForCard(card, metadata, index, fallback.cards.length), dependencies)
          generatedCards[index] = generated
          completedByAi.add(index)
          try { await dependencies.writeCardCache?.(cardKey, generated) }
          catch (error) { console.warn('AI card cache write failed', { cardId: card.id, reason: error instanceof Error ? error.message : String(error) }) }
        } catch { /* この章だけ決定論版を残す */ }
      }
    }
    const concurrency = Math.min(fallback.cards.length, dependencies.maxConcurrency ?? AI_MAX_CONCURRENCY)
    const workers = Array.from({ length: concurrency }, () => worker())
    let overallTimer: ReturnType<typeof setTimeout> | undefined
    const completedWithinDeadline = await Promise.race([
      Promise.all(workers).then(() => true),
      new Promise<boolean>(resolve => { overallTimer = setTimeout(() => resolve(false), overallTimeoutMs) }),
    ])
    if (overallTimer) clearTimeout(overallTimer)

    const cards: ReportCard[] = []
    for (const [index, generated] of generatedCards.entries()) {
      if (!completedByAi.has(index) || !cards.some(card => titlesAreSimilar(card.title, generated.title))) {
        cards.push(generated); continue
      }
      try {
        const remainingMs = deadlineAt - Date.now()
        if (remainingMs <= 0) throw new Error('No time remained for duplicate title retry')
        const retry = await generateCard(fallback.cards[index], `${promptForCard(fallback.cards[index], metadata, index, fallback.cards.length)}\n既出タイトル「${cards.map(card => card.title).join('」「')}」と異なる焦点・語彙のタイトルにしてください。`, {
          ...dependencies, cardTimeoutMs: Math.min(dependencies.cardTimeoutMs ?? AI_REWRITE_TIMEOUT_MS, remainingMs),
        })
        if (cards.some(card => titlesAreSimilar(card.title, retry.title))) throw new Error('AI title remained too similar after retry')
        try { await dependencies.writeCardCache?.(cardCacheKey(seed, metadata, fallback.cards[index].id), retry) }
        catch (error) { console.warn('AI card cache write failed', { cardId: fallback.cards[index].id, reason: error instanceof Error ? error.message : String(error) }) }
        cards.push(retry)
      } catch { completedByAi.delete(index); cards.push(fallback.cards[index]) }
    }
    const reportText = cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n')
    const aiCardCount = completedByAi.size
    const report: StructuredReport = { version: 3, reportText, cards, generator: aiCardCount > 0 ? 'ai' : 'deterministic' }
    if (aiCardCount === cards.length) {
      try { await dependencies.writeCache(key, report) }
      catch (error) { console.warn('AI report cache write failed', { reason: error instanceof Error ? error.message : String(error) }) }
      logGeneration('generated', startedAt)
    } else {
      const reason = `${cards.length - aiCardCount}/${cards.length} cards used deterministic fallback${completedWithinDeadline ? '' : ' after overall timeout'}`
      logGeneration('fallback', startedAt, reason)
    }
    return report
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error('AI report generation rejected; deterministic fallback used', reason)
    logGeneration('fallback', startedAt, reason)
    return { ...fallback, generator: 'deterministic' }
  }
}

function productionDependencies(): AiWriterDependencies {
  return {
    async readCache(key) {
      const { data, error } = await getSupabaseAdmin().from('ai_report_cache').select('payload').eq('cache_key', key).maybeSingle()
      if (error) { console.error('AI report cache read failed', error.message); return null }
      return data?.payload as StructuredReport | null
    },
    async writeCache(key, report) {
      const { error } = await getSupabaseAdmin().from('ai_report_cache').upsert({ cache_key: key, generator_version: GENERATOR_VERSION, payload: report })
      if (error) throw new Error(`AI report cache write failed: ${error.message}`)
    },
    async readCardCache(key) {
      const { data, error } = await getSupabaseAdmin().from('ai_report_cache').select('payload').eq('cache_key', key).maybeSingle()
      if (error) { console.error('AI card cache read failed', error.message); return null }
      return data?.payload as ReportCard | null
    },
    async writeCardCache(key, card) {
      const { error } = await getSupabaseAdmin().from('ai_report_cache').upsert({ cache_key: key, generator_version: GENERATOR_VERSION, payload: card })
      if (error) throw new Error(`AI card cache write failed: ${error.message}`)
    },
    async generate(prompt) {
      const startedAt = Date.now()
      try {
        const message = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
          model: 'claude-sonnet-4-6', max_tokens: 4000, temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        })
        const block = message.content.find(item => item.type === 'text')
        console.info('Anthropic AI report response metric', {
          durationMs: Date.now() - startedAt,
          stopReason: message.stop_reason,
          outputTokens: message.usage.output_tokens,
          outputChars: block?.type === 'text' ? block.text.length : 0,
        })
        if (!block || block.type !== 'text') throw new Error('AI returned no text')
        return block.text
      } catch (error) {
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined
        console.warn('Anthropic AI report request metric', {
          durationMs: Date.now() - startedAt,
          status: status ?? null,
          rateLimited: status === 429,
          errorType: error instanceof Error ? error.name : 'unknown',
        })
        throw error
      }
    },
  }
}
