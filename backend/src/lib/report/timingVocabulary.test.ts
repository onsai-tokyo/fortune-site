import assert from 'node:assert/strict'
import test from 'node:test'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { buildTurningPointCards } from './timingCards.js'

const FORBIDDEN = /配偶者星|日支|地支|天干|六合|日支と冲|日支と破|桃花|傷官|正官|偏官|正財|偏財|食神|印綬|偏印|比肩|劫財|天中殺|位相法|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/

test('40件すべての年カード表示文に占術用語が出ない', () => {
  for (const fixture of BIRTH_FIXTURES) {
    for (const card of buildTurningPointCards(buildFixtureReportInput(fixture))) {
      const body = [card.title, card.summary, ...card.tags, ...card.pages.map(page => page.text)].join('\n')
      assert.doesNotMatch(body, FORBIDDEN, `${fixture.id}/${card.id}: 占術用語が表示文に出ています`)
      assert.ok(card.evidence.length > 0, `${fixture.id}/${card.id}: 根拠が失われています`)
    }
  }
})
