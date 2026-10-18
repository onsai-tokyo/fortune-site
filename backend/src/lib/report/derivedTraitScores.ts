import { isAvailableScore } from './scoreAvailability.js'
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
  unavailableReason?: 'unreviewed_disclosure_proxy' | 'missing_or_invalid_input'
}

function similarity(left: TraitScore, right: TraitScore): number {
  return clamp01(1 - Math.abs(left.value - right.value))
}

function hasEvidence(score: TraitScore | RelationScore | undefined): boolean {
  return isAvailableScore(score) && Array.isArray(score.contributingFacts)
    && score.contributingFacts.length > 0
    && score.contributingFacts.every(id => typeof id === 'string' && id.trim().length > 0)
}

/** 二人分の必要な個人根拠が揃った場合だけ比較する。欠測を同値として扱わない。 */
export function computePairTraitScores(self: TraitScoreSet, partner: TraitScoreSet, relations: readonly RelationScore[]): PairTraitScore[] {
  const derive = (key: PairTraitScore['key'], keys: TraitScoreKey[], relationKey?: RelationScore['key']): PairTraitScore => {
    if (!keys.every(input => hasEvidence(self[input]) && hasEvidence(partner[input]))) {
      return { key, value: .5, confidence: 0, inputScores: [], relationAxes: [], unavailableReason: 'missing_or_invalid_input' }
    }
    const base = keys.reduce((sum, input) => sum + similarity(self[input], partner[input]), 0) / keys.length
    const confidence = Math.min(...keys.flatMap(input => [self[input].confidence, partner[input].confidence]))
    const relation = relationKey ? relations.find(score => score.key === relationKey) : undefined
    // The values relation is optional in the existing formula. Missing/bad evidence contributes nothing.
    const usableRelation = hasEvidence(relation) ? relation : undefined
    return {
      key, value: Number((usableRelation ? (base + usableRelation.value) / 2 : base).toFixed(3)),
      confidence: Number(Math.min(confidence, usableRelation?.confidence ?? confidence).toFixed(3)),
      inputScores: keys, relationAxes: usableRelation ? [usableRelation.key] : [],
    }
  }
  return [
    { key: 'compatibility_transparency', value: .5, confidence: 0,
      inputScores: [], relationAxes: [], unavailableReason: 'unreviewed_disclosure_proxy' },
    derive('compatibility_independence', ['private_introversion', 'friendship_independence']),
    derive('compatibility_lifestyle', ['social_extraversion', 'private_introversion', 'lifestyle_adaptability']),
    derive('compatibility_value_match', ['friendship_value_match', 'social_conformity', 'plan_orientation'], 'values'),
  ]
}
