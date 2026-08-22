import assert from 'node:assert/strict'
import test from 'node:test'
import { buildChartSections, buildCoupleChartSections, normalizePalaceName } from './chartSections.js'
import { calcZiwei } from '../ziwei.js'

const calculated = {
  shichuYear: '乙亥', shichuMonth: '戊寅', shichuDay: '壬午', shichuHour: null,
  fourPillars: [
    { label: '年柱', kanshi: '乙亥', stemTenGod: '傷官', hiddenStems: [{ stem: '壬', tenGod: '比肩' }] },
    { label: '月柱', kanshi: '戊寅', stemTenGod: '偏官', hiddenStems: [{ stem: '甲', tenGod: '食神' }] },
    { label: '日柱', kanshi: '壬午', stemTenGod: '日主', hiddenStems: [{ stem: '丁', tenGod: '正財' }] },
    { label: '時柱', kanshi: '—（出生時刻が必要）', stemTenGod: '—', hiddenStems: [] },
  ],
  elementBalance: { scores: { 木: 5, 火: 0, 土: 2, 金: 1, 水: 0 }, method: '天干と蔵干で集計' },
  sanmeiChart: { bodyChart: { center: { label: '中央（胸）', star: '天堂星' } } },
  kyuseiProfile: { yearStar: '五黄土星', monthStar: '八白土星', dayStar: '一白水星', timeStar: null },
  numerologyProfile: { birthDayNumber: 2, attitudeNumber: 4, personalYearNumber: 7, personalYear: 2026 },
  ziwei: { available: false, reason: '出生時刻が必要です。' },
  nayin: '楊柳木', sanmeiStar: '天堂星', chusatsu: '申酉天中殺', sukuyo: '翼', lifePathNumber: 1, honmeiName: '五黄土星',
  _structuredReport: { cards: [{ title: '非表示' }] },
}

test('命式詳細を5種類以上の構造化データとして返す', () => {
  const sections = buildChartSections(calculated)
  assert.equal(sections.length, 7)
  assert.deepEqual(sections.map(section => section.layout), ['table', 'bars', 'grid', 'table', 'list', 'grid', 'list'])
  assert.ok(sections.every(section => section.id && section.system && section.title))
  assert.doesNotMatch(JSON.stringify(sections), /_structuredReport|非表示/)
})

test('五行0と出生時刻が必要な項目を空欄にしない', () => {
  const sections = buildChartSections(calculated)
  const elements = sections.find(section => section.id === 'chart-elements')!
  assert.deepEqual(elements.bars?.filter(item => item.isZero).map(item => item.label), ['火', '水'])
  const pillars = sections.find(section => section.id === 'chart-four-pillars')!
  assert.match(pillars.table?.rows.at(-1)?.join('') ?? '', /出生時刻が必要/)
  const ziwei = sections.find(section => section.id === 'chart-ziwei')!
  assert.ok(ziwei.grid?.every(item => item.value.includes('出生時刻が必要')))
})

test('計算データが空なら命式セクションを作らない', () => {
  assert.deepEqual(buildChartSections({}), [])
})

test('紫微斗数の宮名は旧字体と宮接尾辞のゆれを同一視する', () => {
  assert.equal(normalizePalaceName('官祿'), normalizePalaceName('官禄宮'))
  assert.equal(normalizePalaceName('福德'), normalizePalaceName('福徳宮'))
  assert.equal(normalizePalaceName('命宮'), normalizePalaceName('命宮'))
})

test('出生時刻ありの紫微斗数は6宮すべてに値を表示する', () => {
  const sections = buildChartSections({
    ...calculated,
    ziwei: {
      available: true,
      earthlyBranchOfSoulPalace: '子',
      earthlyBranchOfBodyPalace: '辰',
      palaces: [
        { name: '命宮', majorStars: [{ name: '破軍' }] },
        { name: '官祿', majorStars: [{ name: '武曲' }] },
        { name: '財帛', majorStars: [] },
        { name: '夫妻', majorStars: [{ name: '天相' }] },
        { name: '遷移', majorStars: [{ name: '太陽' }] },
        { name: '福德', majorStars: [{ name: '天府' }] },
      ],
    },
  })
  const ziwei = sections.find(section => section.id === 'chart-ziwei')!
  assert.equal(ziwei.grid?.length, 6)
  assert.deepEqual(ziwei.grid?.map(item => item.value), ['破軍', '武曲', '主星なし', '天相', '太陽', '天府'])
  assert.doesNotMatch(JSON.stringify(ziwei), /出生時刻が必要/)
})

test('紫微斗数の宮データ不足を出生時刻不足と誤表示しない', () => {
  const sections = buildChartSections({ ...calculated, ziwei: { available: true, palaces: [] } })
  const ziwei = sections.find(section => section.id === 'chart-ziwei')!
  assert.ok(ziwei.grid?.every(item => item.value === '—'))
  assert.doesNotMatch(JSON.stringify(ziwei), /出生時刻が必要/)
})

test('1995-02-20 03:02 女性の実際の宮名で6宮すべてを表示する', () => {
  const sections = buildChartSections({ ...calculated, ziwei: calcZiwei(1995, 2, 20, 3, 'female', '愛知県') })
  const ziwei = sections.find(section => section.id === 'chart-ziwei')!
  assert.equal(ziwei.grid?.length, 6)
  assert.ok(ziwei.grid?.every(item => item.value !== '—' && !item.value.includes('出生時刻が必要')))
})

test('二人の命式は同じ7種をowner付きで並べ、IDを衝突させない', () => {
  const sections = buildCoupleChartSections(calculated, { ...calculated, shichuDay: '乙亥', lifePathNumber: 7 })
  assert.equal(sections.length, 14)
  assert.equal(sections.filter(section => section.owner === 'self').length, 7)
  assert.equal(sections.filter(section => section.owner === 'partner').length, 7)
  assert.equal(new Set(sections.map(section => section.id)).size, 14)
  assert.ok(sections.filter(section => section.owner === 'self').every(section => section.id.startsWith('self-')))
  assert.ok(sections.filter(section => section.owner === 'partner').every(section => section.id.startsWith('partner-')))
  assert.deepEqual(
    sections.filter(section => section.owner === 'self').map(section => section.title),
    sections.filter(section => section.owner === 'partner').map(section => section.title),
  )
})
