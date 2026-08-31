import type { LifeEventKey } from './lifeEventLabels.js'
import type { SourceFamily, TimingEvidence, TimingScoreResult } from './timingScoreEngine.js'
export type { SourceFamily, TimingEvidence, TimingScoreResult } from './timingScoreEngine.js'
import {
  SCORE_BOUNDS,
  type HistoryKey,
  type RelationshipStatus,
  type ScoreGate,
  type ScoreLevel,
  type TimingClaimAsset,
  type TimingRuntimeContext,
  type TimingScoreKey,
  TRAIT_GATE_KEYS, type TraitGateKey,
  type TraitScoreGate,
  type WorkStatus,
} from './timingClaim.js'

export type PersonalityProfile = Readonly<Partial<Record<TraitGateKey, number>>>
const TRAIT_GATE_KEY_SET = new Set<string>(TRAIT_GATE_KEYS)

export interface LifeEventOccurrence {
  event: LifeEventKey
  occurrenceIndex: number
  clusterCount: number
  strength: 'strong' | 'possible'
}

export interface AnnualTimingProfile {
  year: number
  displayEvents: readonly LifeEventOccurrence[]
  activeDomains: ReadonlySet<LifeEventKey>
  scores?: Readonly<Partial<Record<TimingScoreKey, TimingScoreResult>>>
  traits?: PersonalityProfile
  relationshipStatus: RelationshipStatus
  workStatus: WorkStatus
  history: ReadonlySet<HistoryKey>
  context: TimingRuntimeContext
}

export interface TimingReportSelectionState {
  usedClaimIds: Set<string>
  semanticGroupLastUsedYear: Map<string, number>
  claimLastUsedYear: Map<string, number>
}

export interface LevelPolicy {
  relativeStrengthMin?: number
  relativeStrengthMax?: number
  minRawSupport?: number
  minConfidence?: number
  minSourceFamilies?: number
  minCorrelationGroups?: number
  confidenceCap?: number
}

const DEFAULT_LEVEL_POLICIES: Record<ScoreLevel, LevelPolicy> = {
  low: { relativeStrengthMax: SCORE_BOUNDS.low.value },
  medium: { relativeStrengthMin: SCORE_BOUNDS.medium.min, relativeStrengthMax: SCORE_BOUNDS.medium.max },
  medium_or_high: { relativeStrengthMin: SCORE_BOUNDS.medium_or_high.value },
  high: { relativeStrengthMin: SCORE_BOUNDS.high.value },
  very_high: { relativeStrengthMin: SCORE_BOUNDS.very_high.value },
}

function policiesFor(overrides: Partial<Record<ScoreLevel, LevelPolicy>> = {}): Record<ScoreLevel, LevelPolicy> {
  return Object.fromEntries(Object.entries(DEFAULT_LEVEL_POLICIES).map(([level, base]) => [
    level,
    { ...base, ...(overrides[level as ScoreLevel] ?? {}) },
  ])) as Record<ScoreLevel, LevelPolicy>
}

/** Phase 2 の個別例だけを中央管理する。閾値は実分布で再校正するまで provisional。 */
export const TIMING_SCORE_POLICIES: Record<TimingScoreKey, Record<ScoreLevel, LevelPolicy>> = Object.fromEntries([
  'relationship_activation', 'relationship_binding', 'relationship_disruption', 'relationship_secrecy',
  'relationship_idealization', 'marriage_legalization', 'career_activation', 'career_change',
  'career_expansion', 'money_status', 'home_family', 'relocation', 'education_activation',
  'education_disruption', 'identity_reset', 'social_network_change', 'responsibility', 'emotional_stress',
].map(key => [key, policiesFor(
  key === 'relationship_idealization'
    ? { high: { minRawSupport: 0.30, minConfidence: 0.50, minSourceFamilies: 2, minCorrelationGroups: 1, confidenceCap: 0.65 } }
    : key === 'education_disruption'
      ? { high: { minRawSupport: 0.50, minConfidence: 0.50, minSourceFamilies: 3, minCorrelationGroups: 2 } }
      : {},
)])) as Record<TimingScoreKey, Record<ScoreLevel, LevelPolicy>>

