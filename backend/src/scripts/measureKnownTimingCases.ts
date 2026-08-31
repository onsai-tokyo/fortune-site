import { TIMING_SCORE_KEYS, type TimingScoreKey } from '../lib/report/timingClaim.js'
import { buildMonthlyTimingScoreTimeline, buildTimingScoreTimeline } from '../lib/report/timingEvidencePipeline.js'
import { evaluateKnownTimingCase, evaluateKnownTimingMonths, KNOWN_TIMING_BENCHMARKS, measureUnlabelledTimingActivation } from '../lib/report/timingKnownEventBenchmark.js'
import type { TimingEvidenceDefinition, TimingScoreResult } from '../lib/report/timingScoreEngine.js'

const matchedEvidence = (definitions: readonly TimingEvidenceDefinition[], keys: readonly TimingScoreKey[]) =>
  definitions.filter(item => keys.includes(item.scoreKey) && item.available && item.matched && item.support > 0)
    .map(item => ({
      scoreKey: item.scoreKey,
      sourceFamily: item.sourceFamily,
      technique: item.technique,
      factLineageId: item.factLineageId,
      support: item.support,
      maximumContribution: item.maximumContribution,
      quality: item.quality ?? 1,
      polarity: item.polarity ?? 1,
      detail: item.detail,
    }))
    .sort((left, right) => left.scoreKey.localeCompare(right.scoreKey)
      || left.sourceFamily.localeCompare(right.sourceFamily)
      || left.factLineageId.localeCompare(right.factLineageId))

const scoreSnapshot = (score: TimingScoreResult) => ({
  rawSupport: score.rawSupport,
  relativeStrength: score.relativeStrength,
  confidence: score.confidence,
  sourceFamilyCount: score.sourceFamilyCount,
  correlationGroupCount: score.correlationGroupCount,
  familyContributions: score.familyContributions,
})

const signalStrength = (score: TimingScoreResult) => score.relativeStrength * score.confidence
const percentileRank = (value: number, population: readonly number[]) =>
  population.length ? population.filter(item => item <= value).length / population.length : 0

