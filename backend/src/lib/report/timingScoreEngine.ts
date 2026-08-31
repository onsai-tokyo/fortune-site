import { TIMING_SCORE_KEYS, type TimingScoreKey } from './timingClaim.js'
import { assertCanonicalEvidenceIdentity } from './timingEvidenceContract.js'

export type SourceFamily = 'western' | 'vedic' | 'stem_branch' | 'ziwei' | 'auxiliary'
export type CorrelationGroup = 'astronomical_ephemeris' | 'stem_branch_calendar' | 'ziwei_chart' | 'independent_auxiliary'

export const SOURCE_FAMILY_WEIGHTS: Readonly<Record<SourceFamily, number>> = {
  western: 0.24,
  vedic: 0.24,
  stem_branch: 0.24,
  ziwei: 0.23,
  auxiliary: 0.05,
}

export interface TimingEvidenceDefinition {
  id: string
  scoreKey: TimingScoreKey
  sourceFamily: SourceFamily
  technique: string
  /** 同じ占術事実を別名で二重加点しないための安定ID。 */
  factLineageId: string
  correlationGroup: CorrelationGroup
  /** この入力で計算可能か。時刻不明などは false。 */
  available: boolean
  /** Evidence が実際に成立したか。 */
  matched: boolean
  /** 成立強度（0〜1）。 */
  support: number
  /** このEvidenceが持つ理論寄与。Family上限以下で定義する。 */
  maximumContribution: number
  /** 1は支持、-1は反証。省略時は支持として後方互換を保つ。 */
  polarity?: 1 | -1
  /** ナクシャトラ当日切替など、当該Evidenceだけへ掛ける係数。 */
  quality?: number
  detail?: string
}

export interface TimingEvidence {
  id: string
  sourceFamily: SourceFamily
  correlationGroup: CorrelationGroup
  /** Phase 2 scorerからの診断情報。人工fixtureとの後方互換のため任意。 */
  factLineageId?: string
  technique?: string
  contribution?: number
  polarity?: 1 | -1
  detail?: string
}

export interface TimingScoreResult {
  key: TimingScoreKey
  rawSupport: number
  relativeStrength: number
  confidence: number
  sourceFamilyCount: number
  correlationGroupCount: number
  familyContributions: Partial<Record<SourceFamily, number>>
  evidence: readonly TimingEvidence[]
}

