import { annual3600Cards } from './annual3600/cards.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoupleTimingHistory, findCoupleTurningPoints } from './coupleTimingCards.js'
import { selfTimingHistoryFromBirthSnapshot, timingHistoryFromBirthSnapshot } from './coupleTimingHistory.js'

const annual = Array.from({ length: 25 }, (_, i) => ({ year: 2005 + i, score: i % 8, themes: ['仕事'], relationshipEvents: i === 7 ? ['出会い・交際開始'] : [] }))
test('本人の全年度表示は保存出生入力の18歳以降を返し、欠損情報を補完しない', () => {
  const snapshot = { birthDate: '1990-08-14', birthTime: '', gender: 'female' }
  const result = selfTimingHistoryFromBirthSnapshot(snapshot, 2026)
  assert.equal(result.cards[0].id, 'turning-year-2008')
  assert.equal(result.cards.at(-1)?.id, 'turning-year-2026')
  assert.equal(result.cards.length, 19)
  assert.ok(result.cards.every(card => card.scope === 'self'))
  for (const input of [null, {}, { ...snapshot, gender: null }, { ...snapshot, birthTime: '24:00' }, { ...snapshot, birthDate: '1990-02-30' }]) {
    assert.throws(() => selfTimingHistoryFromBirthSnapshot(input), /BIRTH_UNAVAILABLE/)
  }
})
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

// Regression: the saved gender must reach the shared annual input policy.
test('通常入力の男女で過去年と通常生成の2013〜2032年カード全体が一致する', () => {
  const previous=process.env.ANNUAL_READING_ENGINE
  process.env.ANNUAL_READING_ENGINE='catalog3600'
  try {
    for(const gender of ['female','male']) {
      const input={birthDate:'1995-02-20',birthTime:'03:02',birthplace:'愛知県',gender}
      const normal=annual3600Cards(input,2013,2032)
      const history=selfTimingHistoryFromBirthSnapshot(input,2032)
      assert.equal(history.cards.length,20)
      assert.deepEqual(history.cards,normal)
      const aliases={birth_date:input.birthDate,birth_time:input.birthTime,birthplace:input.birthplace,gender}
      assert.deepEqual(selfTimingHistoryFromBirthSnapshot(aliases,2032).cards,normal)
      assert.ok(history.cards.every(c=>!c.tags.includes('#仕事の転機')))
      if(gender==='female')assert.deepEqual(history.cards.find(c=>c.id==='turning-year-2018')!.tags,['時期','#婚期','#活動の転機'])
      const explicit={...input,spouseConvention:'male_wealth',annualYunConvention:'male',workContext:'employed'}
      assert.deepEqual(selfTimingHistoryFromBirthSnapshot(explicit,2032).cards,annual3600Cards(explicit,2013,2032))
    }
  } finally {
    if(previous===undefined)delete process.env.ANNUAL_READING_ENGINE
    else process.env.ANNUAL_READING_ENGINE=previous
  }
})
