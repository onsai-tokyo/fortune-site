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
    calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays),
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
    west: { label: '西（右手）', star: '牽牛星' },
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

test('複数占術で一致した内容だけを鑑定書に表示する', () => {
  const shichu = calcShichu(1995, 2, 20, 5, 40)
  const expanded = calcExpandedDivination(shichu)
  const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
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

  for (const heading of ['先に読む要約', '共通して現れた本質', 'あなた固有の組み合わせ', '仕事', '恋愛・結婚', '人間関係', '時期 — 重なりの強い年', '迷ったときの順序・注記', '命式・計算データとの境界']) {
    assert.match(report, new RegExp(`【${heading}`))
  }
  assert.doesNotMatch(report, /【補助傾向】/)
  assert.doesNotMatch(report, /【この人固有の恋愛パターン】/)
  assert.doesNotMatch(report, /【インド占星術 — 個別結果】/)
  assert.match(report, /向いているのは、目的・担当範囲・完了条件がはっきりした役割/)
  assert.match(report, /関係が安定する条件：/)
  assert.match(report, /年は2系統で同じ方向が出ています/)
  assert.ok((report.match(/言葉と情報をつなぐ力/g) ?? []).length <= 3)
  assert.ok((report.match(/人と人を調整する力/g) ?? []).length <= 3)
  assert.match(report, /強いことと、味方になることは矛盾しません/)
  const evidenceMarkers = [...report.matchAll(/\[\[EVIDENCE:(.+?)\]\]/g)].map(match => match[1])
  assert.ok(evidenceMarkers.length >= 7)
  for (const evidence of evidenceMarkers) {
    const lineages = new Set(evidence.split('||').map(item => item.split('｜')[0]))
    assert.ok(lineages.size >= 2, `根拠が2系統未満です: ${evidence}`)
  }
  const visibleReport = report.replace(/\[\[EVIDENCE:.+?\]\]/g, '')
  const forbidden = /四柱推命|算命学|紫微斗数|西洋占星術|インド占星術|宿曜|九星気学|数秘術|納音|日主|通変星|鳳閣星|貫索星|牽牛星|官禄宮|財帛宮|化忌|ラグナ|ナクシャトラ|運命数|大運|°/
  assert.doesNotMatch(visibleReport, forbidden)
  for (const heading of ['仕事', '恋愛・結婚', '人間関係']) {
    assert.equal((visibleReport.match(new RegExp(`【${heading}】`, 'g')) ?? []).length, 1)
  }
  const longSentences = visibleReport.replaceAll('**', '').split(/[。\n]/).map(item => item.trim()).filter(item => item.length >= 15 && !/^(【|根拠：|一致：)/.test(item))
  const duplicateSentences = longSentences.filter((item, index) => longSentences.indexOf(item) !== index)
  assert.deepEqual(duplicateSentences, [], `15文字以上の同一文が重複しています: ${duplicateSentences.join(' / ')}`)
  const sentences = visibleReport.replaceAll('**', '').split(/[。\n]/).map(item => item.trim()).filter(item => item.length >= 12 && !item.startsWith('【'))
  for (let index = 0; index <= sentences.length - 3; index += 1) {
    const three = sentences.slice(index, index + 3)
    assert.notEqual(new Set(three.map(item => item.slice(0, 10))).size, 1, `3文連続で導入句が同じです: ${three.join(' / ')}`)
    assert.notEqual(new Set(three.map(item => item.slice(-10))).size, 1, `3文連続で文末が同じです: ${three.join(' / ')}`)
  }
})

test('算命学の人体星図は節入り後の日数に応じて二十八元を切り替える', () => {
  const february = calcExpandedDivination(calcShichu(1995, 2, 20, 5, 40))
  assert.equal(february.sanmeiChart.bodyChart.west.star, '牽牛星')
  assert.deepEqual(Object.fromEntries(Object.entries(february.sanmeiChart.bodyChart).map(([key, value]) => [key, value.star])), {
    north: '調舒星', west: '牽牛星', center: '鳳閣星', east: '貫索星', south: '車騎星',
  })

  const march = calcExpandedDivination(calcShichu(1995, 3, 16))
  assert.deepEqual(Object.fromEntries(Object.entries(march.sanmeiChart.bodyChart).map(([key, value]) => [key, value.star])), {
    north: '玉堂星', west: '調舒星', center: '玉堂星', east: '龍高星', south: '調舒星',
  })
  assert.deepEqual(Object.values(march.sanmeiChart.subordinateStars).map(value => value.star), ['天馳星', '天恍星', '天将星'])
})

test('傷官と劫財を官星・財星として誤分類しない', () => {
  const timing = calcTimingCycles(1995, 2, 20, 5, 40, 'female')
  assert.deepEqual(timing.annual.find(item => item.year === 2025)?.themes, ['発信・創作・新しい挑戦'])
  assert.deepEqual(timing.annual.find(item => item.year === 2013)?.themes, ['自立・仲間・活動範囲の変化'])
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
