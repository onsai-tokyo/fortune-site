import assert from 'node:assert/strict'
import test from 'node:test'
import { calcLifePathNumber, calcShichu, calcShichuResult } from '../../../backend/src/lib/divination/index.ts'
import { birthTimeExample } from '../../reader-evidence-copy.js'

test('published birth-time comparison matches the public calculator and omits the unknown hour', () => {
  const [year, month, day] = birthTimeExample.date.split('-').map(Number)
  for (const [known, expected] of [[true, birthTimeExample.withTime], [false, birthTimeExample.withoutTime]] as const) {
    const result = calcShichuResult(year, month, day, known ? 5 : undefined, known ? 40 : 0)
    assert.deepEqual(result.fourPillars.map(p => p.kanshi), expected.pillars)
    assert.deepEqual(['木', '火', '土', '金', '水'].map(name => result.elementBalance.scores[name]), expected.scores)
    assert.equal(result.shichuHour, known ? '癸卯' : null)
  }
})

test('published boundary example keeps the day and changes the solar-term year and month', () => {
  const before = calcShichu(2024, 2, 4, 17, 0)
  const after = calcShichu(2024, 2, 4, 18, 0)
  assert.deepEqual([before.year.kanshi, before.month.kanshi, before.day.kanshi], ['癸卯', '乙丑', '戊戌'])
  assert.deepEqual([after.year.kanshi, after.month.kanshi, after.day.kanshi], ['甲辰', '丙寅', '戊戌'])
})

test('published numerology examples include repeated reduction and a preserved master number', () => {
  assert.equal(calcLifePathNumber('1995-02-20'), 1)
  assert.equal(calcLifePathNumber('2000-01-08'), 11)
})
