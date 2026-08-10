import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calcHonmeiStar,
  calcLifePathNumber,
  calcNayin,
  calcSanmei,
  calcShichu,
  getSukuyo,
} from './calc.js'

test('立春の直前までは前年・前月の干支を使う', () => {
  const result = calcShichu(2024, 2, 4, 17, 27)
  assert.equal(result.year.kanshi, '癸卯')
  assert.equal(result.month.kanshi, '乙丑')
})

test('立春を過ぎると年柱と月柱が切り替わる', () => {
  const result = calcShichu(2024, 2, 4, 17, 28)
  assert.equal(result.year.kanshi, '甲辰')
  assert.equal(result.month.kanshi, '丙寅')
})

test('出生時刻がある場合だけ時柱を返す', () => {
  assert.equal(calcShichu(2024, 2, 4, 17, 25).hour?.kanshi, '辛酉')
  assert.equal(calcShichu(2024, 2, 4).hour, null)
})

test('代表日の納音・算命学・宿曜を再現する', () => {
  const shichu = calcShichu(2024, 2, 4, 17, 25)
  assert.equal(calcNayin(shichu.day.stemIdx, shichu.day.branchIdx), '平地木')
  assert.deepEqual(
    calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx),
    { shukumeiStar: '石門星', chusatsu: '辰巳天中殺' },
  )
  assert.equal(getSukuyo(2024, 2, 4), '箕')
})

test('数秘術は11・22・33をマスターナンバーとして保持する', () => {
  assert.equal(calcLifePathNumber('2000-01-08'), 11)
  assert.equal(calcLifePathNumber('2000-09-29'), 22)
  assert.equal(calcLifePathNumber('1990-09-05'), 33)
})

test('九星気学の本命星は2月4日に年を切り替える', () => {
  assert.equal(calcHonmeiStar(2024, 2, 3), 4)
  assert.equal(calcHonmeiStar(2024, 2, 4), 3)
})
