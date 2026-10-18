import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGapFindings, evaluateGapScores, GAP_SPECS } from './gapFindings.js'
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

test('missing, nonfinite and equal scores cannot create a directional gap', () => {
  for (const value of [NaN, Infinity]) {
    const scores = scoreSet({ career_absorption: { value }, romantic_absorption: { value: .95 } })
    assert.equal(buildGapFindings(scores).some(f => f.key.startsWith('gap:career-romantic')), false)
  }
  assert.equal(buildGapFindings(scoreSet({ career_absorption: { value: .6, facts: [] }, romantic_absorption: { value: .95 } })).some(f => f.key.startsWith('gap:career-romantic')), false)
  assert.ok(buildGapFindings(scoreSet({ career_absorption: { value: .6 }, romantic_absorption: { value: .95 } })).some(f => f.key === 'gap:career-romantic:aligned'))
  for (const value of [.1, .95]) assert.equal(buildGapFindings(scoreSet({ attraction_charisma: { value }, compatibility_stability: { value } })).some(f => f.key.startsWith('gap:attraction-compatibility')), false)
})


test('equal high and equal low retain both values and evidence without inventing a coexistence cutoff', () => {
  const spec = GAP_SPECS.find(s => s.key === 'gap:attraction-compatibility')!
  for (const value of [.95, .1]) {
    const evaluation = evaluateGapScores(scoreSet({ attraction_charisma: { value }, compatibility_stability: { value } }), spec)
    assert.equal(evaluation.status, 'observed')
    if (evaluation.status !== 'observed') throw new Error('expected observed')
    assert.equal(evaluation.left.value, value)
    assert.equal(evaluation.right.value, value)
    assert.equal(evaluation.direction, 'equal')
    assert.equal(evaluation.gapThresholdMet, false)
    assert.equal(evaluation.coexistence, 'not_evaluated_contract_required')
    assert.deepEqual(evaluation.left.facts, ['fact:attraction_charisma'])
    assert.deepEqual(evaluation.right.facts, ['fact:compatibility_stability'])
  }
})

test('inverted comparisons retain raw right value and distinguish comparison direction', () => {
  const spec = GAP_SPECS.find(s => s.key === 'gap:social-private')!
  const result = evaluateGapScores(scoreSet({ social_extraversion: { value: .8 }, private_introversion: { value: .9 } }), spec)
  assert.equal(result.status, 'observed')
  if (result.status !== 'observed') throw new Error('expected observed')
  assert.equal(result.right.value, .9)
  assert.ok(Math.abs(result.comparedRightValue - .1) < 1e-12)
  assert.equal(result.invertedRight, true)
  assert.equal(result.direction, 'forward')
})

test('malformed confidence, missing scores and empty evidence never create directional claims', () => {
  const spec = GAP_SPECS.find(s => s.key === 'gap:career-romantic')!
  for (const bad of [null, undefined, NaN, Infinity, -1, 1.01, '0.8']) {
    const scores = scoreSet({ career_absorption: { value: .95 }, romantic_absorption: { value: .1 } })
    scores.career_absorption.confidence = bad as number
    assert.equal(evaluateGapScores(scores, spec).status, 'unknown')
    assert.deepEqual(buildGapFindings(scores, [spec]), [])
  }
  for (const bad of [null, undefined, NaN, Infinity, -1, 1.01, '0.8']) {
    const scores = scoreSet({ career_absorption: { value: .95 }, romantic_absorption: { value: .1 } })
    scores.career_absorption.value = bad as number
    assert.equal(evaluateGapScores(scores, spec).status, 'unknown')
    assert.deepEqual(buildGapFindings(scores, [spec]), [])
  }
  const scores = scoreSet({ career_absorption: { value: .95, facts: [''] }, romantic_absorption: { value: .1 } })
  assert.equal(evaluateGapScores(scores, spec).status, 'unknown')
  delete (scores as Partial<TraitScoreSet>).career_absorption
  assert.equal(evaluateGapScores(scores, spec).status, 'unknown')
})

test('runtime trace preserves reverse direction and does not affect findings', () => {
  const scores = scoreSet({ career_absorption: { value: .6 }, romantic_absorption: { value: .95 } })
  let observed = false
  const traced = buildGapFindings(scores, GAP_SPECS, rows => {
    observed = true
    const row = rows.find(r => r.key === 'gap:career-romantic')!
    assert.equal(row.status, 'observed')
    if (row.status !== 'observed') throw new Error('expected observed')
    assert.equal(row.direction, 'reverse')
    assert.equal(row.left.value, .6)
    assert.equal(row.right.value, .95)
  })
  assert.ok(observed)
  assert.deepEqual(traced, buildGapFindings(scores))
  assert.ok(!traced.some(f => f.key === 'gap:career-romantic'))
})
