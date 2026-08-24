import type { FactAxis, FactLineage } from './facts.js'
import type { ReportFactV2 } from './factsV2.js'
import { CONFIRMED_PERSONALITY_SCORE_RULES } from './traitScoreRules.personality.js'

export type PersonalityScoreKey =
  | 'social_extraversion' | 'private_introversion' | 'social_sensitivity'
  | 'public_agreeableness' | 'private_assertiveness'
  | 'immersion_intensity' | 'career_absorption' | 'romantic_absorption'
  | 'approval_need' | 'recognition_motivation' | 'pride_sensitivity'
  | 'self_complexity' | 'loneliness_tendency'
  | 'status_attraction' | 'respect_attraction' | 'charisma_attraction'
  | 'novelty_attraction' | 'intellectual_attraction' | 'age_gap_attraction'
  | 'authority_attraction' | 'stability_preference' | 'reliability_preference'
  | 'friendship_orientation' | 'domestic_affection' | 'family_orientation'
  | 'practical_generosity' | 'partner_mirroring'
  | 'social_conformity' | 'plan_orientation'
  | 'emotional_volatility' | 'emotional_expression'
  | 'relationship_boundary_strength' | 'tolerance'
  | 'gossip_curiosity' | 'taboo_curiosity' | 'playfulness'
  | 'conversation_entertainment' | 'group_coordination' | 'effort_respect'
  | 'social_neutrality' | 'neutrality_pride' | 'lifestyle_adaptability'
  | 'friendship_value_match' | 'friendship_independence' | 'life_stage_alignment'

export type AttractionScoreKey =
  | 'attraction_status' | 'attraction_respect' | 'attraction_charisma'
  | 'attraction_novelty' | 'attraction_intellectual' | 'attraction_age_gap'
  | 'attraction_authority' | 'attraction_physical' | 'attraction_friendship'
  | 'attraction_intensity'

export type CompatibilityScoreKey =
  | 'compatibility_stability' | 'compatibility_reliability' | 'compatibility_transparency'
  | 'compatibility_friendship' | 'compatibility_domestic' | 'compatibility_playfulness'
  | 'compatibility_independence' | 'compatibility_family_orientation'
  | 'compatibility_lifestyle' | 'compatibility_emotional_safety' | 'compatibility_value_match'

export type BindingScoreKey =
  | 'long_term_binding' | 'marriage_binding' | 'domestic_binding'
  | 'responsibility_binding' | 'friendship_binding'

export type TraitScoreKey = PersonalityScoreKey | AttractionScoreKey | CompatibilityScoreKey | BindingScoreKey

export const PERSONALITY_SCORE_KEYS = [
  'social_extraversion', 'private_introversion', 'social_sensitivity', 'public_agreeableness', 'private_assertiveness',
  'immersion_intensity', 'career_absorption', 'romantic_absorption', 'approval_need', 'recognition_motivation', 'pride_sensitivity',
  'self_complexity', 'loneliness_tendency', 'status_attraction', 'respect_attraction', 'charisma_attraction', 'novelty_attraction',
  'intellectual_attraction', 'age_gap_attraction', 'authority_attraction', 'stability_preference', 'reliability_preference',
  'friendship_orientation', 'domestic_affection', 'family_orientation', 'practical_generosity', 'partner_mirroring',
  'social_conformity', 'plan_orientation', 'emotional_volatility', 'emotional_expression', 'relationship_boundary_strength',
  'tolerance', 'gossip_curiosity', 'taboo_curiosity', 'playfulness', 'conversation_entertainment', 'group_coordination',
  'effort_respect', 'social_neutrality', 'neutrality_pride', 'lifestyle_adaptability', 'friendship_value_match',
  'friendship_independence', 'life_stage_alignment',
] as const satisfies readonly PersonalityScoreKey[]

export const ATTRACTION_SCORE_KEYS = [
  'attraction_status', 'attraction_respect', 'attraction_charisma', 'attraction_novelty', 'attraction_intellectual',
  'attraction_age_gap', 'attraction_authority', 'attraction_physical', 'attraction_friendship', 'attraction_intensity',
] as const satisfies readonly AttractionScoreKey[]

export const COMPATIBILITY_SCORE_KEYS = [
  'compatibility_stability', 'compatibility_reliability', 'compatibility_transparency', 'compatibility_friendship',
  'compatibility_domestic', 'compatibility_playfulness', 'compatibility_independence', 'compatibility_family_orientation',
  'compatibility_lifestyle', 'compatibility_emotional_safety', 'compatibility_value_match',
] as const satisfies readonly CompatibilityScoreKey[]

export const BINDING_SCORE_KEYS = [
  'long_term_binding', 'marriage_binding', 'domestic_binding', 'responsibility_binding', 'friendship_binding',
] as const satisfies readonly BindingScoreKey[]

