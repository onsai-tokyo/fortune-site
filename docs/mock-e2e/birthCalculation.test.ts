import test from 'node:test'
import assert from 'node:assert/strict'
import { webBirthCalculation, personalReadingReady } from '../../frontend/src/web/data/birthCalculation'
import { selfTimingHistoryFromBirthSnapshot } from '../../backend/src/lib/report/coupleTimingHistory'

test('Web unknown birthplace keeps place and time unknown but specifies its calendar convention', () => {
  const profile = { birthDate: '1990-04-15', gender: 'male' as const, birthTime: null, birthPlace: '', nickname: '' }
  const data = webBirthCalculation(profile)
  assert.equal(data.birthplace, '')
  assert.equal(data.birthTime, null)
  assert.equal(data.birthTimeZone, 'Asia/Tokyo')
  assert.notEqual(JSON.stringify(data), JSON.stringify(profile), 'old incomplete operations must not be reused')
})

test('actual timeline engine produces years for optional empty birthplace/time for both genders', () => {
  const previous = process.env.ANNUAL_READING_ENGINE
  process.env.ANNUAL_READING_ENGINE = 'timeline3'
  try {
    for (const gender of ['male', 'female'] as const) {
      for (const birthPlace of ['', '東京都']) {
        const data = webBirthCalculation({ birthDate: '1990-04-15', gender, birthTime: null, birthPlace, nickname: '' })
        assert.equal(selfTimingHistoryFromBirthSnapshot(data, 2026).cards.length, 19)
        // JSON persisted input must use exactly the same calculation conditions.
        assert.deepEqual(selfTimingHistoryFromBirthSnapshot(JSON.parse(JSON.stringify(data)), 2026),
          selfTimingHistoryFromBirthSnapshot(data, 2026))
      }
    }
  } finally {
    if (previous === undefined) delete process.env.ANNUAL_READING_ENGINE
    else process.env.ANNUAL_READING_ENGINE = previous
  }
})

test('empty years or chapters cannot count as a completed personal reading', () => {
  assert.equal(personalReadingReady([], [{}]), false)
  assert.equal(personalReadingReady([{}], []), false)
  assert.equal(personalReadingReady([], []), false)
  assert.equal(personalReadingReady([{}], [{}]), true)
})
