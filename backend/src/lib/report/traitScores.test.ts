import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportFactV2 } from './factsV2.js'
import { bootstrapTraitScoreScale, calibrateTraitScoreScale } from './traitScoreScale.js'
import {
  ALL_TRAIT_SCORE_KEYS, TRAIT_SCORE_RULES, computeTraitScores, matchesTraitFact,
  normalizeTraitScore, traitScoreConfidence, type TraitScoreRule,
} from './traitScores.js'
import { parseTraitScoreRuleSource, validateTraitScoreRules } from './traitScoreRuleValidation.js'

const fact = (overrides: Partial<ReportFactV2> = {}): ReportFactV2 => ({
  id: 'fact-a', system: '西洋占星術', lineage: 'ephemeris', factor: 'planet:月:魚座', axis: 'relation', signal: 'sensitivity',
  polarity: 1, strength: 0.8, requiresBirthTime: false, signature: false, derivations: [{ key: 'moon-longitude', weight: 1 }],
  canonicalSourceId: 'moon-longitude', votesInConsensus: true, ...overrides,
})

test('PR-2bは45+10+11+5の71スコアを一意に定義する', () => {
  assert.equal(ALL_TRAIT_SCORE_KEYS.length, 71)
  assert.equal(new Set(ALL_TRAIT_SCORE_KEYS).size, 71)
  assert.equal(TRAIT_SCORE_RULES.length, 11)
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

test('PR-2cルールの根拠項番を構文解析し、存在しない節を拒否する', () => {
  assert.deepEqual(parseTraitScoreRuleSource('性格§58'), { document: '性格', section: 58 })
  assert.deepEqual(parseTraitScoreRuleSource('時期§1'), { document: '時期', section: 1 })
  assert.equal(parseTraitScoreRuleSource('性格58'), null)
  assert.equal(parseTraitScoreRuleSource('性格§0'), null)

  const rules: TraitScoreRule[] = [
    { score: 'social_extraversion', match: { signal: ['communication'] }, weight: 0.8, source: '性格§1' },
    { score: 'private_introversion', match: { signal: ['sensitivity'] }, weight: 0.7, source: '性格§59' },
  ]
  const result = validateTraitScoreRules(rules, {
    availableSections: { 性格: new Set([1, 2]) },
    requiredScores: ['social_extraversion', 'private_introversion'],
  })
  assert.deepEqual(result.ruleCountByScore, { social_extraversion: 1, private_introversion: 1 })
  assert.deepEqual(result.errors, ['rule[1] references missing source: 性格§59'])
})

test('PR-2cルールの空matcher・ゼロweight・完全重複・不足スコアを検出する', () => {
  const duplicated: TraitScoreRule = {
    score: 'social_extraversion', match: {}, weight: 0, source: '性格§1',
  }
  const result = validateTraitScoreRules([duplicated, duplicated], {
    availableSections: { 性格: new Set([1]) },
    requiredScores: ['social_extraversion', 'private_introversion'],
    minimumRulesPerScore: 2,
  })
  assert.ok(result.errors.some(error => error.includes('weight must be')))
  assert.ok(result.errors.some(error => error.includes('matcher must not be empty')))
  assert.ok(result.errors.some(error => error.includes('duplicates an earlier rule')))
  assert.ok(result.errors.includes('private_introversion requires at least 2 rules; found 0'))
})

test('PR-2c確認済みルールは実在する根拠節を参照し許可された重みだけを使う', () => {
  const result = validateTraitScoreRules(TRAIT_SCORE_RULES, {
    availableSections: { 性格: new Set([1, 2, 7, 8]) },
    requiredScores: ['social_extraversion', 'private_introversion', 'attraction_respect', 'attraction_status'],
  })
  assert.deepEqual(result.errors, [])
  assert.ok(TRAIT_SCORE_RULES.every(rule => new Set([0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1]).has(Math.abs(rule.weight))))
})

test('PR-2c確認済みルールは現在発行されるfactor表記へ一致する', () => {
  const scores = computeTraitScores([
    fact({ id: 'moon-water', factor: 'planet:月:魚座', canonicalSourceId: 'planet:月' }),
    fact({ id: 'asc-fire', factor: 'ascendant:牡羊座:12.3', axis: 'expression', signal: 'initiative', canonicalSourceId: 'ascendant' }),
    fact({ id: 'venus-house-10', factor: 'house:10:金星', axis: 'domain-work', signal: 'responsibility', canonicalSourceId: 'house:10' }),
  ], TRAIT_SCORE_RULES, bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  assert.ok(scores.private_introversion.raw > 0)
  assert.ok(scores.social_extraversion.raw > 0)
  assert.ok(scores.attraction_respect.raw > 0)
  assert.ok(scores.attraction_status.raw > 0)
})
