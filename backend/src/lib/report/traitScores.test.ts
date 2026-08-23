import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportFactV2 } from './factsV2.js'
import { bootstrapTraitScoreScale, calibrateTraitScoreScale } from './traitScoreScale.js'
import {
  ALL_TRAIT_SCORE_KEYS, TRAIT_SCORE_RULES, computeTraitScores, matchesTraitFact,
  normalizeTraitScore, traitScoreConfidence, type TraitScoreRule,
} from './traitScores.js'

const fact = (overrides: Partial<ReportFactV2> = {}): ReportFactV2 => ({
  id: 'fact-a', system: '西洋占星術', lineage: 'ephemeris', factor: 'planet:月:魚座', axis: 'relation', signal: 'sensitivity',
  polarity: 1, strength: 0.8, requiresBirthTime: false, signature: false, derivations: [{ key: 'moon-longitude', weight: 1 }],
  canonicalSourceId: 'moon-longitude', votesInConsensus: true, ...overrides,
})

test('PR-2bは45+10+11+5の71スコアを一意に定義する', () => {
  assert.equal(ALL_TRAIT_SCORE_KEYS.length, 71)
  assert.equal(new Set(ALL_TRAIT_SCORE_KEYS).size, 71)
  assert.deepEqual(TRAIT_SCORE_RULES, [])
})

test('空ルールでも71スコアを安全に返す', () => {
  const scores = computeTraitScores([], [], bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  assert.equal(Object.keys(scores).length, 71)
  assert.ok(Object.values(scores).every(score => score.raw === 0 && score.value === 0.5 && score.confidence === 0))
  assert.ok(Object.values(scores).every(score => score.contributingFacts.length === 0 && score.lineages.length === 0))
})

test('FactMatcherは完全一致とfactor前方一致を組み合わせる', () => {
  assert.equal(matchesTraitFact(fact(), { system: ['西洋占星術'], lineage: ['ephemeris'], axis: ['relation'], signal: ['sensitivity'], factorPrefix: ['planet:月:'], polarity: [1], minStrength: 0.7 }), true)
  assert.equal(matchesTraitFact(fact(), { factorPrefix: ['planet:太陽:'] }), false)
  assert.equal(matchesTraitFact(fact(), { minStrength: 0.9 }), false)
})

test('同一canonicalSourceIdは絶対寄与が最大の1件だけを採用する', () => {
  const rules: TraitScoreRule[] = [
    { score: 'private_introversion', match: { signal: ['sensitivity'] }, weight: 0.5, source: '性格§2' },
    { score: 'private_introversion', match: { factorPrefix: ['planet:月:'] }, weight: 0.9, source: '性格§2' },
  ]
  const scores = computeTraitScores([fact()], rules, bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  assert.equal(scores.private_introversion.raw, 0.72)
  assert.deepEqual(scores.private_introversion.contributingFacts, ['fact-a'])
  assert.equal(scores.private_introversion.confidence, 0.4)
})

test('正規化・confidence・校正は境界を安全に扱い再現可能である', () => {
  assert.equal(normalizeTraitScore(0, { center: 0, spread: 1 }), 0.5)
  assert.equal(traitScoreConfidence(0, 0), 0)
  assert.equal(traitScoreConfidence(4, 2), 1)
  const scales = calibrateTraitScoreScale(ALL_TRAIT_SCORE_KEYS, [
    { social_extraversion: -1 }, { social_extraversion: 0 }, { social_extraversion: 1 },
  ])
  assert.equal(scales.social_extraversion.center, 0)
  assert.equal(scales.social_extraversion.spread, 0.5)
  assert.equal(scales.private_introversion.spread, 0.001)
  assert.deepEqual(scales, calibrateTraitScoreScale(ALL_TRAIT_SCORE_KEYS, [
    { social_extraversion: -1 }, { social_extraversion: 0 }, { social_extraversion: 1 },
  ]))
})
