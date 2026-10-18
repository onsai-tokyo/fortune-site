import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { ReportFactV2 } from '../lib/report/factsV2.js'
import { buildReportFactsV2 } from '../lib/report/factsV2.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from '../lib/report/fixtures.js'
import { extractReportMetadata } from '../lib/report/metadata.js'
import { evaluateGroundedPersonality, GROUNDED_PERSONALITY_RULES } from './personalityGrounding.js'

function fact(factor: string, requiresBirthTime = false): ReportFactV2 {
  return { id: factor, factor, system: '西洋占星術', lineage: 'ephemeris', axis: 'domain-love',
    signal: 'responsibility', strength: 1, polarity: 1, requiresBirthTime, signature: false,
    derivations: [{ key: 'solar-longitude', weight: 1 }], canonicalSourceId: factor, votesInConsensus: true }
}
const ids = (facts: ReportFactV2[], hasTime = true) => evaluateGroundedPersonality(facts, hasTime).candidates.map(c => c.id)

test('same planets and score signal with 60 vs 90 degrees select different interpretations', () => {
  assert.deepEqual(ids([fact('structuredAspect:金星:セクスタイル:土星:orb3.7')]), ['pg-vs-sextile'])
  assert.deepEqual(ids([fact('structuredAspect:金星:スクエア:土星:orb1')]), ['pg-vs-square'])
  assert.deepEqual(ids([fact('structuredAspect:金星:トライン:土星:orb1')]), [])
})
test('planet order does not change the matched rule', () => {
  assert.deepEqual(ids([fact('structuredAspect:土星:セクスタイル:金星:orb3.7')]), ['pg-vs-sextile'])
})
test('a common signal, absent metal, or generation planet cannot fill a missing rule', () => {
  assert.deepEqual(ids([fact('missingElement:金:0'), fact('planet:冥王星:射手座'), fact('axis:relation')]), [])
  assert.deepEqual(ids([]), [])
})
test('outgoing/private contrast requires BOTH specific features', () => {
  const asc = fact('ascendant:射手座:20', true)
  const moon = fact('planet:月:乙女座', true)
  assert.deepEqual(ids([asc]), [])
  assert.deepEqual(ids([moon]), [])
  assert.deepEqual(ids([asc, moon]), ['pg-outgoing-private-moon'])
  assert.deepEqual(ids([asc, fact('planet:月:天秤座', true)]), [])
})
test('unknown time removes time-dependent evidence instead of assuming a house or ASC', () => {
  assert.deepEqual(ids([fact('house:4:太陽', true), fact('ascendant:山羊座:24', true), fact('planet:太陽:獅子座')], false), [])
  assert.deepEqual(ids([fact('structuredAspect:月:スクエア:海王星:orb0.1', true)], false), [])
  const result = evaluateGroundedPersonality([fact('structuredAspect:金星:スクエア:土星:orb1')], false)
  assert.match(result.candidates[0].dataNote, /日内変動.*未検証/)
})
test('unrelated support, duplicate facts and order cannot change selection or bloat evidence', () => {
  const target = fact('structuredAspect:金星:セクスタイル:土星:orb1')
  const clean = evaluateGroundedPersonality([target], true)
  assert.deepEqual(evaluateGroundedPersonality([fact('planet:木星:蠍座'), target, target], true), clean)
})
test('same factor text from another system is not a Western aspect', () => {
  assert.deepEqual(ids([{ ...fact('structuredAspect:金星:スクエア:土星:orb1'), system: 'インド占星術' }]), [])
})
test('new text never invents a duration, past event or outcome probability', () => {
  assert.equal(new Set(GROUNDED_PERSONALITY_RULES.map(r => r.id)).size, GROUNDED_PERSONALITY_RULES.length)
  for (const rule of GROUNDED_PERSONALITY_RULES) {
    assert.doesNotMatch(rule.title + rule.body, /半年|\d+年|\d+月|\d+%|必ず|初めての彼氏/)
    assert.ok(rule.sources.length && rule.counterexample && rule.interpretationNote)
  }
})
test('40 existing birth fixtures: deterministic, minimal provenance, and no rule without each condition', () => {
  for (const fixture of BIRTH_FIXTURES) {
    const input = buildFixtureReportInput(fixture)
    const facts = buildReportFactsV2(input, extractReportMetadata(input))
    const output = evaluateGroundedPersonality(facts, Boolean(fixture.birthTime))
    assert.deepEqual(evaluateGroundedPersonality([...facts].reverse(), Boolean(fixture.birthTime)), output)
    assert.equal(output.validation.outcomeAccuracy, null)
    for (const c of output.candidates) {
      assert.ok(c.conditions.every(condition => condition.evidence.length))
      assert.equal(c.independentSystemCount, 1)
      const rule = GROUNDED_PERSONALITY_RULES.find(r => r.id === c.id)!
      for (let i = 0; i < c.conditions.length; i++) {
        assert.ok(c.conditions[i].evidence.every(f => rule.conditions[i].pattern.test(f.factor)))
      }
    }
  }
})
test('production report entry and composer do not import the experimental engine', () => {
  for (const file of ['../lib/report/buildSelfReport.ts', '../lib/report/claimComposer.ts']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /personalityGrounding/)
  }
})
