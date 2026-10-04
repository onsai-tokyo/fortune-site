import { refreshSavedTimelineV3Cards,type TimelineV3Input } from './timelineV3/index.js'
import { japanDateParts } from '../japanDate.js'
import type { ReportCard } from '../reportCards.js'
import { annual3600Cards } from './annual3600/cards.js'
import type { AnnualInputFields } from './annual3600/inputPolicy.js'

// Saved reports predate editorial releases. Refresh the year cards on read from
// that report's own birth snapshot; never rewrite stored reports or borrow a profile.
export const SAVED_TIMELINE_REVISION = 'saved-timeline-tags-1'
export function refreshSavedTimelineCards(cards: ReportCard[], snapshot: unknown, scope: string, context: Partial<TimelineV3Input> = {}): ReportCard[] {
  if (scope === 'self' && process.env.ANNUAL_READING_ENGINE?.trim() === 'timeline3' && snapshot && typeof snapshot === 'object') return refreshSavedTimelineV3Cards(cards,snapshot as Record<string,unknown>,japanDateParts().year,context.lifeEvents,context.partnerSince,context.partnerKind,context.partnerBirth)
  if (scope !== 'self' || process.env.ANNUAL_READING_ENGINE?.trim() !== 'catalog3600' || !snapshot || typeof snapshot !== 'object') return cards
  const raw = snapshot as Record<string, unknown>
  const text = (key: string) => typeof raw[key] === 'string' ? raw[key] as string : undefined
  const input: AnnualInputFields = {
    birthDate: text('birthDate') ?? text('birth_date'), birthTime: text('birthTime') ?? text('birth_time'),
    birthplace: text('birthplace'), birthTimeZone: text('birthTimeZone'), gender: text('gender'),
    spouseConvention: text('spouseConvention'), annualYunConvention: text('annualYunConvention'), workContext: text('workContext'),
  }
  if (!input.birthDate) return cards
  const year = (card: ReportCard) => card.kind === 'timing' && (!card.scope || card.scope === 'self')
    ? Number(card.period?.label.match(/(\d{4})年/)?.[1]) : NaN
  const years = cards.map(year).filter(y => Number.isInteger(y) && y >= 1952 && y <= 2100)
  if (!years.length) return cards
  const current = new Map(annual3600Cards(input, Math.min(...years), Math.max(...years))
    .filter(card => Number.isInteger(year(card))).map(card => [year(card), card]))
  return cards.map(card => current.get(year(card)) ?? card)
}
