import { passesTimingScoreGate } from '../lib/report/timingClaimSelector.js'
import { buildTimingEvidenceTimeline } from '../lib/report/timingEvidencePipeline.js'
import { computeTimingScore, type TimingScoreResult } from '../lib/report/timingScoreEngine.js'
import { timingMeasurementProfiles } from './timingMeasurementSamples.js'

const requested = Number(process.argv[2] ?? 100)
const scoreKeys = ['relationship_disruption', 'relationship_idealization', 'career_activation'] as const
const percentile = (values: number[], ratio: number) => {
  const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) return 0
  const position = (sorted.length - 1) * ratio; const lower = Math.floor(position); const fraction = position - lower
  return sorted[lower]! + ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!) * fraction
}
const summarize = (values: number[]) => ({ p10: percentile(values, .1), median: percentile(values, .5), p90: percentile(values, .9), max: Math.max(...values) })
type Mode = 'timed' | 'untimed'
type Sample = { result: TimingScoreResult; high: boolean }
const samples: Record<Mode, Record<(typeof scoreKeys)[number], Sample[]>> = {
  timed: { relationship_disruption: [], relationship_idealization: [], career_activation: [] },
  untimed: { relationship_disruption: [], relationship_idealization: [], career_activation: [] },
}
const personSamples: Record<Mode, Record<(typeof scoreKeys)[number], Array<{ rawMedian: number; nonZeroRate: number; highRate: number }>>> = {
  timed: { relationship_disruption: [], relationship_idealization: [], career_activation: [] },
  untimed: { relationship_disruption: [], relationship_idealization: [], career_activation: [] },
}
const profiles = timingMeasurementProfiles(requested)
for (const { birthYear, birthMonth, birthDay, birthHour, birthMinute, gender, birthplace } of profiles) {
  const common = { birthYear, birthMonth, birthDay, gender, birthplace }
  const timed = buildTimingEvidenceTimeline({ ...common, birthHour, birthMinute })
  const untimed = buildTimingEvidenceTimeline(common)

  for (const mode of ['timed', 'untimed'] as const) {
    const timeline = mode === 'timed' ? timed : untimed
    const perPerson = Object.fromEntries(scoreKeys.map(key => [key, [] as Sample[]])) as Record<(typeof scoreKeys)[number], Sample[]>
    for (const year of timeline.years) {
      const definitions = timeline.byYear.get(year) ?? []
    for (const key of scoreKeys) {
      const result = computeTimingScore(key, definitions)
        const sample = { result, high: passesTimingScoreGate({ key, op: 'gte', value: 0.66, level: 'high' }, result) }
        samples[mode][key].push(sample); perPerson[key].push(sample)
      }
    }
    for (const key of scoreKeys) {
      const items = perPerson[key]
      personSamples[mode][key].push({
        rawMedian: percentile(items.map(item => item.result.rawSupport), .5),
        nonZeroRate: items.filter(item => item.result.rawSupport > 0).length / items.length,
        highRate: items.filter(item => item.high).length / items.length,
      })
    }
  }
}

const summarizeSamples = (items: Sample[]) => {
  const results = items.map(item => item.result); const total = results.length
  const familySets = results.reduce<Record<string, number>>((counts, result) => {
    if (result.rawSupport <= 0) return counts
    const key = Object.keys(result.familyContributions).sort().join('+') || 'none'
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
  return {
    rawSupport: summarize(results.map(result => result.rawSupport)),
    relativeStrength: summarize(results.map(result => result.relativeStrength)),
    confidence: summarize(results.map(result => result.confidence)),
    sourceFamilyCount: summarize(results.map(result => result.sourceFamilyCount)),
    correlationGroupCount: summarize(results.map(result => result.correlationGroupCount)),
    nonZeroRatio: results.filter(result => result.rawSupport > 0).length / total,
    highGateRatio: items.filter(item => item.high).length / total,
    highFromSingleFamilyRatio: items.filter(item => item.high && item.result.sourceFamilyCount === 1).length / total,
    gateDiagnostics: {
      relativeStrengthAtLeast066: results.filter(result => result.relativeStrength >= .66).length / total,
      confidenceAtLeast050: results.filter(result => result.confidence >= .5).length / total,
      rawSupportAtLeast030: results.filter(result => result.rawSupport >= .3).length / total,
      twoOrMoreFamilies: results.filter(result => result.sourceFamilyCount >= 2).length / total,
    },
    familySets: Object.fromEntries(Object.entries(familySets).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  }
}
process.stdout.write(`${JSON.stringify({
  sampleCount: requested, uniqueProfileCount: new Set(profiles.map(profile => profile.id)).size, personYears: requested * 43,
  aggregationWarning: 'yearLevel observations are correlated within people; inferential comparisons must use personLevel summaries',
  personLevel: Object.fromEntries((['timed', 'untimed'] as const).map(mode => [mode, Object.fromEntries(scoreKeys.map(key => [key, {
    rawMedianAcrossPeople: summarize(personSamples[mode][key].map(item => item.rawMedian)),
    annualNonZeroRateAcrossPeople: summarize(personSamples[mode][key].map(item => item.nonZeroRate)),
    annualHighRateAcrossPeople: summarize(personSamples[mode][key].map(item => item.highRate)),
  }]))])),
  yearLevelDescriptiveOnly: true,
  timed: Object.fromEntries(scoreKeys.map(key => [key, summarizeSamples(samples.timed[key])])),
  untimed: Object.fromEntries(scoreKeys.map(key => [key, summarizeSamples(samples.untimed[key])])),
}, null, 2)}\n`)
