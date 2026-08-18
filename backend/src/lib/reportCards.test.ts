import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStructuredReport } from './reportCards.js'

const source = `【先に読む要約】
[[HIGHLIGHT:責任の範囲を決めてから動く人です]]
頼まれごとをされたとき、あなたは条件を先に確かめます。
- 人生の軸：引き受けたことを形にします。
[[EVIDENCE:干支系｜四柱推命｜日柱 丙戌]]

【時期 — 重なりの強い年】
流れが切り替わる時期です。
[[YEAR:2026年]]
[[SUMMARY:仕事の役割が変わります]] [[DOMAIN:仕事]]`

test('同じレポート文字列から常に同じ構造化カード列を返す', () => {
  assert.deepEqual(buildStructuredReport(source), buildStructuredReport(source))
})

test('カードの本文・ページ・根拠をJSON構造として保持する', () => {
  const result = buildStructuredReport(source)
  assert.equal(result.version, 2)
  assert.equal(result.cards[0].title, '責任の範囲を決めてから動く人です')
  assert.match(result.cards[0].summary, /頼まれごと/)
  assert.ok(result.cards[0].pages.length >= 2)
  assert.deepEqual(result.cards[0].evidence[0], { family: '干支系', system: '四柱推命', detail: '日柱 丙戌' })
  assert.equal(result.cards[1].kind, 'timing')
})

test('本文の違いをカードタイトルへ反映する', () => {
  const first = buildStructuredReport('【仕事】\n頼まれた範囲を確かめてから、最後まで責任を持つ人です。\n条件を整理します。')
  const second = buildStructuredReport('【仕事】\n新しい企画を自分から始め、周囲を巻き込んで進める人です。\nまず試します。')
  assert.notEqual(first.cards[0].title, second.cards[0].title)
  assert.notEqual(first.cards[0].title, '仕事')
  assert.notEqual(second.cards[0].title, '仕事')
})

test('カード数とページ数を6枚・10枚の固定上限で切らない', () => {
  const manySections = Array.from({ length: 12 }, (_, sectionIndex) => {
    const lines = Array.from({ length: 8 }, (_, pageIndex) => `場面${sectionIndex + 1}-${pageIndex + 1}では、異なる行動を選びます。`)
    return `【テーマ${sectionIndex + 1}】\n[[HIGHLIGHT:テーマ${sectionIndex + 1}を表す個別タイトル]]\n${lines.join('\n')}`
  }).join('\n\n')
  const result = buildStructuredReport(manySections)
  assert.equal(result.cards.length, 12)
  assert.equal(result.cards[0].pages.length, 8)
})
