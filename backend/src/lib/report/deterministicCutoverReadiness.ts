import type { TraitScoreRule } from './traitScores.js'
import { DIRECT_TRAIT_SCORE_KEYS, REQUIRED_TRAIT_SCORE_KEYS } from './traitScores.js'
import { DERIVED_TRAIT_SCORE_KEYS } from './derivedTraitScores.js'
import { auditRuleSourceDocument, extractRuleSourceSections, validateTraitScoreRules } from './traitScoreRuleValidation.js'

export const REQUIRED_COMPATIBILITY_SCORE_KEYS = [
  'romantic_attraction', 'physical_attraction', 'emotional_intimacy', 'emotional_safety',
  'mutual_understanding', 'conversational_flow', 'conversational_depth', 'humor_compatibility',
  'value_alignment', 'ambition_alignment', 'lifestyle_alignment', 'friendship_compatibility',
  'domestic_compatibility', 'novelty_compatibility', 'growth_compatibility',
  'shared_project_compatibility', 'adventure_compatibility', 'admiration_mutual',
  'pride_collision', 'ego_competition', 'conflict_frequency', 'conflict_intensity',
  'repair_capacity', 'forgiveness_capacity', 'transparency', 'predictability',
  'mystery_distance', 'trust_stability', 'betrayal_risk_pattern', 'dependency_intensity',
  'shared_identity', 'partnership_team_feeling', 'fate_companion_feeling',
  'relationship_stimulation_need', 'relationship_boredom_risk', 'power_balance',
  'social_display_affection', 'private_affection', 'long_term_binding',
] as const

export type RequiredCompatibilityScoreKey = typeof REQUIRED_COMPATIBILITY_SCORE_KEYS[number]

export interface CompatibilityCutoverReadiness {
  ready: boolean
  compatibilitySections: number
  coveredScores: number
  requiredScores: number
  reasons: string[]
}

export interface DeterministicCutoverReadiness {
  ready: boolean
  personalitySections: number
  eventSections: number
  coveredScores: number
  ruleCount: number
  reasons: string[]
}

export function assessDeterministicCutoverReadiness(
  personalityMarkdown: string,
  eventMarkdown: string,
  rules: readonly TraitScoreRule[],
): DeterministicCutoverReadiness {
  const personality = auditRuleSourceDocument(personalityMarkdown, 58)
  const events = auditRuleSourceDocument(eventMarkdown, 53)
  const validation = validateTraitScoreRules(rules, {
    availableSections: {
      性格: extractRuleSourceSections(personalityMarkdown),
      時期: extractRuleSourceSections(eventMarkdown),
    },
    requiredScores: DIRECT_TRAIT_SCORE_KEYS,
  })
  const coveredScores = REQUIRED_TRAIT_SCORE_KEYS.filter(score =>
    DERIVED_TRAIT_SCORE_KEYS.includes(score as typeof DERIVED_TRAIT_SCORE_KEYS[number]) || (validation.ruleCountByScore[score] ?? 0) > 0,
  ).length
  const reasons = [
    ...(!personality.complete ? [`性格・恋愛傾向の原典が未完了（${personality.sections.length}/58節）`] : []),
    ...(!events.complete ? [`時期・出来事の原典が未完了（${events.sections.length}/53節）`] : []),
    ...(coveredScores < REQUIRED_TRAIT_SCORE_KEYS.length ? [`根拠付きスコアが未完了（${coveredScores}/${REQUIRED_TRAIT_SCORE_KEYS.length}種）`] : []),
    ...validation.errors,
  ]
  return {
    ready: reasons.length === 0,
    personalitySections: personality.sections.length,
    eventSections: events.sections.length,
    coveredScores,
    ruleCount: rules.length,
    reasons,
  }
}

/** 相性原典§1の主要39スコアを基準にし、本人鑑定の切替判定とは分離する。 */
export function assessCompatibilityCutoverReadiness(
  compatibilityMarkdown: string,
  availableScores: readonly string[],
): CompatibilityCutoverReadiness {
  const compatibility = auditRuleSourceDocument(compatibilityMarkdown, 58)
  const available = new Set(availableScores)
  const coveredScores = REQUIRED_COMPATIBILITY_SCORE_KEYS.filter(key => available.has(key)).length
  const reasons = [
    ...(!compatibility.complete ? [`相性原典が未完了（${compatibility.sections.length}/58節）`] : []),
    ...(coveredScores < REQUIRED_COMPATIBILITY_SCORE_KEYS.length
      ? [`相性の主要スコアが未完了（${coveredScores}/${REQUIRED_COMPATIBILITY_SCORE_KEYS.length}種）`]
      : []),
  ]
  return {
    ready: reasons.length === 0,
    compatibilitySections: compatibility.sections.length,
    coveredScores,
    requiredScores: REQUIRED_COMPATIBILITY_SCORE_KEYS.length,
    reasons,
  }
}
