import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calcHonmeiStar,
  calcLifePathNumber,
  calcNayin,
  calcSanmei,
  calcExpandedDivination,
  calcTenGod,
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

test('通変星は日主との五行生剋と陰陽から一意に決まる', () => {
  assert.deepEqual([8, 9, 0, 1, 2, 3].map(target => calcTenGod(8, target)),
    ['比肩', '劫財', '食神', '傷官', '偏財', '正財'])
})

test('1995-02-20 05:40 の詳細命式を固定値で再現する', () => {
  const expanded = calcExpandedDivination(calcShichu(1995, 2, 20, 5, 40))
  assert.deepEqual(expanded.fourPillars.map(pillar => pillar.kanshi), ['乙亥', '戊寅', '壬午', '癸卯'])
  assert.deepEqual(expanded.fourPillars.map(pillar => pillar.stemTenGod), ['傷官', '偏官', '日主', '劫財'])
  assert.deepEqual(expanded.sanmeiChart.bodyChart, {
    north: { label: '北（頭）', star: '調舒星' },
    west: { label: '西（右手）', star: '司禄星' },
    center: { label: '中央（胸）', star: '鳳閣星' },
    east: { label: '東（左手）', star: '貫索星' },
    south: { label: '南（腹）', star: '車騎星' },
  })
  assert.deepEqual(expanded.sanmeiChart.subordinateStars, {
    early: { label: '初年期', star: '天禄星', stage: '建禄' },
    middle: { label: '中年期', star: '天胡星', stage: '病' },
    late: { label: '晩年期', star: '天報星', stage: '胎' },
  })
})
