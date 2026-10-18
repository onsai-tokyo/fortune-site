import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPersonalityFoundation, PERSONALITY_DAY_PILLARS } from './personalityFoundation.js'

const input = (kanshi: string) => ({
  birthTime: '03:02',
  fourPillars: [{ label: '日柱', kanshi, stemTenGod: '日主', hiddenStems: [] }],
  sanmeiChart: { bodyChart: { center: { label: '中央', star: '鳳閣星' } }, subordinateStars: {} },
})
test('60 valid day pillars retain complete stem-branch identities', () => {
  assert.equal(PERSONALITY_DAY_PILLARS.length, 60)
  assert.equal(new Set(PERSONALITY_DAY_PILLARS.map(p => p.kanshi)).size, 60)
  assert.equal(PERSONALITY_DAY_PILLARS[0].kanshi, '甲子')
  assert.equal(PERSONALITY_DAY_PILLARS[59].kanshi, '癸亥')
  for (const day of PERSONALITY_DAY_PILLARS) {
    assert.equal(buildPersonalityFoundation(input(day.kanshi)).status, 'foundation-ready')
  }
})
test('same day stem with different branch does not collapse to one base', () => {
  assert.notEqual(buildPersonalityFoundation(input('壬午')).baseKey, buildPersonalityFoundation(input('壬辰')).baseKey)
})
test('missing or impossible pillar and missing center do not get a fallback identity', () => {
  assert.equal(buildPersonalityFoundation(input('甲丑')).baseKey, null)
  assert.equal(buildPersonalityFoundation({}).baseKey, null)
  assert.equal(buildPersonalityFoundation({ ...input('甲子'), sanmeiChart: undefined }).baseKey, null)
})
test('unknown time cannot introduce an hour pillar; inputs remain intact', () => {
  const original = input('壬午')
  original.fourPillars.push({ label: '時柱', kanshi: '壬寅', stemTenGod: '比肩', hiddenStems: [] })
  const before = JSON.stringify(original)
  const result = buildPersonalityFoundation({ ...original, birthTime: undefined })
  assert.equal(result.modifiers.pillars.length, 1)
  assert.equal(JSON.stringify(original), before)
  assert.equal(result.policy.supplementaryMayReplaceFoundation, false)
  assert.equal(result.policy.agreementIsIndependentProof, false)
})
