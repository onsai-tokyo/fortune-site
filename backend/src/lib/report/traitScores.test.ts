import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildCalibrationFixtures } from './fixtures.js'
import type { ReportFactV2 } from './factsV2.js'
import { bootstrapTraitScoreScale, calibrateTraitScoreScale } from './traitScoreScale.js'
import {
  ALL_TRAIT_SCORE_KEYS, RESERVED_TRAIT_SCORE_KEYS, REQUIRED_TRAIT_SCORE_KEYS, TRAIT_SCORE_RULES, computeTraitScores, matchesTraitFact,
  normalizeTraitScore, traitScoreConfidence, type TraitScoreRule,
} from './traitScores.js'
import { auditRuleSourceDocument, extractRuleSourceSections, parseTraitScoreRuleSource, validateTraitScoreRules } from './traitScoreRuleValidation.js'

const fact = (overrides: Partial<ReportFactV2> = {}): ReportFactV2 => ({
  id: 'fact-a', system: '西洋占星術', lineage: 'ephemeris', factor: 'planet:月:魚座', axis: 'relation', signal: 'sensitivity',
  polarity: 1, strength: 0.8, requiresBirthTime: false, signature: false, derivations: [{ key: 'moon-longitude', weight: 1 }],
  canonicalSourceId: 'moon-longitude', votesInConsensus: true, ...overrides,
})

test('PR-2bは45+10+11+5の71スコアを一意に定義する', () => {
  assert.equal(ALL_TRAIT_SCORE_KEYS.length, 71)
  assert.equal(new Set(ALL_TRAIT_SCORE_KEYS).size, 71)
  assert.equal(TRAIT_SCORE_RULES.length, 90)
})