export interface TimingScoreQuality {
  /** 計算可能だが、申告時刻が境界付近・概数など精度だけが落ちる場合。時刻欠損には使わない。 */
  birthTimePrecision?: number
  /** 計算可能だが、都道府県庁代表座標など位置精度だけが落ちる場合。出生地欠損には使わない。 */
  locationPrecision?: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const SOURCE_FAMILIES = Object.keys(SOURCE_FAMILY_WEIGHTS) as SourceFamily[]
const CORRELATION_GROUPS: readonly CorrelationGroup[] = ['astronomical_ephemeris', 'stem_branch_calendar', 'ziwei_chart', 'independent_auxiliary']
const SCORE_KEYS = new Set<string>(TIMING_SCORE_KEYS)
const SOURCE_FAMILY_SET = new Set<string>(SOURCE_FAMILIES)
const CORRELATION_GROUP_SET = new Set<string>(CORRELATION_GROUPS)

function assertFiniteRange(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a finite number in [${min}, ${max}]: ${String(value)}`)
  }
}

function validateEvidence(item: TimingEvidenceDefinition): void {
  if (!SCORE_KEYS.has(item.scoreKey)) throw new TypeError(`${item.id}.scoreKey is unknown: ${String(item.scoreKey)}`)
  if (!SOURCE_FAMILY_SET.has(item.sourceFamily)) throw new TypeError(`${item.id}.sourceFamily is unknown: ${String(item.sourceFamily)}`)
  if (!CORRELATION_GROUP_SET.has(item.correlationGroup)) throw new TypeError(`${item.id}.correlationGroup is unknown: ${String(item.correlationGroup)}`)
  if (typeof item.available !== 'boolean' || typeof item.matched !== 'boolean') throw new TypeError(`${item.id}.available and matched must be booleans`)
  if (!item.available && (item.matched || item.support > 0)) throw new TypeError(`${item.id} cannot be matched or supported when unavailable`)
  if (!item.matched && item.support > 0) throw new TypeError(`${item.id} cannot have support when unmatched`)
  if (!item.id.trim() || !item.factLineageId.trim() || !item.technique.trim()) throw new TypeError('Timing evidence identifiers must not be empty')
  assertCanonicalEvidenceIdentity(item.id, item.sourceFamily, item.correlationGroup, item.technique, item.factLineageId)
  assertFiniteRange(`${item.id}.support`, item.support, 0, 1)
  assertFiniteRange(`${item.id}.quality`, item.quality ?? 1, 0, 1)
  assertFiniteRange(`${item.id}.maximumContribution`, item.maximumContribution, 0, SOURCE_FAMILY_WEIGHTS[item.sourceFamily])
  if (item.polarity !== undefined && item.polarity !== 1 && item.polarity !== -1) throw new TypeError(`${item.id}.polarity must be 1 or -1`)
}

function validateEvidenceSet(definitions: readonly TimingEvidenceDefinition[]): void {
  const ids = new Set<string>()
  for (const item of definitions) {
    validateEvidence(item)
    if (ids.has(item.id)) throw new TypeError(`Duplicate timing evidence id: ${item.id}`)
    ids.add(item.id)
  }
}

const lineagePolarityKey = (item: TimingEvidenceDefinition) => `${item.factLineageId}\u0000${item.polarity ?? 1}`
const realizedContribution = (item: TimingEvidenceDefinition) => Math.max(0, item.maximumContribution) * clamp01(item.support) * clamp01(item.quality ?? 1)
const stableEvidenceKey = (item: TimingEvidenceDefinition) => `${item.id}\u0000${item.detail ?? ''}`
const shouldReplace = (previous: TimingEvidenceDefinition, candidate: TimingEvidenceDefinition, metric: (item: TimingEvidenceDefinition) => number) => {
  const difference = metric(candidate) - metric(previous)
  return difference > 0 || (difference === 0 && stableEvidenceKey(candidate) < stableEvidenceKey(previous))
}

/** 成立済みEvidence用。同一lineage・同一極性では実寄与が最大の表現だけを残す。 */
function uniqueLineagesForSupport(items: readonly TimingEvidenceDefinition[]): TimingEvidenceDefinition[] {
  const byLineage = new Map<string, TimingEvidenceDefinition>()
  for (const item of items) {
    const normalized = { ...item, support: clamp01(item.support), quality: clamp01(item.quality ?? 1) }
    const key = lineagePolarityKey(normalized)
    const previous = byLineage.get(key)
    if (!previous || shouldReplace(previous, normalized, realizedContribution)) byLineage.set(key, normalized)
  }
  return [...byLineage.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([, item]) => item)
}

/** 理論最大値用。support/qualityには依存せず最大寄与の定義だけを残す。 */
function uniqueLineagesForPotential(items: readonly TimingEvidenceDefinition[]): TimingEvidenceDefinition[] {
  const byLineage = new Map<string, TimingEvidenceDefinition>()
  for (const item of items) {
    const key = lineagePolarityKey(item)
    const previous = byLineage.get(key)
    if (!previous || shouldReplace(previous, item, candidate => candidate.maximumContribution)) byLineage.set(key, item)
  }
  return [...byLineage.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([, item]) => item)
}

function familyPotential(items: readonly TimingEvidenceDefinition[], family: SourceFamily, mode: 'full' | 'available'): number {
  // 反証は成立時に支持を減らすものであり、到達可能な正の最大値には加えない。
  const eligible = uniqueLineagesForPotential(items.filter(item => item.sourceFamily === family && (item.polarity ?? 1) > 0 && (mode === 'full' || item.available)))
  return Math.min(SOURCE_FAMILY_WEIGHTS[family], eligible.reduce((sum, item) => sum + Math.max(0, item.maximumContribution), 0))
}

function familySupport(items: readonly TimingEvidenceDefinition[], family: SourceFamily): { value: number; evidence: TimingEvidence[] } {
  const matched = uniqueLineagesForSupport(items.filter(item => item.sourceFamily === family && item.available && item.matched))
  const weight = SOURCE_FAMILY_WEIGHTS[family]
  const signed = matched.map(item => ({ item, value: Math.max(0, item.maximumContribution) * item.support * (item.quality ?? 1) * (item.polarity ?? 1) }))
  const positiveSupport = signed.reduce((sum, entry) => sum + Math.max(0, entry.value), 0)
  const negativeSupport = signed.reduce((sum, entry) => sum + Math.min(0, entry.value), 0)
  const scale = positiveSupport > weight ? weight / positiveSupport : 1
  // スコアは「支持の強さ」であり負値を持たない。反証は同じfamilyの支持までを
  // 相殺するが、独立した別familyの支持を減算する用途には使わない。
  const value = clamp01(Math.min(weight, positiveSupport) + negativeSupport)
  return {
    value,
    evidence: signed.map(({ item, value: signedValue }) => ({
      id: item.id,
      sourceFamily: item.sourceFamily,
      correlationGroup: item.correlationGroup,
      factLineageId: item.factLineageId,
      technique: item.technique,
      contribution: signedValue > 0 ? signedValue * scale : signedValue,
      polarity: item.polarity ?? 1,
      ...(item.detail === undefined ? {} : { detail: item.detail }),
    })),
  }
}

function combineFamilies(values: Partial<Record<SourceFamily, number>>): number {
  const western = values.western ?? 0
  const vedic = values.vedic ?? 0
  return Math.max(western, vedic) + 0.6 * Math.min(western, vedic)
    + (values.stem_branch ?? 0) + (values.ziwei ?? 0) + (values.auxiliary ?? 0)
}

export function computeTimingScore(
  key: TimingScoreKey,
  definitions: readonly TimingEvidenceDefinition[],
  quality: TimingScoreQuality = {},
): TimingScoreResult {
  if (!SCORE_KEYS.has(key)) throw new TypeError(`Unknown requested timing score key: ${String(key)}`)
  validateEvidenceSet(definitions)
  const allowedQualityKeys = new Set(['birthTimePrecision', 'locationPrecision'])
  for (const key of Object.keys(quality)) if (!allowedQualityKeys.has(key)) throw new TypeError(`Unknown timing quality key: ${key}`)
  assertFiniteRange('quality.birthTimePrecision', quality.birthTimePrecision ?? 1, 0, 1)
  assertFiniteRange('quality.locationPrecision', quality.locationPrecision ?? 1, 0, 1)
  const relevant = definitions.filter(item => item.scoreKey === key)
  const families = SOURCE_FAMILIES
  const full = Object.fromEntries(families.map(family => [family, familyPotential(relevant, family, 'full')])) as Record<SourceFamily, number>
  const available = Object.fromEntries(families.map(family => [family, familyPotential(relevant, family, 'available')])) as Record<SourceFamily, number>
  const support = Object.fromEntries(families.map(family => [family, familySupport(relevant, family)])) as Record<SourceFamily, ReturnType<typeof familySupport>>
  const familyContributions = Object.fromEntries(families.filter(family => support[family].value > 0).map(family => [family, support[family].value])) as Partial<Record<SourceFamily, number>>
  const rawSupport = combineFamilies(familyContributions)
  const fullMax = combineFamilies(full)
  const availableMax = combineFamilies(available)
  const evidence = families.flatMap(family => support[family].evidence)
  const activeFamilies = families.filter(family => (familyContributions[family] ?? 0) > 0)
  const activeGroups = new Set(evidence.filter(item => (item.contribution ?? 0) > 0 && activeFamilies.includes(item.sourceFamily)).map(item => item.correlationGroup))
  const availableGroups = new Set(uniqueLineagesForPotential(relevant.filter(item => item.available && (item.polarity ?? 1) > 0 && item.maximumContribution > 0)).map(item => item.correlationGroup))
  let sourceDiversity = availableGroups.size ? activeGroups.size / availableGroups.size : 0
  if (activeFamilies.includes('stem_branch') && activeFamilies.includes('ziwei')) sourceDiversity *= 0.85
  const evidenceQuality = clamp01(quality.birthTimePrecision ?? 1) * clamp01(quality.locationPrecision ?? 1)
  const coverage = fullMax ? availableMax / fullMax : 0
  return {
    key,
    rawSupport,
    relativeStrength: availableMax ? clamp01(rawSupport / availableMax) : 0,
    confidence: clamp01(coverage * evidenceQuality * sourceDiversity),
    sourceFamilyCount: activeFamilies.length,
    correlationGroupCount: activeGroups.size,
    familyContributions,
    evidence,
  }
}

export function computeTimingScores(
  definitions: readonly TimingEvidenceDefinition[],
  quality: TimingScoreQuality = {},
): Readonly<Record<TimingScoreKey, TimingScoreResult>> {
  return Object.fromEntries(TIMING_SCORE_KEYS.map(key => [key, computeTimingScore(key, definitions, quality)])) as Record<TimingScoreKey, TimingScoreResult>
}
