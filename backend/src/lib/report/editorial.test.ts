import assert from 'node:assert/strict'
import test from 'node:test'
import { assignFindingsToChapters, buildEditorialStructuredReport } from './editorial.js'
import { titlesAreSimilar } from './aiWriter.js'
import type { ReportFact } from './facts.js'
import type { ReportFinding } from './findings.js'

const facts: ReportFact[] = ['a','b','c'].map((id, index) => ({ id, system: 'test', lineage: index === 2 ? 'number' : 'stems', factor: id, axis: index === 0 ? 'drive' : index === 1 ? 'relation' : 'tension', signal: ['initiative','harmony','tension-x'][index], polarity: 1, strength: 1, requiresBirthTime: false, signature: index === 2 }))
const findings: ReportFinding[] = facts.map((fact, index) => ({ id: `f${index}`, key: fact.signal, kind: fact.signature ? 'signature' : 'consensus', axis: fact.axis, confidence: 1, lineages: [fact.lineage], primaryFacts: [fact.id], supportingFacts: [] }))

test('章の主Findingと主Factを重複割当しない', () => {
  const assigned = assignFindingsToChapters(findings)
  assert.equal(new Set(assigned.map(item => item.finding.id)).size, assigned.length)
  assert.equal(new Set(assigned.flatMap(item => item.finding.primaryFacts)).size, assigned.flatMap(item => item.finding.primaryFacts).length)
})

test('Editorialカードは所見不足でも8章を維持し補完を追跡する', () => {
  const report = buildEditorialStructuredReport(facts, findings)
  assert.equal(report.cards.length, 8)
  assert.ok(report.cards.every(card => card.tab === 'essence' && card.tags.length > 0))
  assert.equal(new Set(report.cards.map(card => card.title)).size, report.cards.length)
  assert.ok(report.cards.some(card => card.compositionMode === 'mixed' && card.supplementPageCount === 6))
  assert.ok(report.cards.every(card => card.pages.length >= 15 && card.pages.length <= 18))
  assert.ok(report.cards.every(card => (card.supplementPageCount ?? 0) <= 6))
  const loveText = report.cards.filter(card => card.id.startsWith('love-')).flatMap(card => card.pages.map(page => page.text)).join('\n')
  const workText = report.cards.filter(card => card.id.startsWith('work-')).flatMap(card => card.pages.map(page => page.text)).join('\n')
  assert.doesNotMatch(loveText, /仕事|職場|キャリア|上司/u)
  assert.doesNotMatch(workText, /恋愛|恋人|結婚|パートナー/u)
  const allPages = report.cards.flatMap(card => card.pages.map(page => page.text))
  assert.equal(new Set(allPages).size, allPages.length)
})

test('人物像の各章は役割の異なる15〜20ページの読み物になる', () => {
  const report = buildEditorialStructuredReport(facts, findings)
  for (const card of report.cards) {
    assert.ok(card.pages.length >= 15 && card.pages.length <= 20)
    assert.ok([...card.pages[0].text].length < [...card.pages[2].text].length)
    if (card.id.startsWith('love-')) assert.ok(card.pages.some(page => page.label === '関係が日常になるとき'))
    else assert.ok(card.pages.some(page => page.label === '仕事で現れる面'))
    if (card.id.startsWith('work-')) assert.ok(card.pages.some(page => page.label === '任され方との相性'))
    else assert.ok(card.pages.some(page => page.label === '恋愛で現れる面'))
    assert.ok(card.pages.some(page => page.label === '余韻'))
    assert.equal(new Set(card.pages.map(page => page.text)).size, card.pages.length)
    assert.ok(card.pages.every(page => [...page.text].length <= 120))
  }
})

test('表示タイトルはFindingの結論になり、要約はあなたを主語にした重複のない2文になる', () => {
  const report = buildEditorialStructuredReport(facts, findings)
  const internalLabels = ['何度でも戻ってくる人生の軸', '人とのあいだに置く距離', '自分を見失いやすい瞬間']
  assert.ok(report.cards.every(card => !internalLabels.includes(card.title)))
  assert.ok(report.cards.every(card => card.summary.startsWith('あなたは、')))
  assert.ok(report.cards.every(card => card.summary.split('。').filter(Boolean).length === 2))
  assert.equal(new Set(report.cards.map(card => card.summary)).size, report.cards.length)
  assert.ok(report.cards.every(card => !['仕事', '恋愛', '結婚', '本質', '性格'].includes(card.title)))
})

test('五行不足と領域固有のFindingは具体値を捨てずにタイトルへ反映する', () => {
  const specialFacts: ReportFact[] = [
    { id: 'metal', system: '四柱推命', lineage: 'stems', factor: 'missingElement:金:0', axis: 'deficit', signal: 'missing-金', polarity: -1, strength: 1, requiresBirthTime: false, signature: true },
    { id: 'love', system: '紫微斗数', lineage: 'stems', factor: 'mutagen:0:夫妻宮:天相:化忌', axis: 'domain-love', signal: 'mutagen-化忌', polarity: -1, strength: 1, requiresBirthTime: true, signature: true },
  ]
  const specialFindings: ReportFinding[] = specialFacts.map((fact, index) => ({ id: `special-${index}`, key: fact.signal, kind: 'signature', axis: fact.axis, confidence: 1, lineages: [fact.lineage], primaryFacts: [fact.id], supportingFacts: [] }))
  const report = buildEditorialStructuredReport(specialFacts, specialFindings)
  assert.ok(report.cards.some(card => card.title.includes('決め切る力')))
  assert.ok(report.cards.some(card => card.title.includes('近い相手との関係だけ')))
})

test('異なるFindingでは全ページが別の文章になり、似たタイトルは差し替える', () => {
  const make = (signal: string): { fact: ReportFact; finding: ReportFinding } => {
    const fact: ReportFact = { id: signal, system: 'test', lineage: 'stems', factor: signal, axis: 'drive', signal, polarity: 1, strength: 1, requiresBirthTime: false, signature: true }
    return { fact, finding: { id: `finding-${signal}`, key: signal, kind: 'signature', axis: 'drive', confidence: 1, lineages: ['stems'], primaryFacts: [signal], supportingFacts: [] } }
  }
  const first = make('initiative'); const second = make('independence')
  const firstCard = buildEditorialStructuredReport([first.fact], [first.finding]).cards[0]
  const secondCard = buildEditorialStructuredReport([second.fact], [second.finding]).cards[0]
  assert.ok(firstCard.pages.every((page, index) => page.text !== secondCard.pages[index].text))

  const collisionFacts: ReportFact[] = [
    { ...first.fact, id: 'drive', axis: 'drive' },
    { ...first.fact, id: 'work', axis: 'domain-work' },
  ]
  const collisionFindings: ReportFinding[] = collisionFacts.map(fact => ({ id: `finding-${fact.id}`, key: 'initiative', kind: 'signature', axis: fact.axis, confidence: 1, lineages: ['stems'], primaryFacts: [fact.id], supportingFacts: [] }))
  const collisionReport = buildEditorialStructuredReport(collisionFacts, collisionFindings)
  assert.equal(collisionReport.cards.length, 8)
  const findingCards = collisionReport.cards.filter(card => card.compositionMode === 'finding')
  assert.equal(findingCards.length, 2)
  assert.equal(titlesAreSimilar(findingCards[0].title, findingCards[1].title), false)
})
