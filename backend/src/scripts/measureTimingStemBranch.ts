import { calcTimingCycles } from '../lib/divination/index.js'
import { computeTimingScore } from '../lib/report/timingScoreEngine.js'
import { buildStemBranchTimingEvidence } from '../lib/report/timingStemBranchEvidence.js'
import { timingMeasurementProfiles } from './timingMeasurementSamples.js'

const requested = Number(process.argv[2] ?? 100)
const percentile = (values: number[], ratio: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * ratio
  const lower = Math.floor(position)
  const fraction = position - lower
  return sorted[lower]! + ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!) * fraction
}
const distribution = (values: number[]) => ({
  min: Math.min(...values), p10: percentile(values, 0.1), median: percentile(values, 0.5), p90: percentile(values, 0.9), max: Math.max(...values),
  nonZeroRatio: values.filter(value => value > 0).length / values.length,
})

const hitCounts = new Map<string, number>()
const disruption: number[] = []
const career: number[] = []
let familyCapHits = 0
let yearCount = 0
let timedUntimedDifferenceCount = 0

const profiles = timingMeasurementProfiles(requested)
for (const { birthYear, birthMonth, birthDay, birthHour, birthMinute, gender } of profiles) {
  const timing = calcTimingCycles(birthYear, birthMonth, birthDay, undefined, 0, gender)
  const timedTiming = calcTimingCycles(birthYear, birthMonth, birthDay, birthHour, birthMinute, gender)
  const base = { birthYear, birthMonth, birthDay, annual: timing.annual, decades: timing.decades }
  const untimed = buildStemBranchTimingEvidence(base)
  const timed = buildStemBranchTimingEvidence({ birthYear, birthMonth, birthDay, birthHour, birthMinute, annual: timedTiming.annual, decades: timedTiming.decades })
  if (JSON.stringify([...untimed]) !== JSON.stringify([...timed])) timedUntimedDifferenceCount += 1
  for (const definitions of untimed.values()) {
    yearCount += 1
    for (const item of definitions) if (item.matched) hitCounts.set(item.factLineageId, (hitCounts.get(item.factLineageId) ?? 0) + 1)
    const relationship = computeTimingScore('relationship_disruption', definitions)
    const work = computeTimingScore('career_activation', definitions)
    disruption.push(relationship.rawSupport)
    career.push(work.rawSupport)
    if (relationship.rawSupport >= 0.24 || work.rawSupport >= 0.24) familyCapHits += 1
  }
}

const output = {
  sampleCount: requested,
  uniqueProfileCount: new Set(profiles.map(profile => profile.id)).size,
  personYears: yearCount,
  aggregationWarning: 'personYears are repeated observations within people; do not treat them as independent samples',
  timedUntimedDifferenceCount,
  lineageHitRates: Object.fromEntries([...hitCounts].sort().map(([key, count]) => [key, Number((count / yearCount).toFixed(6))])),
  relationshipDisruption: distribution(disruption),
  careerActivation: distribution(career),
  familyCapHitRatio: Number((familyCapHits / yearCount).toFixed(6)),
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