export interface ClaimFitBreakdown {
  /** null は不一致ではなく、その資産に該当条件がなく評価対象外であることを示す。 */
  gateMargin: number | null
  coEventFit: number | null
  traitFit: number | null
  contextFit: number | null
  confidence: number | null
  evidenceDiversity: number | null
  salience: number
}

export interface ClaimFitResult {
  total: number
  weightedSum: number
  appliedWeight: number
  breakdown: ClaimFitBreakdown
}

export interface RankedTimingClaim {
  asset: TimingClaimAsset
  fit: ClaimFitResult
  tieBreakUsed: boolean
}

export interface TimingClaimSelectionResult {
  year: number
  selected: readonly RankedTimingClaim[]
  eligible: readonly RankedTimingClaim[]
  excluded: readonly { asset: TimingClaimAsset; reason: string }[]
}

export function createTimingReportSelectionState(): TimingReportSelectionState {
  return { usedClaimIds: new Set(), semanticGroupLastUsedYear: new Map(), claimLastUsedYear: new Map() }
}

const TIMING_SCORE_KEY_SET = new Set<string>(Object.keys(TIMING_SCORE_POLICIES))
const SCORE_LEVEL_SET = new Set<string>(Object.keys(SCORE_BOUNDS))

function isLevelPolicyValid(policy: LevelPolicy): boolean {
  if (!policy || typeof policy !== 'object') return false
  const unitKeys: readonly (keyof LevelPolicy)[] = ['relativeStrengthMin', 'relativeStrengthMax', 'minRawSupport', 'minConfidence', 'confidenceCap']
  for (const key of unitKeys) {
    const value = policy[key]
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) return false
  }
  for (const key of ['minSourceFamilies', 'minCorrelationGroups'] as const) {
    const value = policy[key]
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) return false
  }
  if (policy.relativeStrengthMin !== undefined && policy.relativeStrengthMax !== undefined
    && policy.relativeStrengthMin > policy.relativeStrengthMax) return false
  return true
}

export function isTimingGateDefinitionValid(gate: Pick<ScoreGate, 'op' | 'value' | 'min' | 'max' | 'level'>): boolean {
  if (!gate || typeof gate !== 'object' || !SCORE_LEVEL_SET.has(gate.level)) return false
  const expected = SCORE_BOUNDS[gate.level as ScoreLevel]
  if (gate.op !== expected.op) return false
  if (expected.op === 'between') {
    return gate.value === undefined && gate.min === expected.min && gate.max === expected.max
  }
  return gate.value === expected.value && gate.min === undefined && gate.max === undefined
}

export function passesTimingScoreGate(gate: ScoreGate, score: TimingScoreResult, policy?: LevelPolicy): boolean {
  if (!gate || typeof gate !== 'object' || !TIMING_SCORE_KEY_SET.has(gate.key) || !SCORE_LEVEL_SET.has(gate.level)) return false
  if (!isTimingGateDefinitionValid(gate)) return false
  const effectivePolicy = policy ?? TIMING_SCORE_POLICIES[gate.key]?.[gate.level]
  if (!effectivePolicy || !isLevelPolicyValid(effectivePolicy)) return false
  if (score.key !== gate.key) return false
  if (!Number.isFinite(score.rawSupport) || score.rawSupport < 0 || score.rawSupport > 1) return false
  if (!Number.isFinite(score.relativeStrength) || score.relativeStrength < 0 || score.relativeStrength > 1) return false
  if (!Number.isFinite(score.confidence) || score.confidence < 0 || score.confidence > 1) return false
  if (!Number.isInteger(score.sourceFamilyCount) || score.sourceFamilyCount < 0 || score.sourceFamilyCount > 5) return false
  if (!Number.isInteger(score.correlationGroupCount) || score.correlationGroupCount < 0 || score.correlationGroupCount > 4) return false
  if (effectivePolicy.relativeStrengthMin !== undefined && score.relativeStrength < effectivePolicy.relativeStrengthMin) return false
  if (effectivePolicy.relativeStrengthMax !== undefined && score.relativeStrength > effectivePolicy.relativeStrengthMax) return false
  if (effectivePolicy.minRawSupport !== undefined && score.rawSupport < effectivePolicy.minRawSupport) return false
  const effectiveConfidence = Math.min(score.confidence, effectivePolicy.confidenceCap ?? 1)
  if (effectivePolicy.minConfidence !== undefined && effectiveConfidence < effectivePolicy.minConfidence) return false
  if (effectivePolicy.minSourceFamilies !== undefined && score.sourceFamilyCount < effectivePolicy.minSourceFamilies) return false
  if (effectivePolicy.minCorrelationGroups !== undefined && score.correlationGroupCount < effectivePolicy.minCorrelationGroups) return false
  return true
}

