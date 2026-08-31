import assert from 'node:assert/strict'
import test from 'node:test'
import { calcTimingCycles } from '../divination/index.js'
import { buildAdditionalStemBranchEvidence } from './timingAdditionalStemBranchEvidence.js'

const input = { birthYear: 1995, birthMonth: 2, birthDay: 20, birthHour: 3, birthMinute: 2, gender: 'female' as const }

test('提出済みルールからAさん43年分の追加干支Evidenceを再現可能に作る', () => {
  const timing = calcTimingCycles(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute, input.gender)
  const left = buildAdditionalStemBranchEvidence({ ...input, annual: timing.annual, decades: timing.decades })
  const right = buildAdditionalStemBranchEvidence({ ...input, annual: timing.annual, decades: timing.decades })
  assert.equal(left.size, 43)
  assert.deepEqual(left, right)
  const all = [...left.values()].flat()
  assert.ok(all.every(item => item.sourceFamily === 'stem_branch'))
  assert.ok(all.every(item => item.detail?.startsWith('shadow provisional /')))
  assert.ok(new Set(all.map(item => item.scoreKey)).size >= 14)
})

test('不成立Evidenceも定義として残し、未実装と非発火を区別できる', () => {
  const timing = calcTimingCycles(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute, input.gender)
  const timeline = buildAdditionalStemBranchEvidence({ ...input, annual: timing.annual, decades: timing.decades })
  for (const definitions of timeline.values()) {
    assert.equal(definitions.length, 22)
    assert.ok(definitions.some(item => !item.matched && item.support === 0))
    assert.ok(definitions.every(item => item.available || (!item.matched && item.support === 0)))
  }
})
