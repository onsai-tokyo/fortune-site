import { TIMING_SCORE_KEYS, type TimingScoreKey } from '../lib/report/timingClaim.js'
import { TIMING_CLAIM_ASSETS } from '../lib/report/timingClaimAssets.js'
import { hardGateReason, type AnnualTimingProfile } from '../lib/report/timingClaimSelector.js'
import { timingAnnualValues, timingEventKeys } from '../lib/report/timingCards.js'
import { buildTimingScoreTimeline, type TimingEvidenceBirthInput } from '../lib/report/timingEvidencePipeline.js'
import type { TimingScoreResult } from '../lib/report/timingScoreEngine.js'
import { calcTimingCycles } from '../lib/divination/index.js'
import { timingMeasurementProfiles } from './timingMeasurementSamples.js'

const requested = Number(process.argv[2] ?? 100)
const minimumRelativeStrength = Number(process.argv[3] ?? 0.33)
if (!Number.isFinite(minimumRelativeStrength) || minimumRelativeStrength < 0 || minimumRelativeStrength > 1) {
  throw new RangeError('minimum relative strength must be in [0, 1]')
}

const percentile = (values: readonly number[], ratio: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * ratio
  const lower = Math.floor(position)
  const fraction = position - lower
  return sorted[lower]! + ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!) * fraction
}

const distribution = (values: readonly number[]) => ({
  p10: percentile(values, 0.1),
  median: percentile(values, 0.5),
  p90: percentile(values, 0.9),
  max: values.length ? Math.max(...values) : 0,
})

const looselyDetected = (score: TimingScoreResult) =>
  score.relativeStrength >= minimumRelativeStrength && score.confidence > 0 && score.sourceFamilyCount > 0
const consensusDetected = (score: TimingScoreResult) =>
  score.relativeStrength >= minimumRelativeStrength && score.confidence >= 0.5 && score.sourceFamilyCount >= 2

type Mode = 'timed' | 'untimed'
type ScoreSamples = Record<TimingScoreKey, TimingScoreResult[]>
const emptySamples = (): ScoreSamples => TIMING_SCORE_KEYS.reduce((result, key) => {
  result[key] = []
  return result
}, {} as ScoreSamples)
const samples: Record<Mode, ScoreSamples> = { timed: emptySamples(), untimed: emptySamples() }
const annualLooseCounts: Record<Mode, number[]> = { timed: [], untimed: [] }
const annualConsensusCounts: Record<Mode, number[]> = { timed: [], untimed: [] }
const personLooseRates: Record<Mode, number[]> = { timed: [], untimed: [] }
const personConsensusRates: Record<Mode, number[]> = { timed: [], untimed: [] }
const lineageHits: Record<Mode, Map<string, number>> = { timed: new Map(), untimed: new Map() }
const eligibleSpecificClaims: Record<Mode, number[]> = { timed: [], untimed: [] }

for (const profile of timingMeasurementProfiles(requested)) {
  const { id: _id, birthHour, birthMinute, ...common } = profile
  const inputs: Record<Mode, TimingEvidenceBirthInput> = {
    timed: { ...common, birthHour, birthMinute },
    untimed: common,
  }
  for (const mode of ['timed', 'untimed'] as const) {
    const timeline = buildTimingScoreTimeline(inputs[mode])
    const timing = calcTimingCycles(common.birthYear, common.birthMonth, common.birthDay,
      mode === 'timed' ? birthHour : undefined, mode === 'timed' ? birthMinute : 0, common.gender)
    const eventYears = new Map<string, number[]>()
    for (const annual of timing.annual) for (const event of timingEventKeys(timingAnnualValues(annual))) {
      const years = eventYears.get(event) ?? []
      years.push(annual.year)
      eventYears.set(event, years)
    }
    let loosePersonYears = 0
    let consensusPersonYears = 0
    for (const scores of timeline.scoresByYear.values()) {
      const looseCount = TIMING_SCORE_KEYS.filter(key => looselyDetected(scores[key])).length
      const consensusCount = TIMING_SCORE_KEYS.filter(key => consensusDetected(scores[key])).length
      annualLooseCounts[mode].push(looseCount)
      annualConsensusCounts[mode].push(consensusCount)
      if (looseCount > 0) loosePersonYears += 1
      if (consensusCount > 0) consensusPersonYears += 1
      for (const key of TIMING_SCORE_KEYS) samples[mode][key].push(scores[key])
    }
    for (const annual of timing.annual) {
      const scores = timeline.scoresByYear.get(annual.year)!
      const domains = timingEventKeys(timingAnnualValues(annual))
      const profile: AnnualTimingProfile = {
        year: annual.year,
        activeDomains: new Set(domains),
        displayEvents: domains.map(event => {
          const years = eventYears.get(event) ?? []
          return { event, occurrenceIndex: years.indexOf(annual.year), clusterCount: years.length, strength: annual.score >= 6 ? 'strong' : 'possible' }
        }),
        scores,
        relationshipStatus: 'unknown', workStatus: 'unknown', history: new Set(), context: {},
      }
      eligibleSpecificClaims[mode].push(TIMING_CLAIM_ASSETS.filter(asset =>
        asset.specificity !== 'fallback' && hardGateReason(asset, profile) === null).length)
    }
    for (const definitions of timeline.byYear.values()) {
      const seen = new Set<string>()
      for (const item of definitions) {
        if (!item.available || !item.matched || item.support <= 0 || (item.polarity ?? 1) < 0) continue
        const identity = `${item.scoreKey}\u0000${item.factLineageId}`
        if (seen.has(identity)) continue
        seen.add(identity)
        lineageHits[mode].set(identity, (lineageHits[mode].get(identity) ?? 0) + 1)
      }
    }
    personLooseRates[mode].push(loosePersonYears / timeline.years.length)
    personConsensusRates[mode].push(consensusPersonYears / timeline.years.length)
  }
}

