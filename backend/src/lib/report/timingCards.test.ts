import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportInput } from '../deterministicReport.js'
import { buildTurningPointCards } from './timingCards.js'

const input: ReportInput = {
  shichuDay: '甲子', nayin: '海中金', sanmeiStar: '貫索星', chusatsu: '戌亥', sukuyo: '角', lifePathNumber: 1, honmeiName: '一白水星',
  timing: {
    direction: '順行', startDate: '2000-01-01', marriageCandidates: [],
    decades: [{ startYear: 2018, endYear: 2027, startAge: 20, endAge: 29, kanshi: '甲子', tenGod: '正官', themes: ['仕事', '責任'] }],
    annual: [
      { year: 2024, ageRange: '26歳', kanshi: '甲辰', tenGod: '偏財', score: 8, relationshipSignals: [], themes: ['環境の変化'] },
      { year: 2026, ageRange: '28歳', kanshi: '丙午', tenGod: '正財', score: 9, relationshipSignals: ['出会い'], themes: ['恋愛'] },
    ],
  },
}

test('大運を一覧カードにせず転機のある年だけをカードにする', () => {
  const cards = buildTurningPointCards(input, 2026)
  assert.equal(cards.length, 2)
  assert.ok(cards.every(card => card.id.startsWith('turning-year-')))
  assert.ok(cards.every(card => !/^\d{4}\s*-\s*\d{4}/.test(card.period?.label ?? '')))
  assert.ok(cards.every(card => card.kind === 'timing' && card.tab === 'timing' && card.period?.label))
  assert.ok(cards.every(card => card.pages.length >= 8 && card.pages.length <= 12))
})

test('時期カードのタイトルを年だけにしない', () => {
  const cards = buildTurningPointCards(input, 2026)
  assert.ok(cards.every(card => !/^\d{4}(?:年)?$/.test(card.title)))
  assert.ok(cards.some(card => card.title.includes('出会い')))
  assert.ok(cards.every(card => !card.title.includes(card.period?.label ?? '___')))
})

test('本文とタグに年ごとの出来事・命式根拠を反映する', () => {
  const cards = buildTurningPointCards(input, 2026)
  const relationship = cards.find(card => card.id === 'turning-year-2026')!
  assert.ok(relationship.tags.includes('恋愛'))
  assert.ok(relationship.tags.includes('出会い'))
  assert.match(relationship.pages.map(page => page.text).join('\n'), /出会い|丙午|正財/)
  assert.ok(relationship.pages.every(page => [...page.text].length <= 120))
})

test('同じ事象が複数年に続いてもタイトルを重複させない', () => {
  const repeated: ReportInput = { ...input, timing: { ...input.timing!, annual: [
    { year: 2025, ageRange: '27歳', kanshi: '乙巳', tenGod: '正官', score: 9, relationshipSignals: ['出会い'], themes: ['恋愛'] },
    { year: 2026, ageRange: '28歳', kanshi: '丙午', tenGod: '正財', score: 9, relationshipSignals: ['出会い'], themes: ['恋愛'] },
  ] } }
  const cards = buildTurningPointCards(repeated, 2026)
  assert.equal(new Set(cards.map(card => card.title)).size, cards.length)
})