function numericGate(gate: TraitScoreGate, value: number): boolean {
  if (!TRAIT_GATE_KEY_SET.has(gate.key)) return false
  if (!isTimingGateDefinitionValid(gate)) return false
  if (!Number.isFinite(value)) return false
  if (gate.op === 'gte') return value >= (gate.value ?? Number.POSITIVE_INFINITY)
  if (gate.op === 'lte') return value <= (gate.value ?? Number.NEGATIVE_INFINITY)
  return value >= (gate.min ?? Number.POSITIVE_INFINITY) && value <= (gate.max ?? Number.NEGATIVE_INFINITY)
}

function occurrenceMatches(asset: TimingClaimAsset, profile: AnnualTimingProfile): boolean {
  if (asset.occurrence === 'any') return true
  const occurrences = profile.displayEvents.filter(item => asset.events.includes(item.event))
  if (occurrences.length === 0) return false
  return occurrences.some(item => asset.occurrence === (item.occurrenceIndex === 0 ? 'first' : 'later'))
}

export function hardGateReason(asset: TimingClaimAsset, profile: AnnualTimingProfile): string | null {
  if (asset.availability !== 'enabled') return 'availability'
  if (!asset.events.every(event => profile.activeDomains.has(event))) return 'activeDomains'
  if (!occurrenceMatches(asset, profile)) return 'occurrence'
  const match = asset.match
  if (match.pending?.length) return 'pending'
  if (match.relationshipStatus?.length && !match.relationshipStatus.includes(profile.relationshipStatus)) return 'relationshipStatus'
  if (match.workStatus?.length && !match.workStatus.includes(profile.workStatus)) return 'workStatus'
  if (match.historyAll?.some(key => !profile.history.has(key))) return 'historyAll'
  if (match.historyAny?.length && !match.historyAny.some(key => profile.history.has(key))) return 'historyAny'
  if (match.coEventsAll?.some(event => !profile.activeDomains.has(event))) return 'coEventsAll'
  if (match.coEventsAny?.length && !match.coEventsAny.some(event => profile.activeDomains.has(event))) return 'coEventsAny'
  if (match.runtimeContext && Object.entries(match.runtimeContext).some(([key, value]) => profile.context[key] !== value)) return 'runtimeContext'
  if (match.traitAll?.length || match.traitAny?.length) {
    if (!profile.traits) return 'traitsMissing'
    if (match.traitAll?.some(gate => profile.traits?.[gate.key] === undefined || !numericGate(gate, profile.traits[gate.key]!))) return 'traitAll'
    if (match.traitAny?.length && !match.traitAny.some(gate => profile.traits?.[gate.key] !== undefined && numericGate(gate, profile.traits[gate.key]!))) return 'traitAny'
  }
  const hasScoreGates = Boolean(match.allScores?.length || match.anyScores?.length)
  if (!profile.scores) return asset.specificity === 'fallback' && !hasScoreGates ? null : 'scoresMissing'
  const passes = (gate: ScoreGate) => {
    const score = profile.scores?.[gate.key]
    return score !== undefined && passesTimingScoreGate(gate, score)
  }
  if (match.allScores?.some(gate => !passes(gate))) return 'allScores'
  if (match.anyScores?.length && !match.anyScores.some(passes)) return 'anyScores'
  return null
}

function clamp(value: number) { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0 }

