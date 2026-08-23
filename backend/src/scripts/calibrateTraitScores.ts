import { buildCalibrationFixtures, buildFixtureReportInput } from '../lib/report/fixtures.js'
import { buildReportFactsV2 } from '../lib/report/factsV2.js'
import { extractReportMetadata } from '../lib/report/metadata.js'
import { calibrateTraitScoreScale } from '../lib/report/traitScoreScale.js'
import {
  ALL_TRAIT_SCORE_KEYS, TRAIT_SCORE_RULES, computeTraitScores,
  type TraitScoreKey,
} from '../lib/report/traitScores.js'

const requested = Number(process.argv[2] ?? 1000)
const fixtures = buildCalibrationFixtures(requested)
const bootstrap = Object.fromEntries(ALL_TRAIT_SCORE_KEYS.map(key => [key, { center: 0, spread: 1 }])) as Record<TraitScoreKey, { center: number; spread: number }>
const rawSamples = fixtures.map(fixture => {
  const input = buildFixtureReportInput(fixture)
  const facts = buildReportFactsV2(input, extractReportMetadata(input))
  const scores = computeTraitScores(facts, TRAIT_SCORE_RULES, bootstrap)
  return Object.fromEntries(ALL_TRAIT_SCORE_KEYS.map(key => [key, scores[key].raw])) as Record<TraitScoreKey, number>
})
const implementedKeys = [...new Set(TRAIT_SCORE_RULES.map(rule => rule.score))]
const allScales = calibrateTraitScoreScale(ALL_TRAIT_SCORE_KEYS, rawSamples)
const scales = Object.fromEntries(implementedKeys.map(key => [key, allScales[key]]))

const percentile = (values: number[], ratio: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * ratio
  const lower = Math.floor(position)
  const fraction = position - lower
  return sorted[lower] + ((sorted[lower + 1] ?? sorted[lower]) - sorted[lower]) * fraction
}
const standardDeviation = (values: number[]) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
}

const distribution = Object.fromEntries(implementedKeys.map(key => {
  const values = rawSamples.map(sample => sample[key])
  return [key, {
    p10: Number(percentile(values, 0.1).toFixed(6)),
    median: Number(percentile(values, 0.5).toFixed(6)),
    p90: Number(percentile(values, 0.9).toFixed(6)),
    standardDeviation: Number(standardDeviation(values).toFixed(6)),
    nonZeroRatio: Number((values.filter(value => value !== 0).length / values.length).toFixed(6)),
    p10P90Range: Number((percentile(values, 0.9) - percentile(values, 0.1)).toFixed(6)),
  }]
}))

process.stdout.write(`${JSON.stringify({ sampleCount: fixtures.length, implementedKeys, scales, distribution }, null, 2)}\n`)