test('原典に根拠がない保留キーは推測ルールを要求せずconfidence 0を返す', () => {
  assert.deepEqual(RESERVED_TRAIT_SCORE_KEYS, ['attraction_physical'])
  assert.equal(REQUIRED_TRAIT_SCORE_KEYS.length, 70)
  const scores = computeTraitScores([], TRAIT_SCORE_RULES, bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  assert.equal(scores.attraction_physical.confidence, 0)
  assert.deepEqual(scores.attraction_physical.contributingFacts, [])
})

test('校正用1000件は固定回帰fixtureと分離され再現可能である', () => {
  const first = buildCalibrationFixtures(1000)
  const second = buildCalibrationFixtures(1000)
  assert.equal(first.length, 1000)
  assert.deepEqual(first, second)
  assert.equal(new Set(first.map(item => item.id)).size, 1000)
  assert.ok(first.some(item => item.birthTime === null))
  assert.ok(first.some(item => item.birthTime !== null))
  assert.throws(() => buildCalibrationFixtures(0), /positive integer/)
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
  const aspect = fact({ factor: 'structuredAspect:金星:スクエア:冥王星:orb2', axis: 'domain-love', signal: 'transformation' })
  assert.equal(matchesTraitFact(aspect, { factorPrefix: ['structuredAspect:'], factorIncludesAll: ['金星', '冥王星'] }), true)
  assert.equal(matchesTraitFact(aspect, { factorIncludesAll: ['金星', '土星'] }), false)
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

test('根拠文書は期待する全項番の欠落・重複・範囲外を検出する', () => {
  const complete = auditRuleSourceDocument('# 1. A\n\n# 2. B\n\n# 3. C\n', 3)
  assert.equal(complete.complete, true)
  assert.deepEqual(complete.sections, [1, 2, 3])

  const invalid = auditRuleSourceDocument('# 1. A\n\n# 1. duplicate\n\n# 3. C\n\n# 4. extra\n', 3)
  assert.equal(invalid.complete, false)
  assert.deepEqual(invalid.missingSections, [2])
  assert.deepEqual(invalid.duplicateSections, [1])
  assert.deepEqual(invalid.outOfRangeSections, [4])
  assert.throws(() => auditRuleSourceDocument('', 0), /positive integer/)
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
  const sourceDocument = readFileSync(new URL('./rules/PERSONALITY_RULES.md', import.meta.url), 'utf8')
  const availableSections = extractRuleSourceSections(sourceDocument)
  assert.deepEqual([...availableSections], Array.from({ length: 58 }, (_, index) => index + 1))
  const result = validateTraitScoreRules(TRAIT_SCORE_RULES, {
    availableSections: { 性格: availableSections },
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

test('R-4第1弾は§3・§14・§16・§24の発行済みFactを根拠にスコア化する', () => {
  const facts = [
    fact({ id: 'fixed', factor: 'modalityDominant:fixed:5', axis: 'drive', signal: 'stability', canonicalSourceId: 'modality:fixed' }),
    fact({ id: 'sun-leo', factor: 'planet:太陽:獅子座', axis: 'drive', signal: 'expression', canonicalSourceId: 'planet:太陽' }),
    fact({ id: 'air', factor: 'elementDominant:air:4', axis: 'cognition', signal: 'communication', canonicalSourceId: 'element:air' }),
    fact({ id: 'moon-libra', factor: 'planet:月:天秤座', axis: 'relation', signal: 'harmony', canonicalSourceId: 'planet:月' }),
    fact({ id: 'sun-moon', factor: 'structuredAspect:太陽:スクエア:月:orb2', axis: 'tension', signal: 'integration', polarity: -1, canonicalSourceId: 'aspect:太陽-月' }),
  ]
  const scores = computeTraitScores(facts, TRAIT_SCORE_RULES, bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  assert.ok(scores.immersion_intensity.raw > 0)
  assert.ok(scores.pride_sensitivity.raw > 0)
  assert.ok(scores.social_neutrality.raw > 0)
  assert.ok(scores.neutrality_pride.raw > 0)
  assert.ok(scores.social_sensitivity.raw > 0)
  assert.ok(scores.public_agreeableness.raw > 0)
  assert.ok(scores.emotional_volatility.raw > 0)
  assert.equal(scores.private_assertiveness.confidence, 0)
})

test('R-4第2弾は引力・没頭と長期適合を別スコアとして保持する', () => {
  const facts = [
    fact({ id: 'career', factor: 'house:10:火星', axis: 'domain-work', signal: 'responsibility', canonicalSourceId: 'house:10' }),
    fact({ id: 'approval', factor: 'house:10:月', axis: 'domain-work', signal: 'responsibility', canonicalSourceId: 'house:10' }),
    fact({ id: 'romance', factor: 'house:5:金星', axis: 'domain-love', signal: 'expression', canonicalSourceId: 'house:5' }),
    fact({ id: 'venus-pluto', factor: 'structuredAspect:金星:コンジャンクション:冥王星:orb1', axis: 'domain-love', signal: 'transformation', canonicalSourceId: 'aspect:冥王星-金星' }),
    fact({ id: 'venus-uranus', factor: 'structuredAspect:天王星:トライン:金星:orb2', axis: 'domain-love', signal: 'harmony', canonicalSourceId: 'aspect:天王星-金星' }),
    fact({ id: 'venus-saturn', factor: 'structuredAspect:土星:スクエア:金星:orb2', axis: 'domain-love', signal: 'responsibility', polarity: -1, canonicalSourceId: 'aspect:土星-金星' }),
    fact({ id: 'house4-moon', factor: 'house:4:月', axis: 'relation', signal: 'care', canonicalSourceId: 'house:4' }),
    fact({ id: 'house7-saturn', factor: 'house:7:土星', axis: 'domain-love', signal: 'harmony', canonicalSourceId: 'house:7' }),
  ]
  const scores = computeTraitScores(facts, TRAIT_SCORE_RULES, bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  for (const key of [
    'career_absorption', 'romantic_absorption', 'approval_need', 'attraction_intensity', 'charisma_attraction', 'attraction_charisma',
    'novelty_attraction', 'attraction_novelty', 'compatibility_stability', 'compatibility_reliability', 'compatibility_domestic',
  ] as const) assert.ok(scores[key].raw > 0, key)
})

test('R-4第3弾は距離感・計画性・友情を個人配置からスコア化する', () => {
  const facts = [
    fact({ id: 'moon-neptune', factor: 'structuredAspect:海王星:トライン:月:orb1', axis: 'relation', signal: 'sensitivity', canonicalSourceId: 'aspect:月-海王星' }),
    fact({ id: 'mutable', factor: 'modalityDominant:mutable:5', axis: 'drive', signal: 'adaptability', canonicalSourceId: 'modality:mutable' }),
    fact({ id: 'saturn-capricorn', factor: 'planet:土星:山羊座', axis: 'drive', signal: 'responsibility', canonicalSourceId: 'planet:土星' }),
    fact({ id: 'house7-saturn', factor: 'house:7:土星', axis: 'domain-love', signal: 'responsibility', canonicalSourceId: 'house:7' }),
    fact({ id: 'house10-sun', factor: 'house:10:太陽', axis: 'domain-work', signal: 'expression', canonicalSourceId: 'house:10' }),
    fact({ id: 'house12-pluto', factor: 'house:12:冥王星', axis: 'shadow', signal: 'transformation', canonicalSourceId: 'house:12' }),
    fact({ id: 'moon-scorpio', factor: 'planet:月:蠍座', axis: 'relation', signal: 'depth', canonicalSourceId: 'planet:月' }),
    fact({ id: 'fixed', factor: 'modalityDominant:fixed:5', axis: 'drive', signal: 'stability', canonicalSourceId: 'modality:fixed' }),
    fact({ id: 'house9-mercury', factor: 'house:9:水星', axis: 'cognition', signal: 'communication', canonicalSourceId: 'house:9' }),
    fact({ id: 'house11-uranus', factor: 'house:11:天王星', axis: 'relation', signal: 'independence', canonicalSourceId: 'house:11' }),
    fact({ id: 'house10-mars', factor: 'house:10:火星', axis: 'domain-work', signal: 'responsibility', canonicalSourceId: 'house:10:mars' }),
    fact({ id: 'house4-moon', factor: 'house:4:月', axis: 'relation', signal: 'care', canonicalSourceId: 'house:4' }),
  ]
  const scores = computeTraitScores(facts, TRAIT_SCORE_RULES, bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  for (const key of [
    'partner_mirroring', 'lifestyle_adaptability', 'social_conformity', 'plan_orientation', 'marriage_binding',
    'recognition_motivation', 'loneliness_tendency', 'self_complexity', 'relationship_boundary_strength', 'tolerance',
    'friendship_value_match', 'friendship_orientation', 'life_stage_alignment', 'friendship_independence',
    'effort_respect', 'respect_attraction', 'group_coordination',
  ] as const) assert.ok(scores[key].raw > 0, key)
})

test('R-4第4弾は感情表現・会話・好奇心・友達型恋愛を分離して保持する', () => {
  const facts = [
    fact({ id: 'moon-cancer', factor: 'planet:月:蟹座', axis: 'relation', signal: 'care', canonicalSourceId: 'planet:月' }),
    fact({ id: 'mercury-sagittarius', factor: 'planet:水星:射手座', axis: 'cognition', signal: 'communication', canonicalSourceId: 'planet:水星' }),
    fact({ id: 'mercury-scorpio', factor: 'planet:水星:蠍座', axis: 'cognition', signal: 'depth', canonicalSourceId: 'planet:水星:scorpio' }),
    fact({ id: 'venus-saturn', factor: 'structuredAspect:土星:トライン:金星:orb2', axis: 'domain-love', signal: 'responsibility', canonicalSourceId: 'aspect:土星-金星' }),
    fact({ id: 'house7-saturn', factor: 'house:7:土星', axis: 'domain-love', signal: 'responsibility', canonicalSourceId: 'house:7:saturn' }),
    fact({ id: 'moon-taurus', factor: 'planet:月:牡牛座', axis: 'relation', signal: 'stability', canonicalSourceId: 'planet:月:taurus' }),
    fact({ id: 'house7-mercury', factor: 'house:7:水星', axis: 'domain-love', signal: 'communication', canonicalSourceId: 'house:7:mercury' }),
    fact({ id: 'house11-mercury', factor: 'house:11:水星', axis: 'relation', signal: 'communication', canonicalSourceId: 'house:11:mercury' }),
  ]
  const scores = computeTraitScores(facts, TRAIT_SCORE_RULES, bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  for (const key of [
    'emotional_expression', 'playfulness', 'compatibility_playfulness', 'conversation_entertainment',
    'intellectual_attraction', 'attraction_intellectual', 'gossip_curiosity', 'taboo_curiosity',
    'age_gap_attraction', 'attraction_age_gap', 'authority_attraction', 'attraction_authority',
    'stability_preference', 'compatibility_emotional_safety', 'attraction_friendship',
    'compatibility_friendship', 'friendship_binding', 'long_term_binding',
  ] as const) assert.ok(scores[key].raw > 0, key)
})