const cases = KNOWN_TIMING_BENCHMARKS.map(fixture => {
  const annual = buildTimingScoreTimeline(fixture.input)
  const monthly = buildMonthlyTimingScoreTimeline(fixture.input)
  const results = evaluateKnownTimingCase(fixture, annual)
  const monthlyResults = new Map(evaluateKnownTimingMonths(fixture, monthly)
    .map(result => [result.event.id, result.claimEligibleScoresByMonth]))
  const unlabelled = measureUnlabelledTimingActivation(fixture, annual)
  return {
    caseId: fixture.id,
    hasBirthTime: annual.hasBirthTime,
    input: fixture.input,
    events: results.map(result => ({
      id: result.event.id,
      year: result.event.year,
      months: result.event.months ?? [],
      note: result.event.note,
      expectedScores: result.event.expectedScores,
      looseDetectedScores: result.detectedScores,
      claimEligibleScores: result.claimEligibleScores,
      annualScores: Object.fromEntries(result.event.expectedScores.map(key =>
        [key, scoreSnapshot(annual.scoresByYear.get(result.event.year)![key])])),
      annualPeakDiagnostics: Object.fromEntries(result.event.expectedScores.map(key => {
        const score = annual.scoresByYear.get(result.event.year)![key]
        const percentile = percentileRank(signalStrength(score), [...annual.scoresByYear.values()].map(year => signalStrength(year[key])))
        return [key, {
          signalStrength: signalStrength(score),
          percentile,
          reliableConsensus: score.sourceFamilyCount >= 2 && score.confidence >= 0.5,
          topQuintileReliable: percentile >= 0.8 && score.sourceFamilyCount >= 2 && score.confidence >= 0.5,
        }]
      })),
      annualEvidence: matchedEvidence(annual.byYear.get(result.event.year) ?? [], result.event.expectedScores),
      monthly: Object.fromEntries((result.event.months ?? []).map(month => {
        const monthKey = `${result.event.year}-${String(month).padStart(2, '0')}`
        const scores = monthly.byMonth.get(monthKey)!
        return [month, {
          claimEligibleScores: monthlyResults.get(result.event.id)?.[month] ?? [],
          scores: Object.fromEntries(result.event.expectedScores.map(key => [key, scoreSnapshot(scores[key])])),
          peakDiagnostics: Object.fromEntries(result.event.expectedScores.map(key => {
            const score = scores[key]
            const sameYear = [...monthly.byMonth.entries()]
              .filter(([key]) => key.startsWith(`${result.event.year}-`))
              .map(([, values]) => signalStrength(values[key]))
            const percentile = percentileRank(signalStrength(score), sameYear)
            return [key, {
              signalStrength: signalStrength(score), percentile,
              topQuartileReliable: percentile >= 0.75 && score.sourceFamilyCount >= 2 && score.confidence >= 0.5,
            }]
          })),
          evidence: matchedEvidence(monthly.evidenceByMonth.get(monthKey) ?? [], result.event.expectedScores),
        }]
      })),
    })),
    summary: {
      eventCount: results.length,
      eventsWithAnyExpectedSupport: results.filter(result => result.diagnostics.some(item => item.rawSupport > 0)).length,
      eventsWithLooseDetection: results.filter(result => result.detectedScores.length > 0).length,
      eventsWithClaimEligibleDetection: results.filter(result => result.claimEligibleScores.length > 0).length,
      expectedScoreCount: results.reduce((sum, result) => sum + result.event.expectedScores.length, 0),
      supportedExpectedScoreCount: results.reduce((sum, result) => sum + result.diagnostics.filter(item => item.rawSupport > 0).length, 0),
      looseDetectedExpectedScoreCount: results.reduce((sum, result) => sum + result.detectedScores.length, 0),
      claimEligibleExpectedScoreCount: results.reduce((sum, result) => sum + result.claimEligibleScores.length, 0),
      topQuintileReliableExpectedScoreCount: results.reduce((sum, result) => sum + result.event.expectedScores.filter(key => {
        const score = annual.scoresByYear.get(result.event.year)![key]
        const percentile = percentileRank(signalStrength(score), [...annual.scoresByYear.values()].map(year => signalStrength(year[key])))
        return percentile >= 0.8 && score.sourceFamilyCount >= 2 && score.confidence >= 0.5
      }).length, 0),
      unlabelledYearCount: unlabelled.length,
      unlabelledYearsWithLooseActivation: unlabelled.filter(item => item.activatedScores.length > 0).length,
      unlabelledYearsWithClaimEligibleActivation: unlabelled.filter(item => item.claimEligibleScores.length > 0).length,
    },
  }
})

const allEvents = cases.flatMap(item => item.events)
const familyCoverage = Object.fromEntries(['western', 'vedic', 'stem_branch', 'ziwei', 'auxiliary'].map(family => [family,
  allEvents.filter(event => event.annualEvidence.some(evidence => evidence.sourceFamily === family)).length]))

process.stdout.write(`${JSON.stringify({
  warning: 'Shadow validation only. Known events are labels, never rules or production prose. Astrology correlations are not causal proof.',
  benchmarkCount: cases.length,
  eventCount: allEvents.length,
  scoreKeys: TIMING_SCORE_KEYS,
  familyCoverage,
  totals: {
    eventsWithAnyExpectedSupport: cases.reduce((sum, item) => sum + item.summary.eventsWithAnyExpectedSupport, 0),
    eventsWithLooseDetection: cases.reduce((sum, item) => sum + item.summary.eventsWithLooseDetection, 0),
    eventsWithClaimEligibleDetection: cases.reduce((sum, item) => sum + item.summary.eventsWithClaimEligibleDetection, 0),
    expectedScoreCount: cases.reduce((sum, item) => sum + item.summary.expectedScoreCount, 0),
    supportedExpectedScoreCount: cases.reduce((sum, item) => sum + item.summary.supportedExpectedScoreCount, 0),
    looseDetectedExpectedScoreCount: cases.reduce((sum, item) => sum + item.summary.looseDetectedExpectedScoreCount, 0),
    claimEligibleExpectedScoreCount: cases.reduce((sum, item) => sum + item.summary.claimEligibleExpectedScoreCount, 0),
  },
  cases,
}, null, 2)}\n`)
