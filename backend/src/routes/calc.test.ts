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
  calcShichuResult,
  getSukuyo,
  KYUSEI_NAMES,
} from './calc.js'
import { buildDeterministicReport, buildTwoStageConsensus, renderReportBlocks } from '../lib/deterministicReport.js'
import { calcZiwei } from '../lib/ziwei.js'
import { calcAstrology } from '../lib/astrology.js'
import { buildStructuredReport } from '../lib/reportCards.js'

test('二段階Consensusは系統内の厳密な過半数だけを1票にまとめる', () => {
  type Theme = 'change' | 'stay'
  const sourceFamily = {
    四柱推命: 'stems', 算命学: 'stems', 紫微斗数: 'stems',
    西洋占星術: 'ephemeris', インド占星術: 'ephemeris',
    数秘術: 'number', 九星気学: 'number', 宿曜: 'lunar',
  } as const
  const familySystems = {
    stems: ['四柱推命', '算命学', '紫微斗数'],
    ephemeris: ['西洋占星術', 'インド占星術'],
    number: ['数秘術', '九星気学'],
    lunar: ['宿曜'],
  }
  const signals = new Map<Theme, Set<string>>([
    ['change', new Set(['四柱推命', '算命学', '西洋占星術', '宿曜'])],
    ['stay', new Set(['紫微斗数', 'インド占星術'])],
  ])
  const results = Array.from({ length: 10 }, () => buildTwoStageConsensus(signals, sourceFamily, familySystems))
  const first = results[0]
  const change = first.items.find(item => item.key === 'change')

  results.slice(1).forEach(result => {
    assert.deepEqual(first, result, '同じSignalで順位と判定が変わっています')
  })
  assert.deepEqual(change?.lineages, ['stems', 'lunar'])
  assert.equal(change?.lineageCount, 2)
  assert.ok(first.splitVerdicts.some(verdict => verdict.family === 'ephemeris' && verdict.theme === null))
  assert.ok(first.items.every(item => item.lineageCount >= 0 && item.lineageCount <= 4))
})

test('納音はConsensusの投票者に含めない', () => {
  const signals = new Map([['theme', new Set(['納音'])]])
  const result = buildTwoStageConsensus(signals, {}, {
    stems: ['四柱推命', '算命学', '紫微斗数'], ephemeris: ['西洋占星術', 'インド占星術'], number: ['数秘術', '九星気学'], lunar: ['宿曜'],
  })
  assert.deepEqual(result.items, [])
  assert.deepEqual(result.verdicts, [])
})

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
  assert.deepEqual(expanded.fourPillars.map(pillar => pillar.twelveStage), ['建禄', '病', '胎', '死'])
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

