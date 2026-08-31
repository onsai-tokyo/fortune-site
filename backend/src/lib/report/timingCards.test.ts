import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportInput } from '../deterministicReport.js'
import { containsJargon } from './jargon.js'
import { buildTurningPointCards } from './timingCards.js'

const input: ReportInput = {
  birthTime: '03:02', shichuDay: '甲子', nayin: '海中金', sanmeiStar: '貫索星', chusatsu: '戌亥', sukuyo: '角', lifePathNumber: 1, honmeiName: '一白水星',
  timing: { direction: '順行', startDate: '2000-01-01', marriageCandidates: [], decades: [], annual: [
    { year: 2024, ageRange: '26歳', kanshi: '甲辰', tenGod: '偏財', score: 8, relationshipSignals: [], themes: ['環境の変化'] },
    { year: 2026, ageRange: '28歳', kanshi: '丙午', tenGod: '正財', score: 9, relationshipSignals: ['出会い'], themes: ['恋愛'] },
  ] },
}

test('年の選抜は従来条件を保ち、スクロール節を返す', () => {
  const cards = buildTurningPointCards(input, 2026)
  assert.equal(cards.length, 2)
  assert.ok(cards.every(card => card.sections && card.sections.length >= 1 && card.sections.length <= 2))
  assert.ok(cards.every(card => /^\d{4}年（.+）$/.test(card.period?.label ?? '')))
})

test('本文へ生の計算文字列や専門用語を出さずEvidenceへ保持する', () => {
  const cards = buildTurningPointCards(input, 2026)
  const relationship = cards.find(card => card.id === 'turning-year-2026')!
  const body = [relationship.title, relationship.summary, ...(relationship.sections ?? []).flatMap(section => [section.heading, section.body])].join('\n')
  assert.equal(containsJargon(body), false)
  assert.doesNotMatch(body, /丙午|正財/)
  assert.match(relationship.evidence.map(item => item.detail).join('\n'), /丙午|正財/)
  assert.ok(relationship.tags.includes('恋愛'))
  assert.ok(relationship.tags.includes('出会い'))
})

test('見出しに使った資産を節見出しとして繰り返さない', () => {
  for (const card of buildTurningPointCards(input, 2026)) {
    assert.ok((card.sections ?? []).every(section => section.heading !== card.title))
    assert.equal(new Set((card.sections ?? []).map(section => section.claimId)).size, card.sections?.length)
  }
})

test('連続年と1年空きは1クラスタにまとめる', () => {
  const annual = [2020, 2021, 2023, 2030].map(year => ({ year, ageRange: '30歳', kanshi: '甲子', tenGod: '正官', score: 8, relationshipSignals: ['結婚'], themes: ['恋愛'] }))
  const report: ReportInput = { ...input, timing: { ...input.timing!, annual } }
  const cards = buildTurningPointCards(report, 2025)
  assert.match(cards.find(card => card.id === 'turning-year-2020')!.title, /第一回目の婚期/)
  assert.match(cards.find(card => card.id === 'turning-year-2030')!.title, /第二回目の婚期/)
  assert.ok(cards.filter(card => /第一回目/.test(card.title)).length >= 1)
})

test('クラスタが1つだけなら第一回目を表示しない', () => {
  const annual = [2025, 2026].map(year => ({ year, ageRange: '30歳', kanshi: '甲子', tenGod: '正官', score: 8, relationshipSignals: ['結婚'], themes: ['恋愛'] }))
  const report: ReportInput = { ...input, timing: { ...input.timing!, annual } }
  assert.ok(buildTurningPointCards(report, 2026).every(card => !/第一回目/.test(card.title)))
})

test('出生時刻なしではstrong扱いの通し番号を表示しない', () => {
  const annual = [2020, 2030].map(year => ({ year, ageRange: '30歳', kanshi: '甲子', tenGod: '正官', score: 8, relationshipSignals: ['結婚'], themes: ['恋愛'] }))
  const report: ReportInput = { ...input, birthTime: undefined, timing: { ...input.timing!, annual } }
  assert.ok(buildTurningPointCards(report, 2025).every(card => !/回目/.test(card.title)))
})

test('移動テーマを生活語の環境変化へ配線する', () => {
  const report: ReportInput = { ...input, timing: { ...input.timing!, annual: [
    { year: 2026, ageRange: '28歳', kanshi: '丙午', tenGod: '正財', score: 9, relationshipSignals: [], themes: ['移動・配置転換・関係の組み替え'] },
  ] } }
  const [card] = buildTurningPointCards(report, 2026)
  assert.ok(card.tags.includes('引越し・環境変化'))
  assert.equal(containsJargon([card.title, card.summary, ...card.pages.map(page => page.text)].join('\n')), false)
})
