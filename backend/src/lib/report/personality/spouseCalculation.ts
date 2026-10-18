import { Solar } from 'lunar-javascript'
import calendarMetadata from 'lunar-javascript/package.json' with { type: 'json' }

const VERIFIED_LUNAR_VERSION = '1.7.7'
const calendarVersionVerified = !!calendarMetadata && typeof calendarMetadata === 'object'
  && (calendarMetadata as { version?: unknown }).version === VERIFIED_LUNAR_VERSION

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000
const JST_OFFSET_MS = 9 * 60 * MINUTE_MS
const CST_OFFSET_MS = 8 * 60 * MINUTE_MS
const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const DAY_PILLARS = new Set(Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]))

// Adopted handoff convention, not the app's existing zero-based sanmei table.
// The handoff explicitly identifies 卯 and 申 day 10 as editorial repairs.
// Preserve their provenance, but do not produce a reading for those conditions.
const HIDDEN_STEMS: Record<string, ReadonlyArray<readonly [number, string]>> = {
  子: [[99, '癸']], 丑: [[9, '癸'], [12, '辛'], [99, '己']],
  寅: [[7, '戊'], [14, '丙'], [99, '甲']], 卯: [[99, '乙']],
  辰: [[9, '乙'], [12, '癸'], [99, '戊']], 巳: [[5, '戊'], [14, '庚'], [99, '丙']],
  午: [[19, '己'], [99, '丁']], 未: [[9, '丁'], [12, '乙'], [99, '己']],
  申: [[9, '戊'], [13, '壬'], [99, '庚']], 酉: [[99, '辛']],
  戌: [[9, '辛'], [12, '丁'], [99, '戊']], 亥: [[12, '甲'], [99, '壬']],
}
const TERM_NAMES: Record<string, string> = {
  小寒: '小寒', 立春: '立春', 惊蛰: '啓蟄', 清明: '清明', 立夏: '立夏', 芒种: '芒種',
  小暑: '小暑', 立秋: '立秋', 白露: '白露', 寒露: '寒露', 立冬: '立冬', 大雪: '大雪',
}
const PRIMARY_STARS: Record<string, string> = {
  比肩: '貫索星', 劫財: '石門星', 食神: '鳳閣星', 傷官: '調舒星', 偏財: '禄存星',
  正財: '司禄星', 偏官: '車騎星', 正官: '牽牛星', 偏印: '龍高星', 印綬: '玉堂星',
}

// Cross-library audit: 2,412 terms in 1900–2100 (also covering 1952–2100)
// differ by at most 54.407 s from corrected sxtwl 2.0.7. This finite audit
// motivates an operational hold margin, not a universal astronomy error bound.
export const SPOUSE_BOUNDARY_SAFETY_SECONDS = 60
export const SPOUSE_METHOD_VERSION = `spouse-nijuhachigen-v1|JST-1952-2100|day00|elapsed24h-floor+1|minute|guard60s|withhold-mao-shen10|lunar${VERIFIED_LUNAR_VERSION}`
export const SPOUSE_METHOD_ASSUMPTIONS = [
  'The received day-limit table has one cited source; this reproduces the adopted convention, not a claim of consensus between schools.',
  'The received 卯=乙 and 申 nth_day=10→壬 entries are editorial repairs and are withheld pending source verification.',
  'Solar-term wall times from lunar-javascript are China standard time (UTC+08); convert that instant to JST (UTC+09).',
  'Birth time is a one-minute interval. Solar-term and hidden-stem boundaries also carry the versioned safety margin.',
] as const

export type SpousePendingReason =
  | 'missing_birth_date' | 'missing_birth_time' | 'missing_time_zone'
  | 'invalid_birth_date' | 'invalid_birth_time' | 'unsupported_time_zone' | 'unsupported_birth_date'
  | 'invalid_day_pillar' | 'day_pillar_mismatch' | 'boundary_uncertain'
  | 'unresolved_table_convention' | 'calendar_unavailable'