const summarizeMode = (mode: Mode) => ({
  looseGate: {
    rule: `relativeStrength >= ${minimumRelativeStrength}, confidence > 0, sourceFamilyCount > 0`,
    annualActivatedScoreCount: distribution(annualLooseCounts[mode]),
    annualAnyActivationRatio: annualLooseCounts[mode].filter(value => value > 0).length / annualLooseCounts[mode].length,
    personAnnualActivationRate: distribution(personLooseRates[mode]),
  },
  consensusDiagnosticGate: {
    rule: `relativeStrength >= ${minimumRelativeStrength}, confidence >= 0.5, sourceFamilyCount >= 2`,
    annualActivatedScoreCount: distribution(annualConsensusCounts[mode]),
    annualAnyActivationRatio: annualConsensusCounts[mode].filter(value => value > 0).length / annualConsensusCounts[mode].length,
    personAnnualActivationRate: distribution(personConsensusRates[mode]),
  },
  scores: Object.fromEntries(TIMING_SCORE_KEYS.map(key => {
    const values = samples[mode][key]
    return [key, {
      rawSupport: distribution(values.map(item => item.rawSupport)),
      relativeStrength: distribution(values.map(item => item.relativeStrength)),
      confidence: distribution(values.map(item => item.confidence)),
      sourceFamilyCount: distribution(values.map(item => item.sourceFamilyCount)),
      nonZeroRatio: values.filter(item => item.rawSupport > 0).length / values.length,
      looseActivationRatio: values.filter(looselyDetected).length / values.length,
      consensusDiagnosticRatio: values.filter(consensusDetected).length / values.length,
      singleFamilyLooseActivationRatio: values.filter(item => looselyDetected(item) && item.sourceFamilyCount === 1).length / values.length,
    }]
  })),
  lineageHitRates: [...lineageHits[mode].entries()]
    .map(([identity, count]) => {
      const [scoreKey, factLineageId] = identity.split('\u0000') as [TimingScoreKey, string]
      return { scoreKey, factLineageId, ratio: count / (requested * 43) }
    })
    .sort((left, right) => right.ratio - left.ratio || left.scoreKey.localeCompare(right.scoreKey) || left.factLineageId.localeCompare(right.factLineageId)),
  claimEligibility: {
    note: 'traits/history/runtime context are intentionally absent; counts only currently resolvable score/event claims',
    eligibleSpecificClaimCount: distribution(eligibleSpecificClaims[mode]),
    anyEligibleSpecificClaimRatio: eligibleSpecificClaims[mode].filter(count => count > 0).length / eligibleSpecificClaims[mode].length,
  },
})

process.stdout.write(`${JSON.stringify({
  sampleCount: requested,
  personYearsPerMode: requested * 43,
  provisionalThreshold: minimumRelativeStrength,
  warning: 'shadow descriptive measurement only; this does not authorize threshold calibration or production cutover',
  timed: summarizeMode('timed'),
  untimed: summarizeMode('untimed'),
}, null, 2)}\n`)
