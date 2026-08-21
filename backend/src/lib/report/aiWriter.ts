import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '../supabaseAdmin.js'
import type { StructuredReport, ReportCard, ReportCardPage, ReportPageRole } from '../reportCards.js'
import type { ReportMetadata } from './metadata.js'

const GENERATOR_VERSION = 'ai-cards-v2-timing'
const AI_REWRITE_TIMEOUT_MS = Math.max(1_000, Number(process.env.AI_REPORT_TIMEOUT_MS ?? 8_000))
const roles = new Set<ReportPageRole>(['opening', 'core', 'scene', 'shadow', 'exception', 'question', 'action', 'closing'])
const nakedTitles = new Set(['仕事', '恋愛', '恋愛・結婚', '結婚', '人間関係', '本質', '性格', '時期の流れ'])

export interface AiWriterDependencies {
  readCache(key: string): Promise<StructuredReport | null>
  writeCache(key: string, report: StructuredReport): Promise<void>
  generate(prompt: string): Promise<string>
}

function cacheKey(seed: string, metadata: ReportMetadata) {
  return createHash('sha256').update(`${GENERATOR_VERSION}|${seed}|${metadata.combinationSignature}`).digest('hex')
}

function cleanJson(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}

function validatePage(value: unknown): value is ReportCardPage {
  if (!value || typeof value !== 'object') return false
  const page = value as Record<string, unknown>
  return typeof page.role === 'string' && roles.has(page.role as ReportPageRole)
    && typeof page.label === 'string' && typeof page.text === 'string'
    && page.text.trim().length > 0 && [...page.text.trim()].length <= 120
}

export function parseAndValidateAiReport(raw: string, fallback: StructuredReport): StructuredReport {
  const parsed = JSON.parse(cleanJson(raw)) as { cards?: unknown[] }
  if (!Array.isArray(parsed.cards) || parsed.cards.length !== fallback.cards.length) throw new Error('AI cards count mismatch')
  const cards = parsed.cards.map((value, index): ReportCard => {
    if (!value || typeof value !== 'object') throw new Error('Invalid AI card')
    const card = value as Record<string, unknown>
    const title = typeof card.title === 'string' ? card.title.trim() : ''
    const summary = typeof card.summary === 'string' ? card.summary.trim() : ''
    const pages = Array.isArray(card.pages) ? card.pages : []
    const metadataRefs = Array.isArray(card.metadataRefs) ? card.metadataRefs.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
    if (!title || nakedTitles.has(title) || !summary || [...summary].length > 120) throw new Error('Invalid AI title or summary')
    const minimumPages = fallback.cards[index].kind === 'timing' ? 8 : 16
    const maximumPages = fallback.cards[index].kind === 'timing' ? 12 : 24
    if (pages.length < minimumPages || pages.length > maximumPages || !pages.every(validatePage)) throw new Error('Invalid AI pages')
    if (metadataRefs.length === 0) throw new Error('AI card did not reference metadata')
    return { ...fallback.cards[index], title, summary, pages, metadataRefs }
  })
  const reportText = cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n')
  return { version: 2, reportText, cards }
}

function promptFor(fallback: StructuredReport, metadata: ReportMetadata) {
  const source = fallback.cards.map(card => ({ id: card.id, kind: card.kind, title: card.title, summary: card.summary, evidence: card.evidence }))
  return `次の鑑定事実を、読み手本人について断定するカードJSONへ書き換えてください。JSON以外は返さないでください。
入力メタデータ: ${JSON.stringify(metadata)}
元カード: ${JSON.stringify(source)}

出力は {"cards":[{"title":"...","summary":"...","metadataRefs":["missingElements:火"],"pages":[{"role":"opening","label":"はじまり","text":"..."}]}]}。
元カードと同じ順・同じ枚数にする。kindがtimingのカードは8〜12ページ、それ以外は16〜24ページ。opening、core、scene、shadow、exception、question、action、closingを含める。
各textは120字以内、一文60字以内、1ページ1主張。具体的な場面を先に書く。二面性と都合の悪い面を含める。断定調にする。
「かもしれません」「傾向がある人もいます」「大切です」「意識しましょう」を使わない。裸のカテゴリ名をtitleにしない。
各カードは入力メタデータの具体値を最低1つ本文に反映し、そのパスをmetadataRefsへ入れる。内部仕様やmetadataという語は本文に書かない。`
}

export async function writeReportWithAi(
  seed: string,
  fallback: StructuredReport,
  metadata: ReportMetadata,
  dependencies: AiWriterDependencies = productionDependencies(),
): Promise<StructuredReport> {
  const key = cacheKey(seed, metadata)
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const cached = await dependencies.readCache(key)
    if (cached) return cached
    const raw = await Promise.race([
      dependencies.generate(promptFor(fallback, metadata)),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('AI report rewrite timed out')), AI_REWRITE_TIMEOUT_MS) }),
    ])
    const report = parseAndValidateAiReport(raw, fallback)
    await dependencies.writeCache(key, report)
    return report
  } catch (error) {
    console.error('AI report generation rejected; deterministic fallback used', error instanceof Error ? error.message : String(error))
    return fallback
  } finally {
    if (timeout) clearTimeout(timeout)
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
    async generate(prompt) {
      const message = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 6000, temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      })
      const block = message.content.find(item => item.type === 'text')
      if (!block || block.type !== 'text') throw new Error('AI returned no text')
      return block.text
    },
  }
}
