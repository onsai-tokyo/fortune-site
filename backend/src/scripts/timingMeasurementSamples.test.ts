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

test('independent draws reach all minutes and include leap days without mod-linked gender/place', async () => {
  const { timingDraw } = await import('./timingMeasurementSamples.js')
  const minutes = new Set(Array.from({ length: 30_000 }, (_, i) => timingDraw('support-test', i, 'minute-of-day', 1440)))
  assert.equal(minutes.size, 1440)
  const samples = timingMeasurementProfiles(10_000, 'support-test')
  assert.ok(samples.some(p => p.birthMonth === 2 && p.birthDay === 29))
  for (let hour = 0; hour < 24; hour++) {
    assert.equal(new Set(samples.filter(p => p.birthHour === hour).map(p => p.gender)).size, 2)
    assert.equal(new Set(samples.filter(p => p.birthHour === hour).map(p => p.birthplace)).size, 3)
  }
})
test('midrank handles ties and missing population separately from usability', async () => {
  const { timingMidrank } = await import('./timingMeasurementSamples.js')
  assert.deepEqual(timingMidrank(0, [0,0,0]), { value: .5, usable: false, reason: 'all_tied' })
  assert.deepEqual(timingMidrank(0, []), { value: null, usable: false, reason: 'empty_population' })
  assert.equal(timingMidrank(2, [3,2,1]).value, .5)
  assert.deepEqual(timingMidrank(2, [1,2,3]), timingMidrank(2, [3,2,1]))
  assert.throws(() => timingMidrank(NaN, [0]))
})
