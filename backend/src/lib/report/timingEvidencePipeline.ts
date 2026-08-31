import { calcAstrology, calcTimeIndependentVedicAnnualDasha, calcTimeIndependentWesternAnnualAspects, calcVedicAnnualDasha } from '../astrology.js'
import { calcTimingCycles } from '../divination/index.js'
import { calcZiwei } from '../ziwei.js'
import type { TimingEvidenceDefinition } from './timingScoreEngine.js'
import { computeTimingScores, type TimingScoreQuality, type TimingScoreResult } from './timingScoreEngine.js'
import type { TimingScoreKey } from './timingClaim.js'
import { buildStemBranchTimingEvidence } from './timingStemBranchEvidence.js'
import { buildVedicTimingEvidence } from './timingVedicEvidence.js'
import { buildWesternTimingEvidence } from './timingWesternEvidence.js'
import { buildZiweiTimingEvidence, type ZiweiAnnualTimingInput } from './timingZiweiEvidence.js'

export interface TimingEvidenceBirthInput {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour?: number
  birthMinute?: number
  gender: 'male' | 'female'
  birthplace: string
}

export interface TimingEvidenceTimeline {
  hasBirthTime: boolean
  years: readonly number[]
  byYear: ReadonlyMap<number, readonly TimingEvidenceDefinition[]>
}

export interface TimingScoreTimeline extends TimingEvidenceTimeline {
  scoresByYear: ReadonlyMap<number, Readonly<Record<TimingScoreKey, TimingScoreResult>>>
}

const merge = (...groups: Array<readonly TimingEvidenceDefinition[] | undefined>) => groups.flatMap(group => group ?? [])

export function assertTimingEvidenceBirthInput(input: TimingEvidenceBirthInput, referenceToday: Date = new Date()): void {
  if (!input || typeof input !== 'object') throw new TypeError('birth input must be an object')
  if (!(referenceToday instanceof Date) || !Number.isFinite(referenceToday.getTime())) throw new TypeError('referenceToday must be a valid Date')
  const jst = new Date(referenceToday.getTime() + 9 * 60 * 60 * 1000)
  const currentYear = jst.getUTCFullYear()
  if (!Number.isInteger(input.birthYear) || input.birthYear < 1900 || input.birthYear > currentYear) {
    throw new RangeError(`birthYear must be an integer in [1900, ${currentYear}]: ${String(input.birthYear)}`)
  }
  if (!Number.isInteger(input.birthMonth) || input.birthMonth < 1 || input.birthMonth > 12) {
    throw new RangeError(`birthMonth must be an integer in [1, 12]: ${String(input.birthMonth)}`)
  }
  if (!Number.isInteger(input.birthDay) || input.birthDay < 1 || input.birthDay > 31) {
    throw new RangeError(`birthDay must be an integer in [1, 31]: ${String(input.birthDay)}`)
  }
  const date = new Date(Date.UTC(input.birthYear, input.birthMonth - 1, input.birthDay))
  if (date.getUTCFullYear() !== input.birthYear || date.getUTCMonth() !== input.birthMonth - 1 || date.getUTCDate() !== input.birthDay) {
    throw new RangeError(`birth date does not exist: ${input.birthYear}-${input.birthMonth}-${input.birthDay}`)
  }
  const todayNumber = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate())
  if (date.getTime() > todayNumber) throw new RangeError('birth date must not be in the future')
  if (input.gender !== 'male' && input.gender !== 'female') throw new TypeError(`gender must be male or female: ${String(input.gender)}`)
  if (typeof input.birthplace !== 'string') throw new TypeError('birthplace must be a string')
  if (input.birthHour === undefined) {
    if (input.birthMinute !== undefined) throw new RangeError('birthMinute requires birthHour')
    return
  }
  if (!Number.isInteger(input.birthHour) || input.birthHour < 0 || input.birthHour > 23) {
    throw new RangeError(`birthHour must be an integer in [0, 23]: ${String(input.birthHour)}`)
  }
  if (input.birthMinute !== undefined && (!Number.isInteger(input.birthMinute) || input.birthMinute < 0 || input.birthMinute > 59)) {
    throw new RangeError(`birthMinute must be an integer in [0, 59]: ${String(input.birthMinute)}`)
  }
}

/** Phase 2 の4系統を束ねるシャドー用入口。本番カード生成にはまだ接続しない。 */
export function buildTimingEvidenceTimeline(input: TimingEvidenceBirthInput): TimingEvidenceTimeline {
  assertTimingEvidenceBirthInput(input)
  const hasBirthTime = input.birthHour !== undefined
  const timing = calcTimingCycles(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0, input.gender)
  const stem = buildStemBranchTimingEvidence({
    birthYear: input.birthYear, birthMonth: input.birthMonth, birthDay: input.birthDay,
    birthHour: input.birthHour, birthMinute: input.birthMinute,
    annual: timing.annual, decades: timing.decades,
  })
  const westernBase = calcTimeIndependentWesternAnnualAspects(input.birthYear, input.birthMonth, input.birthDay)
  const fixedWestern = buildWesternTimingEvidence(westernBase)
  const vedic = buildVedicTimingEvidence(hasBirthTime
    ? calcVedicAnnualDasha(input.birthYear, input.birthMonth, input.birthDay, input.birthHour!, input.birthMinute ?? 0, input.birthplace)
    : calcTimeIndependentVedicAnnualDasha(input.birthYear, input.birthMonth, input.birthDay))

  let western = fixedWestern
  let ziwei: ReadonlyMap<number, readonly TimingEvidenceDefinition[]>
  if (hasBirthTime) {
    const astrology = calcAstrology(input.birthYear, input.birthMonth, input.birthDay, input.birthHour!, input.birthMinute ?? 0, input.birthplace)
    if (astrology.annual) {
      western = buildWesternTimingEvidence(astrology.annual.map(item => ({
        year: item.year,
        aspects: item.westernAspects.filter(aspect => !['ASC', 'DESC', 'MC', 'IC'].includes(aspect.natal)),
        angleAspects: item.westernAspects.filter(aspect => ['ASC', 'DESC', 'MC', 'IC'].includes(aspect.natal)),
      })), { hasBirthTime: astrology.anglesAvailable === true, personalPlanetsAvailable: true })
    }
    const chart = calcZiwei(input.birthYear, input.birthMonth, input.birthDay, input.birthHour!, input.gender, input.birthplace)
    if (!chart.available) throw new Error('時刻あり紫微斗数がありません')
    ziwei = buildZiweiTimingEvidence(chart.annual)
  } else {
    const unavailable = timing.annual.map(item => ({ year: item.year, activePalaces: [], mutagenPlacements: [] })) as ZiweiAnnualTimingInput[]
    ziwei = buildZiweiTimingEvidence(unavailable, false)
  }

  return {
    hasBirthTime,
    years: timing.annual.map(item => item.year),
    byYear: new Map(timing.annual.map(item => [item.year, merge(stem.get(item.year), western.get(item.year), vedic.get(item.year), ziwei.get(item.year))])),
  }
}

/** Evidenceと18スコアを同じ年キーで返す。カード選択への接続はPhase 2校正後に行う。 */
export function buildTimingScoreTimeline(
  input: TimingEvidenceBirthInput,
  quality: TimingScoreQuality = {},
): TimingScoreTimeline {
  const evidence = buildTimingEvidenceTimeline(input)
  return {
    ...evidence,
    scoresByYear: new Map(evidence.years.map(year => [year, computeTimingScores(evidence.byYear.get(year) ?? [], quality)])),
  }
}
