import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoupleTimingHistory, findCoupleTurningPoints } from './coupleTimingCards.js'
import { timingHistoryFromBirthSnapshot } from './coupleTimingHistory.js'

const annual = Array.from({ length: 25 }, (_, i) => ({ year: 2005 + i, score: i % 8, themes: ['仕事'], relationshipEvents: i === 7 ? ['出会い・交際開始'] : [] }))
test('別フィールドの出会いの根拠を起点に使い、2023年より前にも遡れる', () => {
  const before = JSON.stringify(annual)
  const canonical = findCoupleTurningPoints(annual, annual, 1995, 1992, 2026)
  const history = buildCoupleTimingHistory(annual, annual, 1995, 1992, 2026)
  assert.equal(history.initialYear, 2012)
  assert.equal(history.hasMeetingSignal, true)
  assert.ok(history.cards.some(card => card.id === 'couple-timing-2005'))
  assert.ok(history.cards.every(card => Number(card.id.slice(-4)) <= 2026))
  assert.equal(JSON.stringify(annual), before)
  assert.deepEqual(findCoupleTurningPoints(annual, annual, 1995, 1992, 2026), canonical)
})
test('両者のデータが重なる年だけを表示し、兆しなしは今年が起点', () => {
  const noEvents = annual.map(item => ({ ...item, relationshipEvents: [] }))
  const history = buildCoupleTimingHistory(noEvents, noEvents.filter(item => item.year >= 2020), 1995, 1992, 2026)
  assert.equal(history.initialYear, 2026)
  assert.equal(history.hasMeetingSignal, false)
  assert.equal(history.cards.length, 7)
})
test('保存された出生情報だけで既存計算を再利用し、無効・欠損情報を補完しない', () => {
  const snapshot = { self: { birthDate: '1995-02-20', birthTime: '', gender: 'female' }, partner: { birthDate: '1992-09-23', birthTime: '12:30', gender: 'male' } }
  const first = timingHistoryFromBirthSnapshot(snapshot, 2026)
  assert.ok(first.cards.length > 10)
  assert.deepEqual(first, timingHistoryFromBirthSnapshot(snapshot, 2026))
  for (const input of [null, {}, { self: snapshot.self }, { ...snapshot, self: { ...snapshot.self, birthDate: '1995-02-30' } }, { ...snapshot, self: { ...snapshot.self, gender: null } }]) {
    assert.throws(() => timingHistoryFromBirthSnapshot(input, 2026), /BIRTH_UNAVAILABLE/)
  }
})
