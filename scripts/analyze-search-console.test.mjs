import assert from 'node:assert/strict'
import test from 'node:test'
import { classify, normalizeRows, renderReport } from './analyze-search-console.mjs'

const csv = `検索キーワード,ページ,クリック数,表示回数,CTR,平均掲載順位
四柱推命 自動計算,https://fate-lab.com/tools/shichu-suimei-calculator,4,500,0.8%,9.2
四柱推命 自分は何,https://fate-lab.com/guides/shichu-suimei-what-am-i,2,100,2%,5.4
fate lab,https://fate-lab.com/,20,100,20%,1.2
`

test('Search Consoleの日本語CSVを正規化する', () => {
  const rows = normalizeRows(csv)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], {
    query: '四柱推命 自動計算',
    page: 'https://fate-lab.com/tools/shichu-suimei-calculator',
    clicks: 4,
    impressions: 500,
    ctr: .8,
    position: 9.2,
  })
})

test('順位帯と低CTRを改善候補へ分類する', () => {
  const groups = classify(normalizeRows(csv))
  assert.equal(groups.opportunities[0].query, '四柱推命 自動計算')
  assert.equal(groups.lowCtr[0].query, '四柱推命 自動計算')
  assert.equal(groups.nearTop[0].query, '四柱推命 自分は何')
  assert.equal(groups.winners[0].query, 'fate lab')
  assert.match(renderReport(normalizeRows(csv)), /掲載順位8〜30位/)
})
