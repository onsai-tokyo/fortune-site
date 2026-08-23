import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGapFindings, GAP_SPECS } from './gapFindings.js'
import { ALL_TRAIT_SCORE_KEYS, type TraitScoreKey, type TraitScoreSet } from './traitScores.js'

const scoreSet = (overrides: Partial<Record<TraitScoreKey, { value: number; confidence?: number; facts?: string[] }>> = {}): TraitScoreSet =>
  Object.fromEntries(ALL_TRAIT_SCORE_KEYS.map(key => {
    const value = overrides[key]?.value ?? 0.5
    return [key, { key, value, raw: 0, contributingFacts: overrides[key]?.facts ?? [`fact:${key}`], lineages: ['ephemeris'], confidence: overrides[key]?.confidence ?? 0.8 }]
  })) as TraitScoreSet

test('PR-2eは根拠付きGap Specを10種類定義する', () => {
  assert.equal(GAP_SPECS.length, 10)
  assert.equal(new Set(GAP_SPECS.map(spec => spec.key)).size, 10)
  assert.ok(GAP_SPECS.every(spec => spec.sources.length > 0 && spec.sources.every(source => /^性格§\d+$/.test(source))))
})

test('正方向と逆方向を別keyで発火し、連続値と根拠Factを保持する', () => {
  const positive = buildGapFindings(scoreSet({
    attraction_charisma: { value: 0.9, facts: ['charisma'] },
    compatibility_stability: { value: 0.4, facts: ['stability'] },
  }))
  const finding = positive.find(item => item.key === 'gap:attraction-compatibility')!
  assert.equal(finding.gap, 0.5)
  assert.equal(finding.confidence, 0.9)
  assert.deepEqual(finding.primaryFacts, ['charisma', 'stability'])

  const aligned = buildGapFindings(scoreSet({ attraction_charisma: { value: 0.2 }, compatibility_stability: { value: 0.8 } }))
  assert.ok(aligned.some(item => item.key === 'gap:attraction-compatibility:aligned' && item.gap === 0.6))
})

test('confidence不足と閾値未満はGap Findingにしない', () => {
  assert.equal(buildGapFindings(scoreSet({ attraction_charisma: { value: 0.9, confidence: 0.39 }, compatibility_stability: { value: 0.4 } })).some(item => item.key.startsWith('gap:attraction-compatibility')), false)
  assert.equal(buildGapFindings(scoreSet({ attraction_charisma: { value: 0.6 }, compatibility_stability: { value: 0.4 } })).some(item => item.key.startsWith('gap:attraction-compatibility')), false)
})

test('複数highSideは平均値と最小confidenceを使い二重Factを除く', () => {
  const findings = buildGapFindings(scoreSet({
    attraction_status: { value: 0.9, confidence: 0.7, facts: ['shared', 'status'] },
    attraction_authority: { value: 0.7, confidence: 0.6, facts: ['authority', 'shared'] },
    compatibility_transparency: { value: 0.4, confidence: 0.8, facts: ['transparency'] },
  }))
  const finding = findings.find(item => item.key === 'gap:idealization-transparency')!
  assert.equal(finding.gap, 0.4)
  assert.equal(finding.confidence, 0.7)
  assert.deepEqual(finding.primaryFacts, ['authority', 'shared', 'status', 'transparency'])
})
