import test from 'node:test'
import assert from 'node:assert/strict'
import { webAiAdult, WEB_AI_ADULT_NOTICE } from './webAiEligibility'

test('Web AI age uses a valid declared birth date and Japan birthday boundary', () => {
  assert.equal(webAiAdult('2008-10-19', new Date('2026-10-18T14:59:59Z')), false)
  assert.equal(webAiAdult('2008-10-19', new Date('2026-10-18T15:00:00Z')), true)
  for (const birth of ['2011-10-19', '2009-10-19', undefined, '', '2008-02-30', '2008-10-19junk', '2999-01-01']) {
    assert.equal(webAiAdult(birth, new Date('2026-10-19T00:00:00Z')), false)
  }
  assert.ok(WEB_AI_ADULT_NOTICE.includes('18歳以上') && WEB_AI_ADULT_NOTICE.includes('15歳以上'))
})
