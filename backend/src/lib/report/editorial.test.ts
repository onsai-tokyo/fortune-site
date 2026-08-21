import assert from 'node:assert/strict'
import test from 'node:test'
import { assignFindingsToChapters, buildEditorialStructuredReport } from './editorial.js'
import type { ReportFact } from './facts.js'
import type { ReportFinding } from './findings.js'

const facts: ReportFact[] = ['a','b','c'].map((id, index) => ({ id, system: 'test', lineage: index === 2 ? 'number' : 'stems', factor: id, axis: index === 0 ? 'drive' : index === 1 ? 'relation' : 'tension', signal: ['initiative','harmony','tension-x'][index], polarity: 1, strength: 1, requiresBirthTime: false, signature: index === 2 }))
const findings: ReportFinding[] = facts.map((fact, index) => ({ id: `f${index}`, key: fact.signal, kind: fact.signature ? 'signature' : 'consensus', axis: fact.axis, confidence: 1, lineages: [fact.lineage], primaryFacts: [fact.id], supportingFacts: [] }))

test('章の主Findingと主Factを重複割当しない', () => {
  const assigned = assignFindingsToChapters(findings)
  assert.equal(new Set(assigned.map(item => item.finding.id)).size, assigned.length)
  assert.equal(new Set(assigned.flatMap(item => item.finding.primaryFacts)).size, assigned.flatMap(item => item.finding.primaryFacts).length)
})

test('Editorialカードはtabとtagsを持ち固定文で不足章を埋めない', () => {
  const report = buildEditorialStructuredReport(facts, findings)
  assert.ok(report.cards.length < 8)
  assert.ok(report.cards.every(card => card.tab === 'essence' && card.tags.length > 0))
  assert.equal(new Set(report.cards.map(card => card.title)).size, report.cards.length)
})

test('人物像の各章は役割の異なる15〜20ページの読み物になる', () => {
  const report = buildEditorialStructuredReport(facts, findings)
  for (const card of report.cards) {
    assert.ok(card.pages.length >= 15 && card.pages.length <= 20)
    assert.ok([...card.pages[0].text].length < [...card.pages[2].text].length)
    assert.ok(card.pages.some(page => page.label === '恋愛で現れる面'))
    assert.ok(card.pages.some(page => page.label === '仕事で現れる面'))
    assert.ok(card.pages.some(page => page.label === '余韻'))
    assert.equal(new Set(card.pages.map(page => page.text)).size, card.pages.length)
    assert.ok(card.pages.every(page => [...page.text].length <= 120))
  }
})
