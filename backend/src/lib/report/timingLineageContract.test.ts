import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTimingEvidenceTimeline } from './timingEvidencePipeline.js'
import { TIMING_LINEAGE_CONTRACT } from './timingLineageContract.js'

test('第1弾カタログ26件はID重複なしで3スコアを覆う', () => {
  assert.equal(TIMING_LINEAGE_CONTRACT.length, 26)
  assert.equal(new Set(TIMING_LINEAGE_CONTRACT.map(item => item.factLineageId)).size, 26)
  assert.deepEqual(
    Object.fromEntries(['relationship_disruption', 'relationship_idealization', 'career_activation'].map(key => [key, TIMING_LINEAGE_CONTRACT.filter(item => item.scoreKey === key).length])),
    { relationship_disruption: 11, relationship_idealization: 4, career_activation: 11 },
  )
})

test('接続対象25件は実Evidence定義と系統・寄与・極性が一致する', () => {
  const timeline = buildTimingEvidenceTimeline({
    birthYear: 1995, birthMonth: 2, birthDay: 20, birthHour: 3, birthMinute: 2,
    gender: 'female', birthplace: '愛知県',
  })
  const definitions = [...timeline.byYear.values()].flat()
  for (const contract of TIMING_LINEAGE_CONTRACT) {
    const matches = definitions.filter(item => item.scoreKey === contract.scoreKey && item.factLineageId === contract.factLineageId)
    if (contract.status === 'mathematically_impossible') {
      assert.equal(matches.length, 0, `${contract.factLineageId} は成立不能なので定義しない`)
      continue
    }
    assert.ok(matches.length > 0, `未接続: ${contract.factLineageId}`)
    for (const item of matches) {
      assert.equal(item.sourceFamily, contract.sourceFamily)
      assert.equal(item.maximumContribution, contract.maximumContribution)
      assert.equal(item.polarity ?? 1, contract.polarity)
      if (contract.status === 'upstream_missing') assert.equal(item.available, false)
    }
  }
})

test('同じIDを別スコアへ誤接続しない', () => {
  const ids = new Map(TIMING_LINEAGE_CONTRACT.map(item => [item.factLineageId, item.scoreKey]))
  const timeline = buildTimingEvidenceTimeline({ birthYear: 1990, birthMonth: 7, birthDay: 12, birthHour: 12, gender: 'male', birthplace: '東京都' })
  for (const item of [...timeline.byYear.values()].flat()) {
    const expected = ids.get(item.factLineageId)
    if (expected) assert.equal(item.scoreKey, expected, `${item.factLineageId} の接続先が違う`)
  }
})
