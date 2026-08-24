import type { RelationScore } from './synastryFacts.js'
import type { TraitScore, TraitScoreKey, TraitScoreSet } from './traitScores.js'

export const DERIVED_PERSONAL_TRAIT_SCORE_KEYS = ['private_assertiveness'] as const satisfies readonly TraitScoreKey[]
export const PAIR_TRAIT_SCORE_KEYS = [
  'compatibility_transparency', 'compatibility_independence', 'compatibility_lifestyle', 'compatibility_value_match',
] as const satisfies readonly TraitScoreKey[]
export const DERIVED_TRAIT_SCORE_KEYS = [...DERIVED_PERSONAL_TRAIT_SCORE_KEYS, ...PAIR_TRAIT_SCORE_KEYS] as const

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const unique = <T>(values: T[]) => [...new Set(values)]

/**
 * 性格§16・§41。新しい占術票は作らず、外での感受性と境界線の両方が
 * 既に根拠付きで算出された場合だけ、親しい場での自己主張を派生させる。
 */
export function applyDerivedPersonalTraitScores(scores: TraitScoreSet): TraitScoreSet {
  const sensitivity = scores.social_sensitivity
  const boundary = scores.relationship_boundary_strength
  if (sensitivity.confidence === 0 || boundary.confidence === 0) return scores
  const derived: TraitScore = {
    key: 'private_assertiveness',
    value: Number(((sensitivity.value + boundary.value) / 2).toFixed(3)),
    raw: Number(((sensitivity.raw + boundary.raw) / 2).toFixed(6)),
    confidence: Number(Math.min(sensitivity.confidence, boundary.confidence).toFixed(3)),
    contributingFacts: unique([...sensitivity.contributingFacts, ...boundary.contributingFacts]),
    lineages: unique([...sensitivity.lineages, ...boundary.lineages]).sort(),
  }
  return { ...scores, private_assertiveness: derived }
}

export interface PairTraitScore {
  key: typeof PAIR_TRAIT_SCORE_KEYS[number]
  value: number
  confidence: number
  inputScores: TraitScoreKey[]
  relationAxes: string[]
}

function similarity(left: TraitScore, right: TraitScore): number {
  return clamp01(1 - Math.abs(left.value - right.value))
}

function confidenceOf(left: TraitScore, right: TraitScore): number {
  return Math.min(left.confidence, right.confidence)
}

function relation(scores: readonly RelationScore[], key: RelationScore['key']): RelationScore | undefined {
  return scores.find(score => score.key === key && score.confidence > 0)
}

/** 性格§40・§48・§51・§52。二人分のTrait ScoreとSynastryだけを読む派生層。 */
export function computePairTraitScores(self: TraitScoreSet, partner: TraitScoreSet, relations: readonly RelationScore[]): PairTraitScore[] {
  const communication = relation(relations, 'communication')
  const safety = relation(relations, 'safety')
  const values = relation(relations, 'values')
  const transparencyInputs: TraitScoreKey[] = ['social_sensitivity', 'public_agreeableness']
  const transparencyBase = (similarity(self.social_sensitivity, partner.social_sensitivity) + similarity(self.public_agreeableness, partner.public_agreeableness)) / 2
  const transparencyRelation = [communication, safety].filter(Boolean) as RelationScore[]

  const independenceInputs: TraitScoreKey[] = ['private_introversion', 'friendship_independence']
  const independenceValue = (similarity(self.private_introversion, partner.private_introversion) + similarity(self.friendship_independence, partner.friendship_independence)) / 2

  const lifestyleInputs: TraitScoreKey[] = ['social_extraversion', 'private_introversion', 'lifestyle_adaptability']
  const lifestyleValue = lifestyleInputs.reduce((sum, key) => sum + similarity(self[key], partner[key]), 0) / lifestyleInputs.length

  const valueInputs: TraitScoreKey[] = ['friendship_value_match', 'social_conformity', 'plan_orientation']
  const valueBase = valueInputs.reduce((sum, key) => sum + similarity(self[key], partner[key]), 0) / valueInputs.length

  const pairConfidence = (keys: TraitScoreKey[]) => Number(Math.min(...keys.map(key => confidenceOf(self[key], partner[key]))).toFixed(3))
  return [
    {
      key: 'compatibility_transparency',
      value: Number(((transparencyBase + (transparencyRelation.length ? transparencyRelation.reduce((sum, item) => sum + item.value, 0) / transparencyRelation.length : transparencyBase)) / 2).toFixed(3)),
      confidence: Number(Math.min(pairConfidence(transparencyInputs), ...(transparencyRelation.length ? transparencyRelation.map(item => item.confidence) : [pairConfidence(transparencyInputs)])).toFixed(3)),
      inputScores: transparencyInputs,
      relationAxes: transparencyRelation.map(item => item.key),
    },
    { key: 'compatibility_independence', value: Number(independenceValue.toFixed(3)), confidence: pairConfidence(independenceInputs), inputScores: independenceInputs, relationAxes: [] },
    { key: 'compatibility_lifestyle', value: Number(lifestyleValue.toFixed(3)), confidence: pairConfidence(lifestyleInputs), inputScores: lifestyleInputs, relationAxes: [] },
    {
      key: 'compatibility_value_match', value: Number(((valueBase + (values?.value ?? valueBase)) / 2).toFixed(3)),
      confidence: Number(Math.min(pairConfidence(valueInputs), values?.confidence ?? pairConfidence(valueInputs)).toFixed(3)),
      inputScores: valueInputs, relationAxes: values ? ['values'] : [],
    },
  ]
}
