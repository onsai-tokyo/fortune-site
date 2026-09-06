import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportInput } from '../deterministicReport.js'
import { containsJargon } from './jargon.js'
import { buildTurningPointCards, replaceTimingCards } from './timingCards.js'
import { buildStructuredReport } from '../reportCards.js'
import { calcTimingCycles } from '../divination/index.js'
import { annualNarrative } from './timingAnnualNarrative.js'

const input: ReportInput = {
  birthTime: '03:02', shichuDay: '甲子', nayin: '海中金', sanmeiStar: '貫索星', chusatsu: '戌亥', sukuyo: '角', lifePathNumber: 1, honmeiName: '一白水星',
  timing: { direction: '順行', startDate: '2000-01-01', marriageCandidates: [], decades: [], annual: [
    { year: 2024, ageRange: '26歳', kanshi: '甲辰', tenGod: '偏財', score: 8, relationshipSignals: [], themes: ['移動や配置転換で関係を組み替えること'] },
    { year: 2026, ageRange: '28歳', kanshi: '丙午', tenGod: '正財', score: 9, relationshipSignals: ['出会い'], themes: ['人との接点を広げ、機会や成果を動かすこと'] },
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
  const annual = [2020, 2021, 2023, 2030].map(year => ({ year, ageRange: '30歳', kanshi: '甲子', tenGod: '正官', score: 8, relationshipSignals: ['結婚'], themes: ['人との接点を広げ、機会や成果を動かすこと'] }))
  const report: ReportInput = { ...input, timing: { ...input.timing!, annual } }
  const cards = buildTurningPointCards(report, 2025)
  assert.match(cards.find(card => card.id === 'turning-year-2020')!.title, /第一回目の婚期/)
  assert.match(cards.find(card => card.id === 'turning-year-2030')!.title, /第二回目の婚期/)
  assert.ok(cards.filter(card => /第一回目/.test(card.title)).length >= 1)
})

test('クラスタが1つだけなら第一回目を表示しない', () => {
  const annual = [2025, 2026].map(year => ({ year, ageRange: '30歳', kanshi: '甲子', tenGod: '正官', score: 8, relationshipSignals: ['結婚'], themes: ['人との接点を広げ、機会や成果を動かすこと'] }))
  const report: ReportInput = { ...input, timing: { ...input.timing!, annual } }
  assert.ok(buildTurningPointCards(report, 2026).every(card => !/第一回目/.test(card.title)))
})

test('出生時刻なしではstrong扱いの通し番号を表示しない', () => {
  const annual = [2020, 2030].map(year => ({ year, ageRange: '30歳', kanshi: '甲子', tenGod: '正官', score: 8, relationshipSignals: ['結婚'], themes: ['人との接点を広げ、機会や成果を動かすこと'] }))
  const report: ReportInput = { ...input, birthTime: undefined, timing: { ...input.timing!, annual } }
  assert.ok(buildTurningPointCards(report, 2025).every(card => !/回目/.test(card.title)))
})

test('移動テーマを生活語の環境変化へ配線する', () => {
  const report: ReportInput = { ...input, timing: { ...input.timing!, annual: [
    { year: 2026, ageRange: '28歳', kanshi: '丙午', tenGod: '正財', score: 9, relationshipSignals: [], themes: ['移動や配置転換で関係を組み替えること'] },
  ] } }
  const [card] = buildTurningPointCards(report, 2026)
  assert.ok(card.tags.includes('引越し・環境変化'))
  assert.equal(containsJargon([card.title, card.summary, ...card.pages.map(page => page.text)].join('\n')), false)
})

// TestFlight 64: adjacent years had different calculated themes but the same work copy.
test('年ごとの計算済みテーマを保持し、同じ仕事分類でも隣接年を同文に潰さない', () => {
  const timing = calcTimingCycles(1995, 2, 20, 3, 2, 'female')
  const report: ReportInput = { ...input, birthDate: '1995-02-20', timing }
  const cards = buildTurningPointCards(report, 2026)
  for (const [left, right] of [[2018, 2019], [2028, 2029]]) {
    const a = cards.find(card => card.id === `turning-year-${left}`)!
    const b = cards.find(card => card.id === `turning-year-${right}`)!
    assert.ok(a && b)
    assert.notEqual(a.title, b.title)
    assert.notEqual(a.summary, b.summary)
  }
  const year = timing.annual.find(item => item.year === 2023)!
  const card = cards.find(card => card.id === 'turning-year-2023')!
  assert.match(card.summary, /分担を見直し/)
  assert.match(card.summary, /前提を見つめ直す/)
  assert.match(card.summary, /新しい人との出会い/)
  assert.match(card.summary, /食い違いが表に出て/)
  for (const value of [...year.themes, ...year.relationshipEvents]) {
    assert.ok(card.evidence.some(evidence => evidence.detail.includes(value)))
  }
  assert.ok(card.tags.includes('出会い'))
  assert.doesNotMatch(card.summary, /裏切|前半|後半/)
  assert.deepEqual(buildTurningPointCards(report, 2026), cards)
})

test('年齢はその年の誕生日に迎える年齢で表示する', () => {
  const report: ReportInput = { ...input, birthDate: '1995-02-20', timing: { ...input.timing!, annual: [2014, 2015].map(year => ({
    year, age: year - 1995, ageRange: `${year - 1996}〜${year - 1995}歳`, kanshi: '甲子', tenGod: '正官',
    score: 8, relationshipSignals: ['出会い'], themes: ['人との接点を広げ、機会や成果を動かすこと'],
  })) } }
  assert.deepEqual(buildTurningPointCards(report, 2026).map(card => card.period?.label), [
    '2014年（19歳になる年）', '2015年（20歳になる年）',
  ])
})

test('表示可能な年の根拠がない場合、分類だけの汎用文章で埋めない', () => {
  const report: ReportInput = { ...input, timing: { ...input.timing!, annual: [{
    year: 2026, ageRange: '30歳', kanshi: '丙午', tenGod: '正財', score: 8,
    relationshipSignals: ['天干に配偶者星の正財'], themes: [],
  }] } }
  assert.deepEqual(buildTurningPointCards(report, 2026), [])
  const oldReport = buildStructuredReport('【本質】\n保存する本文')
  oldReport.cards.push(...buildTurningPointCards(input, 2026))
  const replaced = replaceTimingCards(oldReport, report)
  assert.equal(replaced.cards.some(card => card.kind === 'timing'), false)
  assert.deepEqual(replaced.cards.map(card => card.id), oldReport.cards.filter(card => card.kind !== 'timing').map(card => card.id))
})

test('年テーマ・関係イベントの各根拠に文章が対応し、未知の分類は補完しない', () => {
  for (const gender of ['female', 'male'] as const) {
    const timing = calcTimingCycles(1995, 2, 20, 3, 2, gender)
    for (const year of timing.annual) for (const value of [...year.themes, ...year.relationshipEvents]) {
      assert.equal(annualNarrative([value]).length, 1, `未対応の計算済み根拠: ${value}`)
    }
  }
  assert.deepEqual(annualNarrative(['仕事', '恋愛', '未知の計算結果', '__proto__']), [])
})
