import test from 'node:test'
import assert from 'node:assert/strict'
import { formatBookDate } from './bookDate'
test('book dates accept date-only fixtures and API instants in Japan time', () => {
  assert.equal(formatBookDate('2026-10-19'), '10月19日')
  assert.equal(formatBookDate('2026-10-19T15:43:06.915445+00:00'), '10月20日')
  assert.equal(formatBookDate('2026-10-19T14:59:59Z'), '10月19日')
  assert.equal(formatBookDate('2026-10-20T00:00:00+09:00'), '10月20日')
  assert.equal(formatBookDate('2026-12-31T15:00:00Z'), '1月1日')
  assert.equal(formatBookDate('2026-12-31T15:00:00Z', true), '2027年1月1日')
  assert.equal(formatBookDate('2026-10-19', true), '2026年10月19日')
})
test('missing, invalid and impossible date-only values never render NaN', () => {
  for (const value of ['', 'invalid', '2026-02-30', '2026-13-01', '2026-10-19TgarbageZ']) assert.equal(formatBookDate(value), '日付不明')
  assert.equal(formatBookDate('2024-02-29'), '2月29日')
  assert.equal(formatBookDate('invalid', true), '日付不明')
})