function scoreMargin(gate: ScoreGate, score: TimingScoreResult): number {
  const policy = TIMING_SCORE_POLICIES[gate.key][gate.level]
  const value = score.relativeStrength
  if (policy.relativeStrengthMin !== undefined && policy.relativeStrengthMax !== undefined) {
    const center = (policy.relativeStrengthMin + policy.relativeStrengthMax) / 2
    const half = Math.max((policy.relativeStrengthMax - policy.relativeStrengthMin) / 2, 0.001)
    return clamp(1 - Math.abs(value - center) / half)
  }
  if (policy.relativeStrengthMin !== undefined) return clamp((value - policy.relativeStrengthMin) / Math.max(1 - policy.relativeStrengthMin, 0.001))
  if (policy.relativeStrengthMax !== undefined) return clamp((policy.relativeStrengthMax - value) / Math.max(policy.relativeStrengthMax, 0.001))
  return 0
}

function traitMargin(gate: TraitScoreGate, value: number): number {
  if (gate.op === 'gte') return clamp((value - (gate.value ?? 0)) / Math.max(1 - (gate.value ?? 0), 0.001))
  if (gate.op === 'lte') return clamp(((gate.value ?? 1) - value) / Math.max(gate.value ?? 1, 0.001))
  const min = gate.min ?? 0; const max = gate.max ?? 1
  return clamp(1 - Math.abs(value - (min + max) / 2) / Math.max((max - min) / 2, 0.001))
}

function average(values: number[], fallback = 0) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback }

