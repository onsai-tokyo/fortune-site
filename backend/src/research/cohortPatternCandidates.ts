import type { EventFact } from './eventPatternRules.js'
import { eventWindowDays, type EventStudyWindow } from './eventPatternStudy.js'

export type DatePrecision = 'day' | 'month' | 'year'
export interface CohortObservation {
  id: string; personID: string; independenceUnit?: string; category: string; precision: DatePrecision
  window: EventStudyWindow; facts: EventFact[]
}
export interface CandidateFeature {
  key: string; label: string; system: EventFact['system']; group: EventFact['group']
  lineage: string; days: string[]
}
export const COHORT_CANDIDATE_POLICY = {
  version: 'cohort-pattern-candidates-v1', productionEligible: false, trainingEligible: false,
  qualityEligible: false, status: 'retrospective_candidate', probability: null,
  interpretation: 'Observed co-occurrence in supplied event windows; no non-event denominator or predictive validation',
} as const

/** Preserve precision; never turn the publication date into the occurrence date. */
export function occurrenceWindow(year: string, date: string): { window: EventStudyWindow; precision: DatePrecision } {
  if (!/^\d{4}$/.test(year)) throw new RangeError('Occurrence year required')
  if (date && !new RegExp(`^${year}-\\d{2}(-\\d{2})?$`).test(date)) throw new RangeError('Occurrence date/year mismatch')
  const precision: DatePrecision = !date ? 'year' : date.length === 7 ? 'month' : 'day'
  const from = !date ? `${year}-01-01` : date.length === 7 ? `${date}-01` : date
  const start = new Date(`${from}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== from) throw new RangeError('Invalid occurrence date')
  const end = new Date(start)
  if (precision === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1)
  else if (precision === 'month') end.setUTCMonth(end.getUTCMonth() + 1)
  else end.setUTCDate(end.getUTCDate() + 1)
  const window = { from, until: end.toISOString().slice(0, 10) }
  eventWindowDays(window)
  return { window, precision }
}

/** General chart predicates: no person IDs, birth dates, event years or outcome text. */
export function candidateFeatures(facts: readonly EventFact[]): CandidateFeature[] {
  return facts.flatMap(f => {
    const base = { system: f.system, group: f.group, lineage: f.lineage, days: [...new Set(f.days)].sort() }
    if (!base.days.length) return []
    if (f.kind === 'western_transit' && f.transit && f.natal && f.aspect !== undefined) {
      // Opposite ends of an axis describe the same geometry, not two discoveries.
      const natal = f.natal === 'DESC' ? 'ASC' : f.natal === 'IC' ? 'MC' : f.natal
      const aspect = ['DESC','IC'].includes(f.natal) ? 180 - f.aspect : f.aspect
      const key = `western:${f.transit}:${natal}:${aspect}`
      return [{ ...base, lineage:key, key, label: `西洋 ${f.transit}→出生${natal} ${aspect}°` }]
    }
    if (f.kind === 'calendar_relation') {
      const scope = f.id.split(':')[1]
      if (!['year', 'month'].includes(scope)) return []
      if (f.id === `sanmei:${scope}:chusatsu`) return [{ ...base, key:f.id,
        label:`算命学 ${scope === 'year' ? '年' : '月'}運が出生天中殺の支に入る` }]
      const relation = f.detail.match(/：(冲|破|六合)(?:$|。)/)?.[1]
      const god = f.detail.match(/：(偏官|正官|偏財|正財)。/)?.[1]
      if (!relation && !god) return []
      return [{ ...base, key: `calendar:${scope}:${relation ?? god}`, label: `干支 ${scope === 'year' ? '年' : '月'}運 ${relation ? `日支と${relation}` : god}` }]
    }
    if (f.kind === 'vedic_period' && f.period) return [
      { ...base, key: `vedic:period:${f.period.major}:${f.period.minor}`, label: `インド ${f.period.major}/${f.period.minor}期` },
      ...(f.houses ?? []).map(h => ({ ...base, key: `vedic:minor-lord-house:${h}`, label: `インド 副期星が第${h}室を支配` })),
    ]
    if (f.kind === 'ziwei_palace' && f.palace)
      return [{ ...base, key: `ziwei:life:${f.palace}`, label: `紫微 流年命宮→本命${f.palace}宮` }]
    if (f.kind === 'ziwei_mutagen' && f.palace && f.mutagen) {
      const star = f.id.split(':')[2]
      if (!star) return []
      return [{ ...base, key: `ziwei:${star}:${f.mutagen}:${f.palace}`, label: `紫微 ${star}${f.mutagen}→本命${f.palace}宮` }]
    }
    return []
  })
}

export interface CandidatePredicate { allOf: string[] }
/** Candidate applicability depends on computed facts alone. Same-day intersection is mandatory. */
export function matchCandidate(predicate: CandidatePredicate, facts: readonly EventFact[]): string[] {
  if (!predicate.allOf.length || predicate.allOf.length > 2 || new Set(predicate.allOf).size !== predicate.allOf.length) throw new Error('Expected one or two distinct predicates')
  const features = candidateFeatures(facts)
  const matches = predicate.allOf.map(key => features.filter(f => f.key === key))
  const days = [...new Set(matches[0].flatMap(f => f.days))]
  return days.filter(day => matches.length === 1 || matches[0].some(a => a.days.includes(day)
    && matches[1].some(b => b.days.includes(day) && a.lineage !== b.lineage))).sort()
}

/** Enumerate singles and pairs, then join observed outcomes. No fitted weights or orb changes. */
export function mineCohortCandidates(observations: readonly CohortObservation[]) {
  const ids = new Set<string>(), events = new Set<string>()
  const registry = new Map<string, {
    allOf: string[]; labels: string[]; systems: string[]; groups: string[]
    supports: Array<{ eventID: string; personID: string; independenceUnit: string; category: string; precision: DatePrecision; overlapDayCount: number; firstDay: string; lastDay: string; windowDays: number }>
  }>()
  for (const event of observations) {
    if (ids.has(event.id)) throw new Error('Duplicate observation ID')
    ids.add(event.id)
    const eventKey = JSON.stringify([event.personID, event.category, event.window])
    if (events.has(eventKey)) continue // Syndicated rows cannot inflate an event.
    events.add(eventKey)
    const days = eventWindowDays(event.window), allowed = new Set(days)
    if (event.facts.some(f => f.days.some(day => !allowed.has(day)))) throw new Error('Fact outside observation window')
    const byKey = new Map<string, CandidateFeature[]>()
    for (const f of candidateFeatures(event.facts)) byKey.set(f.key, [...(byKey.get(f.key) ?? []), f])
    const features = [...byKey].sort(([a], [b]) => a.localeCompare(b))
    const daySets = new Map(features.flatMap(([, fs]) => fs.map(f => [f, new Set(f.days)] as const)))
    const register = (a: typeof features[number], b?: typeof features[number]) => {
      const chosen = b ? [a, b] : [a]
      // Do not count two interpretations of one underlying fact as a pair.
      const activeDays = days.filter(day => {
        const left = a[1].filter(f => daySets.get(f)!.has(day))
        if (!b) return left.length > 0
        return left.some(l => b[1].some(r => daySets.get(r)!.has(day) && l.lineage !== r.lineage))
      })
      if (!activeDays.length) return
      const allOf = chosen.map(([key]) => key), key = JSON.stringify(allOf)
      const row = registry.get(key) ?? { allOf, labels: chosen.map(([, fs]) => fs[0].label),
        systems: [...new Set(chosen.map(([, fs]) => fs[0].system))], groups: [...new Set(chosen.map(([, fs]) => fs[0].group))], supports: [] }
      row.supports.push({ eventID: event.id, personID: event.personID, independenceUnit: event.independenceUnit ?? event.personID, category: event.category, precision: event.precision,
        overlapDayCount: activeDays.length, firstDay: activeDays[0], lastDay: activeDays.at(-1)!, windowDays: days.length })
      registry.set(key, row)
    }
    features.forEach((a, i) => { register(a); features.slice(i + 1).forEach(b => register(a, b)) })
  }
  const candidates = [...registry].map(([id, row]) => {
    const categories = [...new Set(row.supports.map(s => s.category))].sort().map(category => {
      const support = row.supports.filter(s => s.category === category)
      return { category, events: support.length, people: new Set(support.map(s => s.personID)).size,
        independenceUnits: new Set(support.map(s => s.independenceUnit)).size,
        precision: Object.fromEntries((['day', 'month', 'year'] as const).map(p => [p, {
          events: support.filter(s => s.precision === p).length,
          people: new Set(support.filter(s => s.precision === p).map(s => s.personID)).size,
        }])) }
    })
    return { id, ...row, ...COHORT_CANDIDATE_POLICY,
      people: new Set(row.supports.map(s => s.personID)).size, categories,
      hasOpposingRelationshipOutcomes: categories.some(c => ['結婚', '再婚'].includes(c.category)) && categories.some(c => ['離婚', '破局', '婚姻無効'].includes(c.category)),
    }
  }).sort((a, b) => a.id.localeCompare(b.id))
  return { ...COHORT_CANDIDATE_POLICY, enumeratedPatterns: candidates.length,
    // Discovery display filter, NOT a production score/threshold. All singles remain visible.
    reportingFilter: 'All singles; pairs observed for the same category in at least two distinct people and two declared family units (not proof of independence)',
    candidates: candidates.filter(c => c.allOf.length === 1 || c.categories.some(category => category.people >= 2 && category.independenceUnits >= 2)) }
}