export interface SpouseCalculationInput {
  birthDate?: string | null
  /** HH:mm, a recorded minute; seconds are not silently invented as known. */
  birthTime?: string | null
  /** Must be supplied by a trusted birthplace/time-zone resolver. No default. */
  timeZone?: string | null
  expectedDayPillar?: string | null
}
export interface SpouseCalculationTrace {
  timeZone: 'Asia/Tokyo'
  birthMinuteStartJst: string
  birthMinuteEndExclusiveJst: string
  dayPillar: string
  setsuName: string
  setsuAtJst: string
  nextSetsuAtJst: string
  elapsedDays: number
  nthDay: number
  boundarySafetySeconds: number
  assumptions: readonly string[]
  hiddenStem?: string
  relation?: string
  sameYinYang?: boolean
  primaryStar?: string
  boundary?: { kind: 'solar_term' | 'hidden_stem' | 'table_convention'; atJst: string }
}
export type SpouseCalculationResult =
  | { status: 'ready'; methodVersion: string; star: string; branch: string; dayPillar: string; calculation: SpouseCalculationTrace }
  | { status: 'pending'; reason: SpousePendingReason; methodVersion: string; calculation?: SpouseCalculationTrace }

// These exact-time APIs exist in the installed 1.7.7 runtime but are absent
// from this repository's intentionally small lunar-javascript declaration.
interface CalendarSolar {
  getYear(): number; getMonth(): number; getDay(): number
  getHour(): number; getMinute(): number; getSecond(): number
}
interface CalendarJie { getName(): string; getSolar(): CalendarSolar }
interface CalendarLunar {
  getDayInGanZhi(): string
  getPrevJie(wholeDay: boolean): CalendarJie | null
  getNextJie(wholeDay: boolean): CalendarJie | null
}
const pending = (reason: SpousePendingReason, calculation?: SpouseCalculationTrace): SpouseCalculationResult => ({
  status: 'pending', reason, methodVersion: SPOUSE_METHOD_VERSION, ...(calculation ? { calculation } : {}),
})
function jstIso(instant: number): string {
  return new Date(instant + JST_OFFSET_MS).toISOString().replace(/\.\d{3}Z$/, '+09:00')
}
function calendarInstant(solar: CalendarSolar): number {
  return Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()) - CST_OFFSET_MS
}
function tenGod(dayStem: string, targetStem: string) {
  const a = STEMS.indexOf(dayStem), b = STEMS.indexOf(targetStem)
  const elementA = Math.floor(a / 2), elementB = Math.floor(b / 2)
  const sameYinYang = a % 2 === b % 2
  const difference = (elementB - elementA + 5) % 5
  const pair = [
    ['比肩', '劫財', '同五行'], ['食神', '傷官', '日干が生じる'],
    ['偏財', '正財', '日干が剋す'], ['偏官', '正官', '日干を剋す'], ['偏印', '印綬', '日干を生じる'],
  ][difference]
  return { star: pair[sameYinYang ? 0 : 1], relation: pair[2], sameYinYang }
}

