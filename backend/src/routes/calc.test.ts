import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calcHonmeiStar,
  calcLifePathNumber,
  calcNayin,
  calcSanmei,
  calcExpandedDivination,
  calcSanmeiRelations,
  calcTimingCycles,
  calcNumerologyProfile,
  calcKyuseiProfile,
  calcTenGod,
  calcShichu,
  getSukuyo,
} from './calc.js'
import { buildDeterministicReport } from '../lib/deterministicReport.js'
import { calcZiwei } from '../lib/ziwei.js'
import { calcAstrology } from '../lib/astrology.js'

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

test('詳細鑑定に恋愛・結婚・仕事と過去・未来の傾向を含める', () => {
  const shichu = calcShichu(1995, 2, 20, 5, 40)
  const expanded = calcExpandedDivination(shichu)
  const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
  const ziwei = calcZiwei(1995, 2, 20, 5, 'female', '東京都')
  const astrology = calcAstrology(1995, 2, 20, 5, 40, '東京都')
  const report = buildDeterministicReport({
    age: 31,
    shichuDay: shichu.day.kanshi,
    nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx),
    sanmeiStar: sanmei.shukumeiStar,
    chusatsu: sanmei.chusatsu,
    sukuyo: getSukuyo(1995, 2, 20),
    lifePathNumber: calcLifePathNumber('1995-02-20'),
    numerologyProfile: calcNumerologyProfile(1995, 2, 20, 2026),
    honmeiName: '五黄土星',
    kyuseiProfile: calcKyuseiProfile(1995, 2, 20, 5, 40),
    timing: calcTimingCycles(1995, 2, 20, 5, 40, 'female'),
    sanmeiRelations: calcSanmeiRelations(shichu, sanmei.chusatsu),
    ziwei,
    astrology,
    ...expanded,
  })

  for (const heading of ['全占術統合鑑定 — 総合結論', '全占術統合鑑定 — 思考', '全占術統合鑑定 — 才能', '全占術統合鑑定 — 恋愛', '全占術統合鑑定 — 家族', '全占術統合鑑定 — 心身', '全占術統合鑑定 — 過去', '全占術統合鑑定 — 開運', '鑑定根拠 — 四柱推命', '鑑定根拠 — 算命学', '鑑定根拠 — 紫微斗数', '鑑定根拠 — 西洋占星術', '鑑定根拠 — インド占星術', '大運', '婚期の候補', '年運', '宿曜詳細', '九星気学詳細', '数秘術詳細', '納音詳細']) {
    assert.match(report, new RegExp(`【${heading}`))
  }
  assert.match(report, /算命学の西方司禄星/)
  assert.match(report, /31歳現在（人生段階は30年ごとの目安）/)
  assert.match(report, /現在.+天胡星は「感覚が鋭く/)
  assert.match(report, /起運日は1999-11-12、運行は順行/)
  assert.match(report, /2027年（31〜32歳）丁未/)
  assert.match(report, /命主は\*\*巨門\*\*、身主は\*\*天機\*\*/)
  assert.match(report, /\*\*夫妻（乙酉）：\*\* 天機/)
  assert.match(report, /本命宿は\*\*心宿\*\*/)
  assert.match(report, /月命星は\*\*二黒土星\*\*/)
  assert.match(report, /2026年の個人年は\*\*5（変化と自由）\*\*/)
  assert.match(report, /納音は\*\*楊柳木\*\*/)
  assert.match(report, /官祿宮主星なし（対宮・三方四正を参照）・財帛宮太陽・太陰（化忌）/)
  assert.match(report, /夫妻宮は天機（化祿）・巨門/)
  assert.match(report, /現在は大運辛巳・正印/)
  assert.match(report, /\*\*最初に行うこと：判断・品質/)
  assert.match(report, /疾厄宮は武曲・天府/)
  assert.match(report, /父母宮七殺、田宅宮廉貞/)
  assert.match(report, /夫妻宮天機（化祿）・巨門/)
  assert.match(report, /西洋占星術では太陽魚座・月天秤座/)
  assert.match(report, /ナクシャトラは\*\*/)
})

test('西洋・インド占星術の天体位置を同じ出生条件から固定計算する', () => {
  const astrology = calcAstrology(1995, 2, 20, 5, 40, '東京都')
  assert.equal(astrology.available, true)
  assert.equal(astrology.western?.planets.find(planet => planet.name === '太陽')?.sign, '魚座')
  assert.equal(astrology.vedic?.planets.find(planet => planet.name === '太陽')?.sign, '水瓶座')
  assert.ok(astrology.vedic?.moonNakshatra)
})

test('1995-02-20 05:40 女性の大運・流年を固定値で再現する', () => {
  const timing = calcTimingCycles(1995, 2, 20, 5, 40, 'female')
  assert.equal(timing.direction, '順行')
  assert.equal(timing.startDate, '1999-11-12')
  assert.deepEqual(timing.decades.slice(0, 3).map(item => [item.kanshi, item.startYear, item.endYear]), [
    ['己卯', 1999, 2008], ['庚辰', 2009, 2018], ['辛巳', 2019, 2028],
  ])
  const year2027 = timing.annual.find(item => item.year === 2027)
  assert.equal(year2027?.kanshi, '丁未')
  assert.deepEqual(year2027?.relationshipSignals, ['地支に配偶者星の正官', '日支と六合（縁がまとまりやすい）'])
  assert.ok(timing.marriageCandidates.some(item => item.year === 2027))
})

test('1995-02-20 05:40 女性の紫微斗数十二宮を固定値で再現する', () => {
  const ziwei = calcZiwei(1995, 2, 20, 5, 'female', '東京都')
  assert.equal(ziwei.available, true)
  if (!ziwei.available) return
  assert.equal(ziwei.lunarDate, '一九九五年正月廿一')
  assert.equal(ziwei.time, '卯時')
  assert.equal(ziwei.fiveElementsClass, '土の五局')
  assert.equal(ziwei.soul, '巨門')
  assert.equal(ziwei.body, '天機')
  assert.equal(ziwei.palaces.length, 12)
  assert.deepEqual(ziwei.palaces.find(palace => palace.name === '命宮')?.majorStars.map(star => [star.name, star.brightness, star.mutagen]), [['天梁', '陷', '權']])
  assert.deepEqual(ziwei.palaces.find(palace => palace.name === '夫妻')?.majorStars.map(star => [star.name, star.mutagen]), [['天機', '祿'], ['巨門', '']])
})

test('算命学の位相法と天中殺の作用点を算出する', () => {
  const shichu = calcShichu(1995, 2, 20, 5, 40)
  const details = calcSanmeiRelations(shichu, '申酉天中殺')
  assert.deepEqual(details.voidBranches, ['申', '酉'])
  assert.deepEqual(details.affectedPillars, [])
  assert.deepEqual(details.relations, [{ pillars: '年支・月支', branches: '亥寅', relation: '六合', meaning: '異なる領域が結びつき、協力や縁としてまとまりやすい' }])
})

test('数秘術の複数指標と九星の年月日時盤を固定値で再現する', () => {
  assert.deepEqual(calcNumerologyProfile(1995, 2, 20, 2026), {
    birthDayNumber: 2, attitudeNumber: 22, personalYearNumber: 5, personalYear: 2026,
  })
  assert.deepEqual(calcKyuseiProfile(1995, 2, 20, 5, 40), {
    yearStar: '五黄土星', monthStar: '二黒土星', dayStar: '七赤金星', timeStar: '四緑木星',
  })
})
