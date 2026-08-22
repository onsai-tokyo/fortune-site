import test from 'node:test'
import assert from 'node:assert/strict'
import { appendCoupleTimingCards, buildCoupleTimingCards, findCoupleTurningPoints, type CoupleAnnualTiming } from './coupleTimingCards.js'

const themes = ['仕事', '暮らし', '学び', '関係', '挑戦', '休息']
function annual(offset = 0): CoupleAnnualTiming[] {
  return Array.from({ length: 17 }, (_, index) => ({
    year: 2020 + index,
    score: (index + offset) % 6,
    themes: [themes[(index + offset) % themes.length]],
  }))
}

test('二人の年運から過去5年を含む節目を6〜10件抽出し、過去の相違年も残す', () => {
  const partner = annual(2)
  partner[3] = { ...partner[3], score: annual()[3].score, themes: ['二人だけの別テーマ'] }
  const points = findCoupleTurningPoints(annual(), partner, 1995, 1992, 2026)
  assert.ok(points.length >= 6 && points.length <= 10)
  assert.ok(points.every(point => point.year >= 2021 && point.year <= 2036))
  assert.ok(points.some(point => point.kind === 'divergent'))
  assert.ok(points.some(point => point.year < 2026 && point.kind === 'divergent'))
  assert.ok(points.every(point => point.selfAge === point.year - 1995 && point.partnerAge === point.year - 1992))
})

test('出会いの兆しが未来だけなら今年から、過去にもあれば最古の年から始める', () => {
  const futureSelf = annual().map(item => ({ ...item, themes: item.year === 2029 ? ['出会い'] : ['仕事'] }))
  const futurePartner = annual(2).map(item => ({ ...item, themes: ['学び'] }))
  const futurePoints = findCoupleTurningPoints(futureSelf, futurePartner, 1995, 1992, 2026)
  assert.ok(futurePoints.every(point => point.year >= 2026))

  const pastSelf = futureSelf.map(item => ({ ...item, themes: item.year === 2022 ? ['縁が始まる'] : item.themes }))
  const pastPoints = findCoupleTurningPoints(pastSelf, futurePartner, 1995, 1992, 2026)
  assert.ok(pastPoints.every(point => point.year >= 2022))
  assert.ok(pastPoints.some(point => point.year < 2026))
})

test('節目カードは決定論的な8ページで二人の節目タブに入る', () => {
  const points = findCoupleTurningPoints(annual(), annual(2), 1995, 1992, 2026)
  const first = buildCoupleTimingCards(points)
  const second = buildCoupleTimingCards(points)
  assert.deepEqual(first, second)
  assert.ok(first.every(card => card.kind === 'timing' && card.tab === 'timing'))
  assert.ok(first.every(card => card.pages.length >= 8 && card.pages.length <= 12))
  assert.ok(first.every(card => card.period?.label.includes('あなた') && card.period.label.includes('相手')))
  assert.equal(new Set(first.map(card => card.title)).size, first.length)
  assert.ok(first.every(card => card.pages.every(page => [...page.text].length <= 120)))
  const pageTexts = first.flatMap(card => card.pages.map(page => page.text))
  assert.equal(new Set(pageTexts).size, pageTexts.length)
  assert.ok(first.every(card => card.pages.every(page => page.text.includes(card.period!.label.match(/\d{4}年/)![0]))))
})

test('異なる二人の年運は異なる節目を返し、既存の関係カードを保持する', () => {
  const first = buildCoupleTimingCards(findCoupleTurningPoints(annual(), annual(2), 1995, 1992, 2026))
  const second = buildCoupleTimingCards(findCoupleTurningPoints(annual(1), annual(4), 1995, 1992, 2026))
  assert.notDeepEqual(first.map(card => card.period?.label), second.map(card => card.period?.label))
  const base = {
    version: 2 as const, reportText: 'old', cards: [{
      id: 'relationship', kind: 'essence' as const, title: '二人の関係', summary: '要約', tags: ['相性'], period: null,
      pages: [{ role: 'opening' as const, label: '入口', text: '本文' }], evidence: [],
    }],
  }
  const combined = appendCoupleTimingCards(base, first)
  assert.equal(combined.cards[0].id, 'relationship')
  assert.equal(combined.cards.filter(card => card.tab === 'timing').length, first.length)
})