export const ALL_TRAIT_SCORE_KEYS: readonly TraitScoreKey[] = [
  ...PERSONALITY_SCORE_KEYS, ...ATTRACTION_SCORE_KEYS, ...COMPATIBILITY_SCORE_KEYS, ...BINDING_SCORE_KEYS,
]

/** 原典に判定根拠がなく、推測でルールを作らない保留キー。常に confidence: 0 のまま保持する。 */
export const RESERVED_TRAIT_SCORE_KEYS = ['attraction_physical'] as const satisfies readonly TraitScoreKey[]
export const REQUIRED_TRAIT_SCORE_KEYS: readonly TraitScoreKey[] = ALL_TRAIT_SCORE_KEYS
  .filter(key => !RESERVED_TRAIT_SCORE_KEYS.includes(key as typeof RESERVED_TRAIT_SCORE_KEYS[number]))

export interface TraitScore {
  key: TraitScoreKey
  value: number
  raw: number
  contributingFacts: string[]
  lineages: FactLineage[]
  confidence: number
}

export type TraitScoreSet = Record<TraitScoreKey, TraitScore>
export interface TraitScoreScale { center: number; spread: number }

export interface FactMatcher {
  system?: string[]
  lineage?: FactLineage[]
  axis?: FactAxis[]
  signal?: string[]
  factorPrefix?: string[]
  /** 同じFact内に指定要素がすべて存在する場合だけ一致する。アスペクトの両天体判定に使う。 */
  factorIncludesAll?: string[]
  polarity?: Array<-1 | 0 | 1>
  minStrength?: number
}

export interface TraitScoreRule {
  score: TraitScoreKey
  match: FactMatcher
  weight: number
  source: string
}

export const TRAIT_SCORE_RULES: readonly TraitScoreRule[] = CONFIRMED_PERSONALITY_SCORE_RULES

export function matchesTraitFact(fact: ReportFactV2, matcher: FactMatcher): boolean {
  if (matcher.system && !matcher.system.includes(fact.system)) return false
  if (matcher.lineage && !matcher.lineage.includes(fact.lineage)) return false
  if (matcher.axis && !matcher.axis.includes(fact.axis)) return false
  if (matcher.signal && !matcher.signal.includes(fact.signal)) return false
  if (matcher.factorPrefix && !matcher.factorPrefix.some(prefix => fact.factor.startsWith(prefix))) return false
  if (matcher.factorIncludesAll && !matcher.factorIncludesAll.every(value => fact.factor.includes(value))) return false
  if (matcher.polarity && !matcher.polarity.includes(fact.polarity)) return false
  if (matcher.minStrength !== undefined && fact.strength < matcher.minStrength) return false
  return true
}

export function traitScoreConfidence(factCount: number, lineageCount: number): number {
  if (factCount === 0) return 0
  const countTerm = Math.min(factCount / 4, 1)
  const lineageTerm = Math.min(lineageCount / 2, 1)
  return Number((0.4 * countTerm + 0.6 * lineageTerm).toFixed(3))
}

export function normalizeTraitScore(raw: number, scale: TraitScoreScale): number {
  const spread = Math.max(scale.spread, 0.001)
  return Number((1 / (1 + Math.exp(-(raw - scale.center) / spread))).toFixed(3))
}

export function computeTraitScores(
  facts: ReportFactV2[],
  rules: readonly TraitScoreRule[],
  scale: Record<TraitScoreKey, TraitScoreScale>,
): TraitScoreSet {
  return Object.fromEntries(ALL_TRAIT_SCORE_KEYS.map(key => {
    const hits = rules.filter(rule => rule.score === key).flatMap(rule =>
      facts.filter(fact => matchesTraitFact(fact, rule.match)).map(fact => ({ fact, rule })),
    )
    const bySource = new Map<string, typeof hits[number]>()
    for (const hit of hits) {
      const previous = bySource.get(hit.fact.canonicalSourceId)
      const contribution = hit.fact.strength * Math.abs(hit.rule.weight)
      const previousContribution = previous ? previous.fact.strength * Math.abs(previous.rule.weight) : -1
      if (!previous || contribution > previousContribution) bySource.set(hit.fact.canonicalSourceId, hit)
    }
    const merged = [...bySource.values()].sort((left, right) => left.fact.id.localeCompare(right.fact.id))
    const raw = merged.reduce((sum, hit) => sum + hit.fact.strength * hit.rule.weight, 0)
    const lineages = [...new Set(merged.map(hit => hit.fact.lineage))].sort()
    const value: TraitScore = {
      key, raw: Number(raw.toFixed(6)), value: normalizeTraitScore(raw, scale[key]),
      contributingFacts: merged.map(hit => hit.fact.id), lineages,
      confidence: traitScoreConfidence(merged.length, lineages.length),
    }
    return [key, value]
  })) as TraitScoreSet
}
