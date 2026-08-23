import { createHash } from 'node:crypto'
import type { FactAxis } from './facts.js'
import type { TraitScore, TraitScoreKey, TraitScoreSet } from './traitScores.js'

export const GAP_THRESHOLD = 0.25
export const GAP_MIN_CONFIDENCE = 0.4

export interface GapSpec {
  key: `gap:${string}`
  highSides: readonly TraitScoreKey[]
  lowSide: TraitScoreKey
  invertLow?: boolean
  direction: 'both'
  axis: FactAxis
  chapter: string
  sources: readonly string[]
}

export interface GapFinding {
  id: string
  kind: 'gap'
  key: string
  axis: FactAxis
  highSide: TraitScoreKey
  highSides: readonly TraitScoreKey[]
  lowSide: TraitScoreKey
  gap: number
  confidence: number
  primaryFacts: string[]
  chapter: string
  sources: readonly string[]
}

export const GAP_SPECS: readonly GapSpec[] = [
  { key: 'gap:social-private', highSides: ['social_extraversion'], lowSide: 'private_introversion', invertLow: true, direction: 'both', axis: 'expression', chapter: 'core-mind-2', sources: ['性格§1', '性格§2', '性格§18'] },
  { key: 'gap:attraction-compatibility', highSides: ['attraction_charisma'], lowSide: 'compatibility_stability', direction: 'both', axis: 'domain-love', chapter: 'love-pattern', sources: ['性格§10', '性格§46'] },
  { key: 'gap:status-transparency', highSides: ['attraction_status'], lowSide: 'compatibility_transparency', direction: 'both', axis: 'domain-love', chapter: 'love-pattern', sources: ['性格§8', '性格§47'] },
  { key: 'gap:career-romantic', highSides: ['career_absorption'], lowSide: 'romantic_absorption', direction: 'both', axis: 'domain-work', chapter: 'work-mode', sources: ['性格§4', '性格§50'] },
  { key: 'gap:public-private', highSides: ['public_agreeableness'], lowSide: 'private_assertiveness', invertLow: true, direction: 'both', axis: 'relation', chapter: 'core-mind-1', sources: ['性格§16'] },
  { key: 'gap:pride-approval', highSides: ['pride_sensitivity'], lowSide: 'approval_need', direction: 'both', axis: 'shadow', chapter: 'core-mind-3', sources: ['性格§14', '性格§15'] },
  { key: 'gap:tolerance-boundary', highSides: ['tolerance'], lowSide: 'relationship_boundary_strength', invertLow: true, direction: 'both', axis: 'relation', chapter: 'core-mind-3', sources: ['性格§19'] },
  { key: 'gap:idealization-transparency', highSides: ['attraction_status', 'attraction_authority'], lowSide: 'compatibility_transparency', direction: 'both', axis: 'domain-love', chapter: 'love-beginning', sources: ['性格§48'] },
  { key: 'gap:age-friendship', highSides: ['attraction_age_gap'], lowSide: 'compatibility_friendship', direction: 'both', axis: 'domain-love', chapter: 'love-beginning', sources: ['性格§30', '性格§46'] },
  { key: 'gap:conformity-freedom', highSides: ['social_conformity', 'plan_orientation'], lowSide: 'lifestyle_adaptability', direction: 'both', axis: 'drive', chapter: 'life-mission', sources: ['性格§12', '性格§13', '性格§43'] },
]

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const combined = (scores: TraitScore[]): { value: number; confidence: number; facts: string[] } => ({
  value: average(scores.map(score => score.value)),
  confidence: Math.min(...scores.map(score => score.confidence)),
  facts: [...new Set(scores.flatMap(score => score.contributingFacts))].sort(),
})

const findingId = (key: string, gap: number, facts: string[]) => createHash('sha256')
  .update(JSON.stringify([key, gap, facts])).digest('hex').slice(0, 16)

export function buildGapFindings(scores: TraitScoreSet, specs: readonly GapSpec[] = GAP_SPECS): GapFinding[] {
  return specs.flatMap(spec => {
    const high = combined(spec.highSides.map(key => scores[key]))
    const lowScore = scores[spec.lowSide]
    if (high.confidence < GAP_MIN_CONFIDENCE || lowScore.confidence < GAP_MIN_CONFIDENCE) return []
    const signedGap = high.value - (spec.invertLow ? 1 - lowScore.value : lowScore.value)
    if (Math.abs(signedGap) < GAP_THRESHOLD) return []
    const key = signedGap > 0 ? spec.key : `${spec.key}:aligned`
    const gap = Number(Math.abs(signedGap).toFixed(3))
    const facts = [...new Set([...high.facts, ...lowScore.contributingFacts])].sort()
    return [{
      id: findingId(key, gap, facts), kind: 'gap' as const, key, axis: spec.axis,
      highSide: spec.highSides[0], highSides: spec.highSides, lowSide: spec.lowSide,
      gap, confidence: Number(Math.min(0.95, Math.min(high.confidence, lowScore.confidence) + 0.1).toFixed(3)),
      primaryFacts: facts, chapter: spec.chapter, sources: spec.sources,
    }]
  })
}
