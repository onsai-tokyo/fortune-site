/** Developer-only calendar diagnostic. Does not score or compose a report.
 * Uses the existing lord order/durations and an explicitly declared 365.25-day
 * year. This convention is a review candidate, not a production canon change. */
const LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'] as const
const YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17] as const
const YEAR_MS = 365.25 * 86_400_000

interface Input {
  birthInstant: string | null
  siderealMoonLongitude: number | null
  sourceRef: string
  from: string
  until: string
}

function instant(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) throw new Error('Explicit valid time and offset required')
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error('Invalid instant')
  const localDate = value.slice(0, 10), [y, m, d] = localDate.split('-').map(Number)
  if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== localDate) throw new Error('Invalid calendar date')
  return time
}

export function diagnoseVimshottariInterval(input: Input) {
  const from = instant(input.from), until = instant(input.until)
  if (from >= until) throw new Error('Expected half-open interval')
  if (!input.sourceRef.trim()) throw new Error('Moon calculation provenance required')
  const policy = { qualityEligible: false as const, trainingEligible: false as const, productionEligible: false as const,
    method: 'Vimshottari major/minor; Lahiri input; 365.25-day year; half-open intervals', sourceRef: input.sourceRef }
  if (input.birthInstant === null || input.siderealMoonLongitude === null) {
    return { ...policy, available: false as const, reason: 'Exact birth instant and calculated sidereal Moon required', periods: [] }
  }
  const birth = instant(input.birthInstant), moon = input.siderealMoonLongitude
  if (!Number.isFinite(moon) || moon < 0 || moon >= 360) throw new Error('Invalid sidereal Moon')
  if (from < birth || until > birth + 120 * YEAR_MS) throw new Error('Diagnostic range must be within the first 120 years')
  const mansion = 360 / 27, first = Math.floor(moon / mansion) % 9
  let start = birth - ((moon % mansion) / mansion) * YEARS[first] * YEAR_MS
  const periods: Array<{ major: typeof LORDS[number]; minor: typeof LORDS[number]; start: string; end: string }> = []
  // At most one partial period plus a complete 120-year cycle is needed.
  for (let majorOffset = 0; majorOffset < 10 && start < until; majorOffset++) {
    const major = (first + majorOffset) % 9
    const end = start + YEARS[major] * YEAR_MS
    let subStart = start
    for (let minorOffset = 0; minorOffset < 9; minorOffset++) {
      const minor = (major + minorOffset) % 9
      const subEnd = minorOffset === 8 ? end : subStart + YEARS[major] * YEARS[minor] / 120 * YEAR_MS
      if (subStart < until && subEnd > from) periods.push({ major: LORDS[major], minor: LORDS[minor],
        start: new Date(Math.round(subStart)).toISOString(), end: new Date(Math.round(subEnd)).toISOString() })
      subStart = subEnd
    }
    start = end
  }
  return { ...policy, available: true as const, periods }
}
