import { buildMonthlyTimingScoreTimeline, buildTimingScoreTimeline } from '../lib/report/timingEvidencePipeline.js'
import { CASE_A_TIMING_BENCHMARK, evaluateKnownTimingCase, evaluateKnownTimingMonths, measureUnlabelledTimingActivation } from '../lib/report/timingKnownEventBenchmark.js'

const timeline = buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input)
const events = evaluateKnownTimingCase(CASE_A_TIMING_BENCHMARK, timeline)
const unlabelled = measureUnlabelledTimingActivation(CASE_A_TIMING_BENCHMARK, timeline)
const monthly = evaluateKnownTimingMonths(CASE_A_TIMING_BENCHMARK, buildMonthlyTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input))
const monthlyByEvent = new Map(monthly.map(item => [item.event.id, item.claimEligibleScoresByMonth]))

process.stdout.write(`${JSON.stringify({
  caseId: CASE_A_TIMING_BENCHMARK.id,
  warning: 'known events are validation labels only; not training rules or production prose',
  eventCount: events.length,
  events: events.map(item => ({
    id: item.event.id,
    year: item.event.year,
    months: item.event.months,
    note: item.event.note,
    expectedScores: item.event.expectedScores,
    looseDetectedScores: item.detectedScores,
    claimEligibleScores: item.claimEligibleScores,
    monthlyClaimEligibleScores: monthlyByEvent.get(item.event.id) ?? {},
    diagnostics: item.diagnostics,
  })),
  summary: {
    eventsWithLooseDetection: events.filter(item => item.detectedScores.length > 0).length,
    eventsWithClaimEligibleDetection: events.filter(item => item.claimEligibleScores.length > 0).length,
    expectedScoreCount: events.reduce((sum, item) => sum + item.event.expectedScores.length, 0),
    looseDetectedExpectedScoreCount: events.reduce((sum, item) => sum + item.detectedScores.length, 0),
    claimEligibleExpectedScoreCount: events.reduce((sum, item) => sum + item.claimEligibleScores.length, 0),
    unlabelledYears: unlabelled.length,
    unlabelledYearsWithLooseActivation: unlabelled.filter(item => item.activatedScores.length > 0).length,
  },
}, null, 2)}\n`)
