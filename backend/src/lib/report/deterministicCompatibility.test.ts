import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDeterministicCompatibilityReport } from './deterministicCompatibility.js'

const self = { shichuDay: '癸卯', lifePathNumber: 1, sukuyo: '角宿' }
const partner = { shichuDay: '乙亥', lifePathNumber: 8, sukuyo: '翼宿' }

test('恋愛相性は決定論で8章・各10ページを返す', () => {
  const first = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い')
  const second = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い')
  assert.deepEqual(first, second)
  assert.equal(first.cards.length, 8)
  assert.ok(first.cards.every(card => card.pages.length === 10 && card.generator === 'deterministic' && card.scope === 'couple'))
  assert.ok(first.cards.every(card => card.pages.every(page => [...page.text].length <= 120)))
  assert.equal(new Set(first.cards.map(card => card.title)).size, 8)
  assert.equal(new Set(first.cards.map(card => card.summary)).size, 8)
  assert.equal(new Set(first.cards.flatMap(card => card.pages.map(page => page.text))).size, 80)
})

test('関係ラベルを本文へ固定し片思いを交際中として書かない', () => {
  const crush = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い')
  const dating = buildDeterministicCompatibilityReport(self, partner, 'romantic', 'お付き合い中')
  const crushText = crush.cards.flatMap(card => card.pages.map(page => page.text)).join('\n')
  assert.match(crushText, /片思い/)
  assert.doesNotMatch(crushText, /交際中|お付き合い中/)
  assert.notDeepEqual(crush.cards.map(card => card.pages), dating.cards.map(card => card.pages))
})

test('友人・家族は結婚章を生成せず7章を維持する', () => {
  for (const [type, label] of [['friend', '友人'], ['family', '兄弟姉妹']] as const) {
    const report = buildDeterministicCompatibilityReport(self, partner, type, label)
    assert.equal(report.cards.length, 7)
    assert.ok(!report.cards.some(card => card.id === 'compat-marriage'))
  }
})

test('占術用語は本文へ出さず根拠にだけ保持する', () => {
  const report = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い')
  const readerText = report.cards.flatMap(card => [card.title, card.summary, ...card.pages.flatMap(page => [page.label, page.text])]).join('\n')
  assert.doesNotMatch(readerText, /天中殺|日柱|日主|干支|五行|通変星|宿曜|納音|命宮|夫妻宮|癸卯|乙亥/u)
  assert.ok(report.cards.every(card => card.evidence.some(item => item.detail.includes('癸卯'))))
})
