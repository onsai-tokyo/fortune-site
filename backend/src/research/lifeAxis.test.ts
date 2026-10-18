import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { LIFE_AXIS_ROWS, renderLifeAxis, evaluateLifeAxis, calculateLifeAxisMinute, explainLifeAxis, type LifeAxisCalculation } from './lifeAxis.js'

test('all 600 life-axis outputs equal the submitted Python reference, without regeneration', () => {
  const expected = JSON.parse(gunzipSync(readFileSync(new URL('./assets/life-axis-v061/reference-life-axis.json.gz', import.meta.url))).toString())
  const actual = LIFE_AXIS_ROWS.map(renderLifeAxis)
  assert.equal(expected.length, 600)
  assert.deepEqual(actual, expected)
  assert.equal(new Set(actual.map(r => r.stableKey)).size, 600)
  assert.equal(new Set(actual.map(r => r.body)).size, 600)
  assert.equal(new Set(actual.map(r => r.title)).size, 100)
})

test('dictionary and structure retain reviewed source bytes', () => {
  const manifest = JSON.parse(readFileSync(new URL('./assets/life-axis-v061/PROVENANCE.json', import.meta.url), 'utf8'))
  for (const [name, sha] of Object.entries(manifest.sources)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`./assets/life-axis-v061/${name}`, import.meta.url))).digest('hex'), sha)
  }
})

test('600 calendar examples match current public calculation including source stems and directed relation', () => {
  for (const row of LIFE_AXIS_ROWS) {
    const result = calculateLifeAxisMinute(row.calendar.first, 720)
    assert.equal(result.row.dayPillar, row.dayPillar, row.calendar.first)
    assert.equal(result.row.centerStar, row.centerStar, row.calendar.first)
  }
})

test('known time computes once and accepts 3:2 without changing birth meaning', () => {
  let calls = 0
  const result = evaluateLifeAxis({ birthDate: '2000-03-14', birthTime: '3:2' }, (date, minute) => {
    calls++; assert.equal(minute, 182); return calculateLifeAxisMinute(date, minute)
  })
  assert.equal(calls, 1)
  assert.equal(result.status, 'resolved')
  assert.equal(result.scannedMinutes, 1)
})

test('unknown time scans actual 1,440 minutes, preserving all minute intervals', () => {
  const result = evaluateLifeAxis({ birthDate: '2000-02-04' })
  assert.notEqual(result.status, 'unavailable')
  assert.equal(result.scannedMinutes, 1440)
  assert.equal(result.candidates.reduce((n, c) => n + c.minuteCount, 0), 1440)
  const minutes = result.candidates.flatMap(c => c.intervals.flatMap(i => Array.from({ length: i.to - i.from + 1 }, (_, k) => i.from + k)))
  assert.equal(new Set(minutes).size, 1440)
  assert.equal(Math.min(...minutes), 0); assert.equal(Math.max(...minutes), 1439)
})

const sample = (rowIndex: number, jieDays = 1): LifeAxisCalculation => {
  const row = LIFE_AXIS_ROWS[rowIndex]
  return { row, evidence: { dayPillar: row.dayPillar, dayStem: row.dayStem, dayBranch: row.dayBranch,
    monthBranch: '子', jieDays, centerStar: row.centerStar, centerStem: row.centerStem, centerTenGod: row.centerTenGod,
    seatPrimaryStem: row.seatPrimaryStem, seatPrimaryTenGod: row.seatPrimaryTenGod, twelveStage: row.twelveStage,
    relation: row.relation.elementRelation, polarity: row.relation.polarity, sanmeiWestStar: 'fixture' } }
}

test('matching endpoints cannot hide a different center in the middle of the day', () => {
  const result = evaluateLifeAxis({ birthDate: '2000-01-01' }, (_, minute) => sample(minute === 720 ? 1 : 0))
  assert.equal(result.status, 'multiple')
  assert.equal(result.candidates.length, 2)
  assert.deepEqual(result.candidates[1].intervals, [{ from: 720, to: 720 }])
  assert.equal(result.certainty.centerStar.status, 'variable')
})

test('unchanged prose inputs do not erase variation in the actual calculation provenance', () => {
  const result = evaluateLifeAxis({ birthDate: '2000-01-01' }, (_, minute) => sample(0, minute < 500 ? 14 : 15))
  assert.equal(result.status, 'resolved')
  assert.equal(result.candidates[0].evidenceVariants.length, 2)
  assert.equal(result.certainty.jieDays.status, 'variable')
  assert.equal(result.certainty.centerStar.status, 'invariant')
})

test('one failed minute withholds all candidates rather than silently dropping uncertainty', () => {
  const result = evaluateLifeAxis({ birthDate: '2000-01-01' }, (_, minute) => {
    if (minute === 700) throw new Error('missing ephemeris')
    return sample(0)
  })
  assert.equal(result.status, 'unavailable')
  assert.equal(result.scannedMinutes, 700)
  assert.deepEqual(result.candidates, [])
  assert.deepEqual(result.certainty, {})
})

test('invalid dates and times are rejected instead of normalized to another birth', () => {
  for (const birth of [{ birthDate: '2001-02-29' }, { birthDate: '2000-02-30' },
    { birthDate: '2000-01-01', birthTime: '24:00' }, { birthDate: '2000-01-01', birthTime: '12:60' }]) {
    assert.throws(() => evaluateLifeAxis(birth))
  }
})

test('each section has specific dictionary selectors, and calculation has no feedback input', () => {
  for (const row of LIFE_AXIS_ROWS) {
    const explanations = explainLifeAxis(row)
    assert.equal(explanations.length, 7)
    assert.deepEqual(explanations[0].selectors, [`中心星=${row.centerStar}`])
    assert.ok(explanations[3].note.includes('西の星とは別'))
  }
  const input = { birthDate: '2000-03-14', birthTime: '03:02' }
  assert.deepEqual(evaluateLifeAxis(input), evaluateLifeAxis({ ...input, feedback: 'opposite', nickname: 'different' } as typeof input))
})
