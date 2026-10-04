/** Life-event kinds and the canonical event list (no dependencies, so signals.ts and events.ts can both use it). */
export const EVENT_KINDS = ['encounter', 'start', 'reunion', 'marriage', 'breakup', 'divorce', 'job', 'study', 'move', 'other'] as const
export type EventKind = typeof EVENT_KINDS[number]
export interface LifeEvent { year: number; month?: number; kind: EventKind }

/** Valid events only (year in [birthYear, maxYear], month 1-12 or absent, known kind), deduplicated and sorted. */
export function canonicalLifeEvents(list: unknown, birthYear: number, maxYear = 2100): LifeEvent[] {
  if (!Array.isArray(list)) return []
  const out: LifeEvent[] = []
  for (const x of list) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const year = Number(o.year), month = o.month === undefined || o.month === null ? undefined : Number(o.month)
    if (!Number.isInteger(year) || year < birthYear || year > maxYear) continue
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) continue
    if (typeof o.kind !== 'string' || !(EVENT_KINDS as readonly string[]).includes(o.kind)) continue
    const e: LifeEvent = { year, ...(month ? { month } : {}), kind: o.kind as EventKind }
    if (!out.some(z => z.year === e.year && z.month === e.month && z.kind === e.kind)) out.push(e)
  }
  return out.sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || EVENT_KINDS.indexOf(a.kind) - EVENT_KINDS.indexOf(b.kind))
}
