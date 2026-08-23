import type { ReportFactV2 } from './factsV2.js'
import type { ReportFindingV2 } from './findingsV2.js'
import { buildGapFindings } from './gapFindings.js'
import { bootstrapTraitScoreScale } from './traitScoreScale.js'
import { ALL_TRAIT_SCORE_KEYS, computeTraitScores, TRAIT_SCORE_RULES } from './traitScores.js'

/**
 * PR-3: reviewed rules only. Missing source rules never become guessed scores.
 * Gap findings are converted to the common Finding contract so the chapter
 * planner can compare them with ordinary consensus findings.
 */
export function buildScoreFindingsV2(facts: ReportFactV2[]): ReportFindingV2[] {
  const scale = bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS)
  const scores = computeTraitScores(facts, TRAIT_SCORE_RULES, scale)
  const factById = new Map(facts.map(fact => [fact.id, fact]))
  return buildGapFindings(scores).map(gap => {
    const contributing = gap.primaryFacts.map(id => factById.get(id)).filter((fact): fact is ReportFactV2 => Boolean(fact))
    return {
      id: gap.id,
      key: gap.key,
      kind: 'signature',
      axis: gap.axis,
      confidence: gap.confidence,
      lineages: [...new Set(contributing.map(fact => fact.lineage))],
      systems: [...new Set(contributing.map(fact => fact.system)), 'Trait Score'],
      independence: contributing.length ? new Set(contributing.map(fact => fact.canonicalSourceId)).size / contributing.length : 0,
      primaryFacts: gap.primaryFacts,
      supportingFacts: [],
    }
  })
}

export function augmentFindingsWithScoresV2(facts: ReportFactV2[], findings: ReportFindingV2[]): ReportFindingV2[] {
  const scoreFindings = buildScoreFindingsV2(facts)
  const merged = new Map([...findings, ...scoreFindings].map(finding => [finding.id, finding]))
  return [...merged.values()].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))
}
