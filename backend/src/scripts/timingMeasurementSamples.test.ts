import assert from 'node:assert/strict'
import test from 'node:test'
import { timingMeasurementProfiles } from './timingMeasurementSamples.js'

test('測定サンプルは要求数と同数の一意な出生条件を再現可能に返す', () => {
  const first = timingMeasurementProfiles(1_000)
  const second = timingMeasurementProfiles(1_000)
  assert.equal(new Set(first.map(item => item.id)).size, 1_000)
  assert.deepEqual(first, second)
})

test('測定サンプル数の不正値を拒否する', () => {
  assert.throws(() => timingMeasurementProfiles(0), RangeError)
  assert.throws(() => timingMeasurementProfiles(1.5), RangeError)
  assert.throws(() => timingMeasurementProfiles(10_001), RangeError)
})
