import assert from 'node:assert/strict'
import test from 'node:test'
import { ANNUAL_COMBINATIONS, annualNarrative, composeAnnualNarrative } from './timingAnnualNarrative.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { buildAnnualHistoryCards, timingAnnualValues, timingEventKeys } from './timingCards.js'

test('保存済みの旧テーマと新テーマは同じ意味として読み、二重掲載しない', () => {
  const oldTheme = '仲間との役割を組み替え、活動範囲を広げること'
  const newTheme = '人から刺激を受けながら、自分の進み方を確かめること'
  assert.deepEqual(annualNarrative([oldTheme]), annualNarrative([newTheme]))
  assert.deepEqual(annualNarrative([oldTheme, newTheme]), annualNarrative([newTheme]))
  assert.deepEqual(annualNarrative(['競争に勝った', '受験に失敗した']), [])
})

test('旧テーマの役割という単語だけで仕事と判定せず、独立した仕事の根拠は残す', () => {
  const annual = { themes: ['仲間との役割を組み替え、活動範囲を広げること'], relationshipSignals: [], relationshipEvents: [] } as unknown as Parameters<typeof timingAnnualValues>[0]
  assert.ok(!timingEventKeys(timingAnnualValues(annual)).includes('work'))
  annual.themes.push('責任や肩書を引き受け、関係や役割を正式にすること')
  assert.ok(timingEventKeys(timingAnnualValues(annual)).includes('work'))
})

test('組み合わせは必要な意味が全て揃った時だけ使い、未知の意味を補わない', () => {
  for (const rule of ANNUAL_COMBINATIONS) {
    const phrases = rule.requires.map(id => ({ id, title: id, body: id }))
    assert.equal(composeAnnualNarrative(phrases)?.id, rule.id)
    assert.deepEqual(composeAnnualNarrative(phrases), composeAnnualNarrative([...phrases].reverse()))
    for (const id of rule.requires) {
      assert.notEqual(composeAnnualNarrative(phrases.filter(p => p.id !== id))?.id, rule.id)
    }
  }
  assert.equal(composeAnnualNarrative(annualNarrative(['結婚', '失恋', '転職', '未知の計算結果'])), null)
})

test('組み合わせで未使用の意味と、関係の複数方向を落とさない', () => {
  const result = composeAnnualNarrative(annualNarrative([
    '変化へすばやく対応し、難しい役割へ踏み出すこと',
    '交際開始・別離・復縁など関係の状態が切り替わりやすい',
    '移動や配置転換で関係を組み替えること',
  ]))!
  assert.match(result.body, /始める、離れる、つながり直す/)
  assert.match(result.body, /居場所や担当が変わる/)
  const formal = composeAnnualNarrative(annualNarrative([
    '違和感を言葉にし、表現や方法を磨き直すこと', '縁がまとまること',
    '交際・同居・婚約・結婚、または正式な終了など関係を定めやすい',
  ]))!
  assert.match(formal.body, /進める方向も.*区切る方向も/)
})

test('同じ日干でも関係の根拠が異なる2018年は別の見出しになり、実体験を追加しない', () => {
  const a = buildFixtureReportInput({ id: 'a', birthDate: '1995-02-20', birthTime: '03:02', birthplace: '愛知県', gender: 'female', group: 'same-year' })
  const b = buildFixtureReportInput({ id: 'b', birthDate: '1995-06-30', birthTime: null, birthplace: '高知県', gender: 'female', group: 'same-year' })
  const beforeA = structuredClone(a)
  const beforeB = structuredClone(b)
  const cardsA = buildAnnualHistoryCards(a, 2026)
  const cardsB = buildAnnualHistoryCards(b, 2026)
  assert.deepEqual(a, beforeA)
  assert.deepEqual(b, beforeB)
  assert.notEqual(cardsA.find(c => c.id === 'turning-year-2018')!.title, cardsB.find(c => c.id === 'turning-year-2018')!.title)
  // Same calculated meanings should stay the same, without birthday-based prose rotation.
  assert.equal(cardsA.find(c => c.id === 'turning-year-2014')!.summary, cardsB.find(c => c.id === 'turning-year-2014')!.summary)
  assert.doesNotMatch(cardsA.map(c => `${c.title}${c.summary}`).join('\n'), /初めての彼|初彼|失恋した|2016年後半|2018年に別れ/)
  for (const input of [a, b]) {
    for (const card of buildAnnualHistoryCards(input, 2026)) {
      const year = input.timing!.annual.find(y => card.id === `turning-year-${y.year}`)!
      const expected = annualNarrative([...year.themes, ...(year.relationshipEvents ?? [])])
      for (const phrase of expected) {
        assert.ok(card.metadataRefs?.includes(`timing-annual-v1:${phrase.id}`))
        assert.ok(card.sections!.some(section => section.body.includes(phrase.body) || section.components?.some(c => c.claimId === `timing-domain:${year.year}:${phrase.id}`)))
      }
    }
  }
})

test('既存40入力で到達した組み合わせを記録し、根拠のない専用文を出さない', () => {
  const reached = new Set<string>()
  for (const fixture of BIRTH_FIXTURES) {
    const input = buildFixtureReportInput(fixture)
    for (const year of input.timing!.annual) {
      const phrases = annualNarrative([...year.themes, ...(year.relationshipEvents ?? [])])
      const result = composeAnnualNarrative(phrases)
      if (!result) continue
      reached.add(result.id)
      const rule = ANNUAL_COMBINATIONS.find(r => r.id === result.id)!
      assert.ok(rule.requires.every(id => phrases.some(p => p.id === id)))
    }
  }
  console.info('Reached combinations:', [...reached].sort().join(', '))
  assert.ok(reached.has('challenge-with-transition'))
  assert.ok(reached.has('encounters-with-misalignment'))
})