/** Independent spouse convention; never changes the existing chart or timing engines. */
export function calculateSpouse(input: SpouseCalculationInput): SpouseCalculationResult {
  if (input.birthDate == null || input.birthDate === '') return pending('missing_birth_date')
  if (input.birthTime == null || input.birthTime === '') return pending('missing_birth_time')
  if (input.timeZone == null || input.timeZone === '') return pending('missing_time_zone')
  if (typeof input.birthDate !== 'string') return pending('invalid_birth_date')
  if (typeof input.birthTime !== 'string') return pending('invalid_birth_time')
  if (typeof input.timeZone !== 'string') return pending('unsupported_time_zone')
  if (input.timeZone !== 'Asia/Tokyo') return pending('unsupported_time_zone')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) return pending('invalid_birth_date')
  const [year, month, day] = input.birthDate.split('-').map(Number)
  const localDate = new Date(Date.UTC(year, month - 1, day))
  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() + 1 !== month || localDate.getUTCDate() !== day) return pending('invalid_birth_date')
  // Before 1952, Japanese civil time includes historical summer-time cases.
  // They need a separate policy; do not quietly treat them as constant JST.
  if (year < 1952 || year > 2100) return pending('unsupported_birth_date')
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)) return pending('invalid_birth_time')
  if (input.expectedDayPillar != null && !DAY_PILLARS.has(input.expectedDayPillar)) return pending('invalid_day_pillar')
  // The term comparison and boundary margin apply only to the verified release.
  // A package upgrade must not silently inherit that method/version claim.
  if (!calendarVersionVerified) return pending('calendar_unavailable')
  const [hour, minute] = input.birthTime.split(':').map(Number)
  const birthStart = Date.UTC(year, month - 1, day, hour, minute) - JST_OFFSET_MS
  const birthEnd = birthStart + MINUTE_MS // exclusive
  try {
    // Civil-date GanZhi explicitly uses the local JST date, not the CST term
    // cursor nor the 23:00-switching EightChar exact-day method.
    const localLunar = Solar.fromYmdHms(year, month, day, 12, 0, 0).getLunar() as unknown as CalendarLunar
    const dayPillar = localLunar.getDayInGanZhi()
    if (!DAY_PILLARS.has(dayPillar)) return pending('calendar_unavailable')
    if (input.expectedDayPillar != null && input.expectedDayPillar !== dayPillar) return pending('day_pillar_mismatch')
    const cst = new Date(birthStart + CST_OFFSET_MS)
    const lunar = Solar.fromYmdHms(cst.getUTCFullYear(), cst.getUTCMonth() + 1, cst.getUTCDate(), cst.getUTCHours(), cst.getUTCMinutes(), 0).getLunar() as unknown as CalendarLunar
    const previous = lunar.getPrevJie(false), next = lunar.getNextJie(false)
    if (!previous || !next || !TERM_NAMES[previous.getName()] || !TERM_NAMES[next.getName()]) return pending('calendar_unavailable')
    const setsuAt = calendarInstant(previous.getSolar()), nextSetsuAt = calendarInstant(next.getSolar())
    if (!Number.isFinite(setsuAt) || !Number.isFinite(nextSetsuAt) || setsuAt > birthStart || nextSetsuAt <= birthStart
      || nextSetsuAt - setsuAt < 25 * DAY_MS || nextSetsuAt - setsuAt > 33 * DAY_MS) return pending('calendar_unavailable')
    const elapsedDays = (birthStart - setsuAt) / DAY_MS
    const nthDay = Math.floor(elapsedDays) + 1
    const branch = dayPillar[1]
    const trace: SpouseCalculationTrace = {
      timeZone: 'Asia/Tokyo', birthMinuteStartJst: jstIso(birthStart), birthMinuteEndExclusiveJst: jstIso(birthEnd),
      dayPillar, setsuName: TERM_NAMES[previous.getName()], setsuAtJst: jstIso(setsuAt), nextSetsuAtJst: jstIso(nextSetsuAt),
      elapsedDays, nthDay, boundarySafetySeconds: SPOUSE_BOUNDARY_SAFETY_SECONDS, assumptions: [...SPOUSE_METHOD_ASSUMPTIONS],
    }
    const safetyMs = SPOUSE_BOUNDARY_SAFETY_SECONDS * 1000
    const touches = (at: number) => birthStart <= at + safetyMs && birthEnd > at - safetyMs
    const solarBoundary = [setsuAt, nextSetsuAt].find(touches)
    if (solarBoundary !== undefined) return pending('boundary_uncertain', { ...trace, boundary: { kind: 'solar_term', atJst: jstIso(solarBoundary) } })
    const stemBoundary = HIDDEN_STEMS[branch].filter(([limit]) => limit !== 99).map(([limit]) => setsuAt + limit * DAY_MS)
      .filter(at => at < nextSetsuAt).find(touches)
    if (stemBoundary !== undefined) return pending('boundary_uncertain', { ...trace, boundary: { kind: 'hidden_stem', atJst: jstIso(stemBoundary) } })
    // Day 10→11 changes source eligibility even though the repaired table
    // shows 壬 on both sides. Guard that decision boundary as well.
    const conventionBoundary = setsuAt + 10 * DAY_MS
    if (branch === '申' && conventionBoundary < nextSetsuAt && touches(conventionBoundary)) {
      return pending('boundary_uncertain', { ...trace, boundary: { kind: 'table_convention', atJst: jstIso(conventionBoundary) } })
    }
    if (branch === '卯' || (branch === '申' && nthDay === 10)) return pending('unresolved_table_convention', trace)
    const hiddenStem = HIDDEN_STEMS[branch].find(([limit]) => nthDay <= limit)?.[1]
    if (!hiddenStem) return pending('calendar_unavailable', trace)
    const { star, relation, sameYinYang } = tenGod(dayPillar[0], hiddenStem)
    return { status: 'ready', methodVersion: SPOUSE_METHOD_VERSION, star, branch, dayPillar,
      calculation: { ...trace, hiddenStem, relation, sameYinYang, primaryStar: PRIMARY_STARS[star] } }
  } catch {
    return pending('calendar_unavailable')
  }
}
