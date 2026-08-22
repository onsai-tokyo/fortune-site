import test from 'node:test'
import assert from 'node:assert/strict'
import { appendCoupleTimingCards, buildCoupleTimingCards, findCoupleTurningPoints, type CoupleAnnualTiming } from './coupleTimingCards.js'

const themes = ['仕事', '暮らし', '学び', '関係', '挑戦', '休息']
function annual(offset = 0): CoupleAnnualTiming[] {
  return Array.from({ length: 14 }, (_, index) => ({
    year: 2023 + index,
    score: (index + offset) % 6,
    themes: [themes[(index + offset) % themes.length]],
  }))
}

test('二人の年運から範囲内の節目を6〜8件抽出し、相違年も残す', () => {
  const partner = annual(2)
  partner[5] = { ...partner[5], score: annual()[5].score, themes: ['二人だけの別テーマ'] }
  const points = findCoupleTurningPoints(annual(), partner, 1995, 1992, 2026)
  assert.ok(points.length >= 6 && points.length <= 8)
  assert.ok(points.every(point => point.year >= 2023 && point.year <= 2036))
  assert.ok(points.some(point => point.kind === 'divergent'))
  assert.ok(points.every(point => point.selfAge === point.year - 1995 && point.partnerAge === point.year - 1992))
})

test('節目カードは決定論的な8ページで二人の節目タブに入る', () => {
  const points = findCoupleTurningPoints(annual(), annual(2), 1995, 1992, 2026)
  const first = buildCoupleTimingCards(points)
  const second = buildCoupleTimingCards(points)
  assert.deepEqual(first, second)
  assert.ok(first.every(card => card.kind === 'timing' && card.tab === 'timing'))
  assert.ok(first.every(card => card.pages.length >= 8 && card.pages.length <= 12))
  assert.ok(first.every(card => card.period?.label.includes('あなた') && card.period.label.includes('相手')))
  assert.ok(first.every(card => card.pages.every(page => [...page.text].length <= 120)))
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