test('四柱推命専用結果は性別なしで命式を返し、指定時だけ大運を返す', () => {
  const natal = calcShichuResult(1995, 2, 20, 5, 40)
  assert.equal(natal.shichuDay, '壬午')
  assert.equal(natal.timing, null)

  const withTiming = calcShichuResult(1995, 2, 20, 5, 40, 'female')
  assert.ok(withTiming.timing?.decades.length)
  assert.ok(withTiming.timing?.annual.some(item => item.year === 2026))
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

  for (const heading of ['先に読む要約', '共通して現れた本質', 'あなた固有の組み合わせ', '仕事', '恋愛・結婚', '人間関係', '時期 — 重なりの強い年']) {
    assert.match(report, new RegExp(`【${heading}`))
  }
  assert.doesNotMatch(report, /【迷ったときの順序・注記】/)
  assert.doesNotMatch(report, /出生時刻が不明のため、時刻が必要な一部の結果を除いて鑑定しています/)
  assert.doesNotMatch(report, /【補助傾向】/)
  assert.doesNotMatch(report, /【この人固有の恋愛パターン】/)
  assert.doesNotMatch(report, /【インド占星術 — 個別結果】/)
  assert.doesNotMatch(report, /参照できた系統|\d\/4/)
  assert.doesNotMatch(report, /タイプ番号|FL-\d{4}/)
  assert.match(report, /関係が安定する条件：/)
  assert.match(report, /惹かれやすい人：責任感が強く、仕事や社会的役割を背負える、礼儀と誇りのある芯の強いタイプ/)
  assert.match(report, /成長を応援し合える相手を選びます/)
  assert.match(report, /一つのことを深く学び、信頼を守れる人/)
  assert.match(report, /環境そのものを変える決断/)
  assert.match(report, /もっと広げたい気持ち.*失敗しない形へ固めたい気持ち/)
  assert.match(report, /周りの雰囲気や急な予定変更に疲れやすい/)
  assert.match(report, /初対面では.+仕事では/)
  assert.doesNotMatch(report, /命式・計算データとの境界/)
  assert.match(report, /- 仕事：/)
  assert.match(report, /- お金：/)
  assert.match(report, /- 親密な関係：/)
  assert.match(report, /- 友人関係：/)
  assert.match(report, /- 対等な相手には：/)
  assert.doesNotMatch(report, /です。\s*(?:目上|後輩|前者|後者)には/)
  assert.doesNotMatch(report, /力です。\s*(?:好意|惹か|気持ち)/)
  assert.doesNotMatch(report, /しますで評価|タイプ\s+惹か|条件：-/)
  assert.doesNotMatch(report.replace(/\[\[(?:YEAR|TURNING):\d{4}年.+?\]\]/g, ''), /\d{4}年/)
  assert.doesNotMatch(report, /一致\s*\d+系統|TIMING_MORE/)
  assert.match(report, /\[\[DOMAIN:仕事\]\]/)
  assert.match(report, /〈動きが強まりやすい月〉/)
  assert.match(report, /\[\[DOMAIN:(?:交際・新しい恋|別れ・関係の見直し|結婚|転職・働き方の変更|新しい挑戦|引越し・生活環境の変更)\]\]/)
  assert.match(report, /\[\[DOMAIN:(?:恋愛|結婚)\]\]/)
  assert.ok((report.match(/言葉と情報をつなぐ力/g) ?? []).length <= 3)
  assert.ok((report.match(/人と人を調整する力/g) ?? []).length <= 3)
  assert.match(report, /強く出ていることと、味方になることは矛盾しません/)
  assert.doesNotMatch(report, /\[\[(?:EVIDENCE|HIGHLIGHT|YEAR):/)
  const visibleReport = report
  assert.match(visibleReport, /\[\[TURNING:.+?大きな転換期\]\]/)
  const forbidden = /四柱推命|算命学|紫微斗数|西洋占星術|インド占星術|宿曜|九星気学|数秘術|納音|日主|通変星|鳳閣星|貫索星|牽牛星|官禄宮|財帛宮|化忌|ラグナ|ナクシャトラ|運命数|大運|一白水星|二黒土星|三碧木星|四緑木星|五黄土星|六白金星|七赤金星|八白土星|九紫火星|角宿|亢宿|氐宿|房宿|心宿|尾宿|箕宿|斗宿|女宿|虚宿|危宿|室宿|壁宿|奎宿|婁宿|胃宿|昴宿|畢宿|觜宿|参宿|井宿|鬼宿|柳宿|星宿|張宿|翼宿|軫宿|°/
  assert.doesNotMatch(visibleReport, forbidden)
  const loveSection = visibleReport.match(/【恋愛・結婚】([\s\S]*?)【人間関係】/)?.[1] ?? ''
  assert.equal((loveSection.match(/責任感が強く、仕事や社会的役割を背負える、礼儀と誇りのある芯の強いタイプ/g) ?? []).length, 1)
  for (const heading of ['仕事', '恋愛・結婚', '人間関係']) {
    assert.equal((visibleReport.match(new RegExp(`【${heading}】`, 'g')) ?? []).length, 1)
  }
  const proseWithoutTimeline = visibleReport.split('【時期 — 重なりの強い年】')[0]
  const longSentences = proseWithoutTimeline.replaceAll('**', '').split(/[。\n]/).map(item => item.trim()).filter(item => item.length >= 15 && !/^(【|根拠：|一致：)/.test(item))
  const duplicateSentences = longSentences.filter((item, index) => longSentences.indexOf(item) !== index)
  assert.deepEqual(duplicateSentences, [], `15文字以上の同一文が重複しています: ${duplicateSentences.join(' / ')}`)
  const sentences = visibleReport.replaceAll('**', '').split(/[。\n]/).map(item => item.trim()).filter(item => item.length >= 12 && !item.startsWith('【'))
  for (let index = 0; index <= sentences.length - 3; index += 1) {
    const three = sentences.slice(index, index + 3)
    assert.notEqual(new Set(three.map(item => item.slice(0, 10))).size, 1, `3文連続で導入句が同じです: ${three.join(' / ')}`)
    assert.notEqual(new Set(three.map(item => item.slice(-10))).size, 1, `3文連続で文末が同じです: ${three.join(' / ')}`)
  }
})

test('異なる生年月日は固有の場面描写と順序を持ち、同じ入力ではぶれない', () => {
  const makeReport = (year: number, month: number, day: number) => {
    const shichu = calcShichu(year, month, day)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
    return buildDeterministicReport({
      shichuDay: shichu.day.kanshi,
      nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx),
      sanmeiStar: sanmei.shukumeiStar,
      chusatsu: sanmei.chusatsu,
      sukuyo: getSukuyo(year, month, day),
      lifePathNumber: calcLifePathNumber(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`),
      numerologyProfile: calcNumerologyProfile(year, month, day, 2026),
      honmeiName: KYUSEI_NAMES[calcHonmeiStar(year, month, day)],
      kyuseiProfile: calcKyuseiProfile(year, month, day),
      timing: calcTimingCycles(year, month, day, undefined, 0, 'female'),
      sanmeiRelations: calcSanmeiRelations(shichu, sanmei.chusatsu),
      ...calcExpandedDivination(shichu),
    })
  }
  const report1995 = makeReport(1995, 2, 20)
  const report1997 = makeReport(1997, 7, 30)
  assert.equal(makeReport(1995, 2, 20), report1995, '同じ入力の文章がぶれています')
  assert.notEqual(report1995, report1997)
  assert.match(report1995, /大きな流れを読む戦略家/)
  assert.match(report1997, /感受性で本質を潤す探究者/)
  const scene1995 = report1995.match(/(?:会議では|仕事を始める入口は|周囲からは).+?。/)?.[0]
  const scene1997 = report1997.match(/(?:会議では|仕事を始める入口は|周囲からは).+?。/)?.[0]
  assert.ok(scene1995 && scene1997)
  assert.notEqual(scene1995, scene1997, '異なる生年月日の仕事場面が同文です')
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
  assert.equal(astrology.western?.midheaven.sign, '射手座')
  assert.ok(Math.abs((astrology.western?.midheaven.degree ?? 0) - 1.22) < 0.1)
  const aichiAstrology = calcAstrology(1995, 2, 20, 5, 40, '愛知県')
  assert.equal(aichiAstrology.western?.midheaven.sign, '蠍座')
  assert.ok(Math.abs((aichiAstrology.western?.midheaven.degree ?? 0) - 28.47) < 0.1)
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
  const year2023 = timing.annual.find(item => item.year === 2023)
  assert.ok(year2023?.relationshipSignals.some(signal => signal.includes('日支と破')))
  assert.ok(year2023?.themes.some(theme => theme.includes('隠れていたずれ')))
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
  assert.equal(ziwei.annual.length, 43)
  assert.equal(ziwei.annual[0].year, 2013)
  assert.ok(ziwei.annual.every(item => item.activePalaces.length <= 1))
  assert.equal(ziwei.annual.find(item => item.year === 2019)?.activePalaces[0], '命宮')
  assert.equal(ziwei.annual.find(item => item.year === 2023)?.activePalaces[0], '官禄')
  assert.ok(new Set(ziwei.annual.flatMap(item => item.activePalaces)).size > 1)
})

test('恋愛年運は吉凶ではなく関係の出来事類型を組み合わせで判定する', () => {
  const timing = calcTimingCycles(1995, 2, 20, 5, 40, 'female')
  const march2018 = timing.annual.find(item => item.year === 2018)?.monthly.find(item => item.month === 3)
  assert.ok(march2018?.relationshipEvents.some(event => event.includes('隠れていたずれ')))
  assert.ok(march2018?.relationshipEvents.some(event => event.includes('出会いや接触')))
  const year2020 = timing.annual.find(item => item.year === 2020)
  assert.ok(year2020?.relationshipEvents.some(event => event.includes('関係や生活環境を組み替え')))
  const year2023 = timing.annual.find(item => item.year === 2023)
  assert.ok(year2023?.relationshipEvents.some(event => event.includes('隠れていたずれ')))
})

test('1995-06-30 女性の関係転換から結婚までの流れを出生時刻なしでも再現する', () => {
  const timing = calcTimingCycles(1995, 6, 30, undefined, 0, 'female')
  const decade = timing.decades.find(item => item.startYear <= 2024 && item.endYear >= 2026)
  assert.ok(decade?.themes.includes('縁がまとまりやすい'))

  const year2024 = timing.annual.find(item => item.year === 2024)
  assert.ok(year2024?.relationshipSignals.some(signal => signal.includes('配偶者星')))
  const april2024 = year2024?.monthly.find(item => item.month === 4)
  assert.equal(april2024?.relationshipSignals.filter(signal => signal.includes('配偶者星')).length, 2)

  const february2025 = timing.annual.find(item => item.year === 2025)?.monthly.find(item => item.month === 2)
  assert.ok(february2025?.relationshipEvents.some(event => event.includes('関係の定義や将来')))
  const january2026 = timing.annual.find(item => item.year === 2025)?.monthly.find(item => item.month === 1)
  assert.equal(january2026?.monthLabel, '翌年1月ごろ')
  assert.ok(january2026?.relationshipSignals.some(signal => signal.includes('配偶者星')))
})

test('西洋・インド占星術の年運はトランジットとダシャーを同じ年へ統合する', () => {
  const astrology = calcAstrology(1995, 2, 20, 5, 40, '愛知県')
  assert.equal(astrology.annual?.length, 43)
  assert.equal(astrology.annual?.[0].year, 2013)
  assert.ok(astrology.annual?.every(item => item.dashaLord && Array.isArray(item.signals)))
  assert.ok(astrology.annual?.some(item => item.western.length > 0))
  assert.ok(astrology.annual?.some(item => item.vedic.length > 0))
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

function makeFullReport(year: number, month: number, day: number, hour?: number, minute = 0) {
  const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const birthTime = hour === undefined ? '' : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const shichu = calcShichu(year, month, day, hour, minute)
  const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
  return buildDeterministicReport({
    birthDate, birthTime, birthplace: '愛知県', gender: 'female',
    shichuDay: shichu.day.kanshi,
    nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx),
    sanmeiStar: sanmei.shukumeiStar,
    chusatsu: sanmei.chusatsu,
    sukuyo: getSukuyo(year, month, day),
    lifePathNumber: calcLifePathNumber(birthDate),
    numerologyProfile: calcNumerologyProfile(year, month, day, 2026),
    honmeiName: KYUSEI_NAMES[calcHonmeiStar(year, month, day)],
    kyuseiProfile: calcKyuseiProfile(year, month, day, hour, minute),
    timing: calcTimingCycles(year, month, day, hour, minute, 'female'),
    sanmeiRelations: calcSanmeiRelations(shichu, sanmei.chusatsu),
    ziwei: calcZiwei(year, month, day, hour, 'female', '愛知県'),
    astrology: calcAstrology(year, month, day, hour, minute, '愛知県'),
    ...calcExpandedDivination(shichu),
  })
}

test('生年月日が異なる鑑定ではサーバー生成のカードタイトルも異なる', () => {
  const first = buildStructuredReport(makeFullReport(1995, 2, 20, 5, 40)).cards.map(card => card.title)
  const second = buildStructuredReport(makeFullReport(1990, 6, 12)).cards.map(card => card.title)
  assert.notDeepEqual(first, second)
})

test('指定入力と五行0・出生時刻なしでも統合鑑定が最後まで生成される', () => {
  const target = makeFullReport(1995, 3, 16, 10, 30)
  assert.doesNotMatch(target, /【迷ったときの順序・注記】/)
  assert.match(target, /天体の長期的な動き|長期の人生周期/)
  assert.ok(target.length > 3000)
  for (const [year, month, day] of [[1988, 1, 1], [1988, 1, 2], [1988, 1, 4]]) {
    const shichu = calcShichu(year, month, day, 12, 0)
    const scores = calcExpandedDivination(shichu).elementBalance.scores
    assert.ok(Object.values(scores).some(score => score === 0))
    assert.match(makeFullReport(year, month, day, 12, 0), /【仕事】/)
  }
  assert.doesNotMatch(makeFullReport(1990, 6, 12), /出生時刻が不明のため、時刻が必要な一部の結果/)
  assert.doesNotMatch(makeFullReport(2000, 11, 3), /出生時刻が不明のため、時刻が必要な一部の結果/)
})

test('一つの鑑定ブロックが失敗しても他ブロックを返す', () => {
  const report = renderReportBlocks([
    { id: 'first', render: () => '最初のブロック' },
    { id: 'broken', render: () => { throw new Error('test failure') } },
    { id: 'last', render: () => '最後のブロック' },
  ], 'test')
  assert.equal(report, '最初のブロック\n\n最後のブロック')
})