export function claimFit(asset: TimingClaimAsset, profile: AnnualTimingProfile): ClaimFitResult {
  const scoreEntry = (gate: ScoreGate) => {
    const score = profile.scores?.[gate.key]
    return score && passesTimingScoreGate(gate, score) ? { gate, score } : null
  }
  const requiredScoreEntries = (asset.match.allScores ?? []).map(scoreEntry)
  const passingAlternativeScoreEntries = (asset.match.anyScores ?? []).flatMap(gate => {
    const entry = scoreEntry(gate)
    return entry ? [entry] : []
  })
  const traitEntry = (gate: TraitScoreGate) => {
    const value = profile.traits?.[gate.key]
    return Number.isFinite(value) && numericGate(gate, value!) ? { gate, value: value! } : null
  }
  const requiredTraitEntries = (asset.match.traitAll ?? []).map(traitEntry)
  const passingAlternativeTraitEntries = (asset.match.traitAny ?? []).flatMap(gate => {
    const entry = traitEntry(gate)
    return entry ? [entry] : []
  })
  const missingRequiredScore = requiredScoreEntries.some(entry => entry === null)
    || Boolean(asset.match.anyScores?.length && passingAlternativeScoreEntries.length === 0)
  const missingRequiredTrait = requiredTraitEntries.some(entry => entry === null)
    || Boolean(asset.match.traitAny?.length && passingAlternativeTraitEntries.length === 0)
  if (missingRequiredScore || missingRequiredTrait) {
    return {
      total: 0,
      weightedSum: 0,
      appliedWeight: 0,
      breakdown: { gateMargin: null, coEventFit: null, traitFit: null, contextFit: null, confidence: null, evidenceDiversity: null, salience: 0 },
    }
  }
  const requiredScores = requiredScoreEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  const selectedAlternativeScore = passingAlternativeScoreEntries.sort((left, right) => {
    const leftCap = TIMING_SCORE_POLICIES[left.gate.key][left.gate.level].confidenceCap ?? 1
    const rightCap = TIMING_SCORE_POLICIES[right.gate.key][right.gate.level].confidenceCap ?? 1
    return Math.min(right.score.confidence, rightCap) - Math.min(left.score.confidence, leftCap)
      || left.gate.key.localeCompare(right.gate.key)
  })[0]
  const selectedScoreEntries = [...requiredScores, ...(selectedAlternativeScore ? [selectedAlternativeScore] : [])]
  const scores = selectedScoreEntries.map(entry => entry.score)
  const cappedConfidence = ({ gate, score }: typeof selectedScoreEntries[number]): number => {
    const cap = TIMING_SCORE_POLICIES[gate.key][gate.level].confidenceCap ?? 1
    return Math.min(score.confidence, cap)
  }
  const requiredConfidences = requiredScores.map(cappedConfidence)
  // anyScores はHard Gateを通った枝のうち最も確かな1枝を採用する。
  // allScores は全条件がClaim成立に必要なので、最も弱いconfidenceをClaim全体の上限にする。
  const effectiveConfidences = [...requiredConfidences, ...(selectedAlternativeScore ? [cappedConfidence(selectedAlternativeScore)] : [])]
  const allMargins = requiredScores.map(({ gate, score }) => scoreMargin(gate, score))
  const anyMargins = selectedAlternativeScore ? [scoreMargin(selectedAlternativeScore.gate, selectedAlternativeScore.score)] : []
  const traitAll = requiredTraitEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .map(({ gate, value }) => traitMargin(gate, value))
  const selectedAlternativeTrait = passingAlternativeTraitEntries
    .map(entry => ({ ...entry, margin: traitMargin(entry.gate, entry.value) }))
    .sort((left, right) => right.margin - left.margin || left.gate.key.localeCompare(right.gate.key))[0]
  const traitAny = selectedAlternativeTrait ? [selectedAlternativeTrait.margin] : []
  const contextChecks = [
    asset.match.relationshipStatus?.length ? Number(asset.match.relationshipStatus.includes(profile.relationshipStatus)) : null,
    asset.match.workStatus?.length ? Number(asset.match.workStatus.includes(profile.workStatus)) : null,
    asset.match.historyAll?.length ? Number(asset.match.historyAll.every(key => profile.history.has(key))) : null,
    asset.match.historyAny?.length ? Number(asset.match.historyAny.some(key => profile.history.has(key))) : null,
  ].filter((value): value is number => value !== null)
  const scoreMargins = [...allMargins, ...(anyMargins.length ? [Math.max(...anyMargins)] : [])]
  const traitMargins = [...traitAll, ...(traitAny.length ? [Math.max(...traitAny)] : [])]
  const coEventKeys = [...new Set([...asset.events, ...(asset.match.coEventsAll ?? []), ...(asset.match.coEventsAny ?? [])])]
  const hasCoEventCondition = asset.events.length > 1 || Boolean(asset.match.coEventsAll?.length || asset.match.coEventsAny?.length)
  const breakdown: ClaimFitBreakdown = {
    gateMargin: scoreMargins.length ? average(scoreMargins) : null,
    coEventFit: hasCoEventCondition ? coEventKeys.filter(event => profile.activeDomains.has(event)).length / coEventKeys.length : null,
    traitFit: traitMargins.length ? average(traitMargins) : null,
    contextFit: contextChecks.length ? average(contextChecks) : null,
    confidence: effectiveConfidences.length ? Math.min(...effectiveConfidences) : null,
    evidenceDiversity: scores.length ? average(scores.map(score => clamp(score.sourceFamilyCount / 5))) : null,
    salience: clamp(asset.salienceBase),
  }
  const weightedComponents: Array<[number | null, number]> = [
    [breakdown.gateMargin, 0.30], [breakdown.coEventFit, 0.20], [breakdown.traitFit, 0.10],
    [breakdown.contextFit, 0.10], [breakdown.confidence, 0.15], [breakdown.evidenceDiversity, 0.10],
    [breakdown.salience, 0.05],
  ]
  const applicable = weightedComponents.filter((item): item is [number, number] => item[0] !== null)
  const weightedSum = applicable.reduce((sum, [value, weight]) => sum + value * weight, 0)
  const appliedWeight = applicable.reduce((sum, [, weight]) => sum + weight, 0)
  return {
    total: Number((appliedWeight > 0 ? weightedSum / appliedWeight : 0).toFixed(6)),
    weightedSum: Number(weightedSum.toFixed(6)),
    appliedWeight: Number(appliedWeight.toFixed(6)),
    breakdown,
  }
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (const character of value) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}

function rank(candidates: Array<Omit<RankedTimingClaim, 'tieBreakUsed'>>, seed: string, year: number): RankedTimingClaim[] {
  const totals = new Map<number, number>()
  candidates.forEach(item => totals.set(item.fit.total, (totals.get(item.fit.total) ?? 0) + 1))
  return candidates.map(item => ({ ...item, tieBreakUsed: (totals.get(item.fit.total) ?? 0) > 1 }))
    .sort((left, right) => right.fit.total - left.fit.total || stableHash(`${seed}|${year}|${left.asset.id}`) - stableHash(`${seed}|${year}|${right.asset.id}`))
}

