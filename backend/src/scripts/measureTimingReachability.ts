import { buildTimingEvidenceTimeline } from '../lib/report/timingEvidencePipeline.js'
import { computeTimingScore } from '../lib/report/timingScoreEngine.js'
import { TIMING_SCORE_DESIGN_CONTRACT } from '../lib/report/timingScoreDesignContract.js'
import { timingMeasurementProfiles } from './timingMeasurementSamples.js'

const requested = Number(process.argv[2] ?? 100)
const keys = ['relationship_disruption', 'relationship_idealization', 'career_activation'] as const
const availableEnvelopeMax = {
  timed: Object.fromEntries(keys.map(key => [key, 0])) as Record<(typeof keys)[number], number>,
  untimed: Object.fromEntries(keys.map(key => [key, 0])) as Record<(typeof keys)[number], number>,
}
const observedMatchedMax = structuredClone(availableEnvelopeMax)

const profiles = timingMeasurementProfiles(requested)
for (const profile of profiles) {
  const { birthHour, birthMinute, id: _id, ...common } = profile
  const timelines = {
    timed: buildTimingEvidenceTimeline({ ...common, birthHour, birthMinute }),
    untimed: buildTimingEvidenceTimeline(common),
  }
  for (const mode of ['timed', 'untimed'] as const) {
    for (const definitions of timelines[mode].byYear.values()) {
      for (const key of keys) observedMatchedMax[mode][key] = Math.max(observedMatchedMax[mode][key], computeTimingScore(key, definitions).rawSupport)
      const allPositiveAvailable = definitions.map(item => ({
        ...item,
        matched: item.available && (item.polarity ?? 1) > 0,
        support: item.available && (item.polarity ?? 1) > 0 ? 1 : 0,
      }))
      for (const key of keys) availableEnvelopeMax[mode][key] = Math.max(availableEnvelopeMax[mode][key], computeTimingScore(key, allPositiveAvailable).rawSupport)
    }
  }
}

process.stdout.write(`${JSON.stringify({
  sampleCount: requested,
  uniqueProfileCount: new Set(profiles.map(profile => profile.id)).size,
  algebraicFullMax: Object.fromEntries(keys.map(key => [key, TIMING_SCORE_DESIGN_CONTRACT[key].fullMax])),
  availableEnvelopeMax,
  observedMatchedMax,
  jointlyReachableMax: null,
  note: 'availableEnvelopeMax forces mutually exclusive evidence simultaneously and is not a jointly reachable maximum. jointlyReachableMax remains unproven until exact rule constraints exist.',
}, null, 2)}\n`)
