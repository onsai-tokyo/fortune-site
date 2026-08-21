import assert from 'node:assert/strict'
import test from 'node:test'
import { buildChartCards } from './chartCards.js'

const calculated = {
  shichuYear: '乙亥', shichuMonth: '戊寅', shichuDay: '壬午', shichuHour: '癸卯',
  elementBalance: { scores: { 木: 5, 火: 0, 土: 2, 金: 1, 水: 0 }, method: '天干と蔵干で集計' },
  nayin: '楊柳木', sanmeiStar: '天堂星', chusatsu: '申酉天中殺', sukuyo: '翼', lifePathNumber: 1, honmeiName: '五黄土星',
  _structuredReport: { cards: [{ title: '非表示' }] },
}

test('四柱・五行・複数占術をchartカードとして返す', () => {
  const cards = buildChartCards(calculated)
  assert.equal(cards.length, 3)
  assert.ok(cards.every(card => card.kind === 'chart' && card.tab === 'chart' && card.tags.length > 0))
  assert.deepEqual(cards[0].pages.map(page => page.label), ['年柱', '月柱', '日柱', '時柱'])
})

test('五行が0の要素を明示し、内部保存データを表示しない', () => {
  const cards = buildChartCards(calculated)
  const elements = cards.find(card => card.id === 'chart-elements')
  assert.match(elements?.summary ?? '', /火・水が0/)
  assert.ok(elements?.pages.some(page => page.text.includes('0の要素')))
  assert.doesNotMatch(JSON.stringify(cards), /_structuredReport|非表示/)
})

test('計算データが空なら波括弧用の空カードを作らない', () => {
  assert.deepEqual(buildChartCards({}), [])
})