function reportWideReason(asset: TimingClaimAsset, profile: AnnualTimingProfile, state: TimingReportSelectionState): string | null {
  if (asset.specificity !== 'fallback' && state.usedClaimIds.has(asset.id)) return 'claimIdUsed'
  const semanticYear = state.semanticGroupLastUsedYear.get(asset.semanticGroup)
  if (semanticYear !== undefined && profile.year - semanticYear < 5) return 'semanticCooldown'
  if (asset.specificity === 'fallback') {
    const claimYear = state.claimLastUsedYear.get(asset.id)
    if (claimYear !== undefined && profile.year - claimYear < 8) return 'fallbackCooldown'
  }
  return null
}

function chooseFirst(candidates: RankedTimingClaim[], selected: RankedTimingClaim[], predicate: (item: RankedTimingClaim) => boolean) {
  const usedGroups = new Set(selected.map(item => item.asset.semanticGroup))
  const found = candidates.find(item => predicate(item) && !selected.some(value => value.asset.id === item.asset.id) && !usedGroups.has(item.asset.semanticGroup))
  if (found) selected.push(found)
}

export function selectTimingClaims(
  assets: readonly TimingClaimAsset[],
  profile: AnnualTimingProfile,
  state: TimingReportSelectionState,
  seed: string,
  maxSections = 4,
): TimingClaimSelectionResult {
  const activeSnapshot = [...profile.activeDomains].sort().join('|')
  const excluded: Array<{ asset: TimingClaimAsset; reason: string }> = []
  const gated = assets.flatMap(asset => {
    const reason = hardGateReason(asset, profile)
    if (reason) { excluded.push({ asset, reason }); return [] }
    const cooldown = reportWideReason(asset, profile, state)
    if (cooldown) { excluded.push({ asset, reason: cooldown }); return [] }
    return [{ asset, fit: claimFit(asset, profile) }]
  })
  const reusableFallbacksWithAlternatives = new Set(gated.filter(item =>
    item.asset.specificity === 'fallback'
    && state.claimLastUsedYear.has(item.asset.id)
    && gated.some(alternative => alternative.asset.specificity !== 'fallback'
      && alternative.asset.events.length === item.asset.events.length
      && alternative.asset.events.every(event => item.asset.events.includes(event))),
  ).map(item => item.asset.id))
  for (const item of gated) if (reusableFallbacksWithAlternatives.has(item.asset.id)) excluded.push({ asset: item.asset, reason: 'fallbackAlternativeAvailable' })
  const available = gated.filter(item => !reusableFallbacksWithAlternatives.has(item.asset.id))
  // fallback は適用スコアを持たず、再正規化した fit を score_specific と直接比較できない。
  // 常に別プールへ置き、score_specific / compound で節を満たせない場合だけ補充へ使う。
  const eligible = [
    ...rank(available.filter(item => item.asset.specificity !== 'fallback'), seed, profile.year),
    ...rank(available.filter(item => item.asset.specificity === 'fallback'), seed, profile.year),
  ]
  const selected: RankedTimingClaim[] = []
  chooseFirst(eligible, selected, item => item.asset.specificity === 'compound' || item.asset.events.length > 1)
  for (const occurrence of profile.displayEvents.slice(0, 2)) {
    chooseFirst(eligible, selected, item => item.asset.events.length === 1 && item.asset.events[0] === occurrence.event)
  }
  for (const preferredShape of ['cost', 'repair', 'condition', 'sequence', 'event', 'contrast'] as const) {
    if (selected.length >= maxSections) break
    chooseFirst(eligible, selected, item => item.asset.shape === preferredShape)
  }
  while (selected.length < maxSections) {
    const before = selected.length
    chooseFirst(eligible, selected, () => true)
    if (selected.length === before) break
  }
  if ([...profile.activeDomains].sort().join('|') !== activeSnapshot) throw new Error('activeDomains mutated during claim selection')
  for (const item of selected) {
    state.usedClaimIds.add(item.asset.id)
    state.claimLastUsedYear.set(item.asset.id, profile.year)
    state.semanticGroupLastUsedYear.set(item.asset.semanticGroup, profile.year)
  }
  return { year: profile.year, selected, eligible, excluded }
}
