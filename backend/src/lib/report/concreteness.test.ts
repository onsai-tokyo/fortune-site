import assert from 'node:assert/strict'
import test from 'node:test'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { LIFE_EVENTS } from './lifeEventLabels.js'
import { buildTurningPointCards } from './timingCards.js'

const ABSTRACT = /基準|前提|軸|輪郭|優先順位|条件|範囲|形にする/g
const CONCRETE = /引っ越し|同棲|結婚|入籍|転職|昇進|部署|上司|後輩|資格|固定費|貯金|家賃|通勤|連絡|記念日|片付け|処分|体調|休み|保険|サブスク|教材|研修|予定表|書類|荷物|仕事/

function fixtureCards() {
  return BIRTH_FIXTURES.flatMap(fixture => buildTurningPointCards(buildFixtureReportInput(fixture)))
}

test('年カードの本文に具体名詞が含まれる', () => {
  for (const card of fixtureCards()) {
    const body = card.pages.map(page => page.text).join('\n')
    assert.match(body, CONCRETE, `${card.id}: 具体的な出来事が一つも出てきません`)
  }
})

test('抽象語が本文で6回を超えない', () => {
  for (const card of fixtureCards()) {
    const body = card.pages.map(page => page.text).join('\n')
    const abstractCount = (body.match(ABSTRACT) ?? []).length
    assert.ok(abstractCount <= 6, `${card.id}: 抽象語が${abstractCount}回`)
  }
})

test('起こりやすいことは3項目の箇条書きで、資産を使い切るまで重複しない', () => {
  for (const fixture of BIRTH_FIXTURES) {
    const linesByKey = new Map<string, string[]>()
    for (const card of buildTurningPointCards(buildFixtureReportInput(fixture))) {
      const core = card.pages.find(page => page.role === 'core')
      assert.ok(core, `${fixture.id}/${card.id}: coreページがありません`)
      const lines = core.text.split('\n').filter(line => line.startsWith('・'))
      assert.equal(lines.length, 3, `${fixture.id}/${card.id}: 箇条書きが3件ではありません`)
      const allOutcomeLines = card.pages.flatMap(page => page.text.split('\n'))
        .map(line => line.replace(/^\d{4}年。/, ''))
        .filter(line => line.startsWith('・'))
      for (const line of allOutcomeLines) {
        assert.match(line, /^・\S/)
        const text = line.slice(1)
        const definition = LIFE_EVENTS.find(event => event.outcomes.includes(text))
        assert.ok(definition, `${fixture.id}: 未登録の出来事文です: ${text}`)
        linesByKey.set(definition.key, [...(linesByKey.get(definition.key) ?? []), text])
      }
    }
    for (const [key, lines] of linesByKey) {
      const assetCount = LIFE_EVENTS.find(event => event.key === key)?.outcomes.length ?? 0
      assert.equal(new Set(lines).size, Math.min(lines.length, assetCount), `${fixture.id}/${key}: 資産を使い切る前に重複しています`)
    }
  }
})

test('同一入力の年カードは完全一致する', () => {
  for (const fixture of BIRTH_FIXTURES) {
    const input = buildFixtureReportInput(fixture)
    assert.deepEqual(buildTurningPointCards(input), buildTurningPointCards(input), fixture.id)
  }
})
