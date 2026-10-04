/**
 * Timeline v3 — integration entry points (mirror annual3600/cards.ts).
 * Wiring is described in docs/timeline-v3/IMPLEMENTATION.md §8.
 */
import type { ReportCard, StructuredReport } from '../../reportCards.js'
import { finalizeReportProvenance } from '../provenance.js'
import { composeYear, timelineV3Cards, toSimpleCard, type TimelineStyle } from './compose.js'
import { timelineContext, type PartnerKind, type RelationshipStatus, type TimelineV3Input } from './signals.js'
import { TIMELINE_V3_VERSION } from './version.js'

export { TIMELINE_V3_VERSION, timelineV3Cards }
export type { TimelineV3Input, RelationshipStatus, PartnerKind }

/** Same display range as replaceAnnual3600: from max(now-15, birth+18) to now+20. */
export function timelineV3Range(input: TimelineV3Input, nowYear: number) {
  const birthYear = Number(input.birthDate?.slice(0, 4) ?? nowYear)
  return { from: Math.max(nowYear - 15, birthYear + 18), to: nowYear + 20 }
}

export function replaceTimelineV3(report: StructuredReport, input: TimelineV3Input, nowYear: number, style: TimelineStyle = 'simple'): StructuredReport {
  const { from, to } = timelineV3Range(input, nowYear)
  const cards = [...report.cards.filter(c => c.kind !== 'timing'), ...timelineV3Cards(input, from, to, nowYear, style)]
  return finalizeReportProvenance({ ...report, cards, reportText: cards.flatMap(c => [`【${c.title}】`, c.summary, ...(c.sections ?? []).flatMap(s => [s.heading, s.body])]).join('\n\n') }, `self-report-v3|${TIMELINE_V3_VERSION}`)
}

const RELATIONSHIP_STATUSES: RelationshipStatus[] = ['partnered', 'single', 'married']
export function parseRelationshipStatus(v: unknown): RelationshipStatus | undefined {
  return typeof v === 'string' && (RELATIONSHIP_STATUSES as string[]).includes(v) ? v as RelationshipStatus : undefined
}

/**
 * Saved reports: re-render self year cards from the report's own birth snapshot (never from the live profile).
 * lifeEvents: the person's current 年表 (life_events rows), so a saved report shows the events entered since.
 * partnerSince (v2.19): the meeting year of the registered partner (couple timeline settings); partnerKind (v2.23): that
 * partner's label kind (crush / partnered / former / married). Without partnerKind, partnerSince counts for partnered people only.
 * partnerBirth (v2.24): that partner's birth data, so the dating-window line follows the two people's fortune.
 */
export function refreshSavedTimelineV3Cards(cards: ReportCard[], snapshot: Record<string, unknown>, nowYear: number, lifeEvents?: unknown[], partnerSince?: number | null, partnerKind?: PartnerKind | null, partnerBirth?: TimelineV3Input['partnerBirth'] | null): ReportCard[] {
  const text = (k: string) => typeof snapshot[k] === 'string' ? snapshot[k] as string : undefined
  const input: TimelineV3Input = {
    birthDate: text('birthDate') ?? text('birth_date'), birthTime: text('birthTime') ?? text('birth_time'),
    birthplace: text('birthplace'), birthTimeZone: text('birthTimeZone'), gender: text('gender'), workContext: text('workContext'),
    relationshipStatus: parseRelationshipStatus(snapshot.relationshipStatus),
    ...(lifeEvents?.length ? { lifeEvents: lifeEvents as TimelineV3Input['lifeEvents'] } : {}),
    ...(typeof partnerSince === 'number' ? { partnerSince, ...(partnerKind ? { partnerKind } : {}), ...(partnerBirth?.birthDate ? { partnerBirth } : snapshot.partnerBirth && typeof snapshot.partnerBirth === 'object' ? { partnerBirth: snapshot.partnerBirth as TimelineV3Input['partnerBirth'] } : {}) } : typeof snapshot.partnerSince === 'number' ? { partnerSince: snapshot.partnerSince as number, ...(typeof snapshot.partnerKind === 'string' ? { partnerKind: snapshot.partnerKind as PartnerKind } : {}) } : {}),
  }
  const ctx = input.birthDate ? timelineContext(input) : null
  if (!ctx) return cards
  const render = (c: ReportCard, y: number) => { const r = composeYear(ctx, y, nowYear); return (c as any).timelineV3Calculation?.style === 'detailed' ? r.card : toSimpleCard(r.card, r.simple, r.simpleTitle) }
  const yearOf = (c: ReportCard) => c.kind === 'timing' && (!c.scope || c.scope === 'self') ? Number(c.period?.label.match(/(\d{4})年/)?.[1]) : NaN
  return cards.map(c => {
    const y = yearOf(c)
    return Number.isInteger(y) && y >= 1952 && y <= 2100 ? render(c, y) : c
  })
}

/** Contract parity: a v3 card must equal a fresh composition from its stored input + nowYear. */
export function timelineV3CardIsValid(card: ReportCard): boolean {
  const meta = (card as any).timelineV3Calculation
  const m = /^turning-year-(\d{4})$/.exec(card.id)
  if (!meta || meta.version !== TIMELINE_V3_VERSION || !m) return false
  const ctx = timelineContext(meta.input)
  if (!ctx) return false
  const r = composeYear(ctx, Number(m[1]), meta.nowYear)
  const expected = meta.style === 'simple' ? toSimpleCard(r.card, r.simple, r.simpleTitle) : r.card
  return JSON.stringify(expected) === JSON.stringify(card)
}
