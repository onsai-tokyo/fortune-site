import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnoseVimshottariInterval } from './vimshottariDiagnostic.js'

const input = { birthInstant: '2000-01-01T00:00:00Z', siderealMoonLongitude: 0, sourceRef: 'synthetic-moon-at-mansion-start',
  from: '2000-01-01T00:00:00Z', until: '2001-01-01T00:00:00Z' }
test('one year can overlap different minor periods; do not assign one label to the year', () => {
  const value = diagnoseVimshottariInterval(input)
  assert.equal(value.available, true)
  assert.deepEqual(value.periods.map(p => [p.major, p.minor]), [['Ketu', 'Ketu'], ['Ketu', 'Venus']])
  assert.equal(Date.parse(value.periods[0].end) - Date.parse(input.birthInstant), 12_886_020_000)
  assert.equal(value.periods[0].end, value.periods[1].start)
  assert.equal(value.qualityEligible, false)
  assert.equal(value.trainingEligible, false)
  assert.equal(value.productionEligible, false)
})
test('half-open period boundaries and explicit timezone are respected', () => {
  const first = diagnoseVimshottariInterval(input).periods[0]
  assert.equal(diagnoseVimshottariInterval({ ...input, until: first.end }).periods.length, 1)
  assert.equal(diagnoseVimshottariInterval({ ...input, from: first.end }).periods[0].minor, 'Venus')
  assert.deepEqual(diagnoseVimshottariInterval({ ...input, birthInstant: '2000-01-01T09:00:00+09:00' }), diagnoseVimshottariInterval(input))
})
test('unknown time or Moon never becomes a noon chart or a negative result', () => {
  for (const missing of [{ birthInstant: null }, { siderealMoonLongitude: null }]) {
    const value = diagnoseVimshottariInterval({ ...input, ...missing })
    assert.equal(value.available, false)
    assert.deepEqual(value.periods, [])
  }
  for (const invalid of [{ siderealMoonLongitude: 360 }, { siderealMoonLongitude: NaN }, { sourceRef: '' },
    { birthInstant: '2000-02-30T00:00:00Z' }, { birthInstant: '2000-01-01T24:00:00Z' }, { from: '2000-01-01' }, { until: input.from }]) {
    assert.throws(() => diagnoseVimshottariInterval({ ...input, ...invalid }))
  }
})
