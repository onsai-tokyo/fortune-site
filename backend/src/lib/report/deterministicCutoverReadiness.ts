import type { TraitScoreRule } from './traitScores.js'
import { ALL_TRAIT_SCORE_KEYS } from './traitScores.js'
import { auditRuleSourceDocument, extractRuleSourceSections, validateTraitScoreRules } from './traitScoreRuleValidation.js'

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
    requiredScores: ALL_TRAIT_SCORE_KEYS,
  })
  const coveredScores = ALL_TRAIT_SCORE_KEYS.filter(score => (validation.ruleCountByScore[score] ?? 0) > 0).length
  const reasons = [
    ...(!personality.complete ? [`性格・恋愛傾向の原典が未完了（${personality.sections.length}/58節）`] : []),
    ...(!events.complete ? [`時期・出来事の原典が未完了（${events.sections.length}/53節）`] : []),
    ...(coveredScores < ALL_TRAIT_SCORE_KEYS.length ? [`根拠付きスコアが未完了（${coveredScores}/${ALL_TRAIT_SCORE_KEYS.length}種）`] : []),
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
