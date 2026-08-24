import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { assessCompatibilityCutoverReadiness, assessDeterministicCutoverReadiness, REQUIRED_COMPATIBILITY_SCORE_KEYS } from './deterministicCutoverReadiness.js'
import { auditRuleSourceDocument } from './traitScoreRuleValidation.js'
import { REQUIRED_TRAIT_SCORE_KEYS, TRAIT_SCORE_RULES, type TraitScoreRule } from './traitScores.js'
import { IMPLEMENTED_COMPATIBILITY_SCORE_KEYS } from './synastryFacts.js'

const sections = (count: number) => Array.from({ length: count }, (_, index) => `# ${index + 1}. source`).join('\n\n')

test('直接65種と派生5種が揃うとスコア層の切替条件を満たす', () => {
  const personality = readFileSync(new URL('./rules/PERSONALITY_RULES.md', import.meta.url), 'utf8')
  const events = readFileSync(new URL('./rules/EVENT_RULES.md', import.meta.url), 'utf8')
  const readiness = assessDeterministicCutoverReadiness(personality, events, TRAIT_SCORE_RULES)
  assert.equal(readiness.ready, true)
  assert.equal(readiness.personalitySections, 58)
  assert.equal(readiness.eventSections, 53)
  assert.equal(readiness.coveredScores, 70)
  assert.deepEqual(readiness.reasons, [])
})

test('相性原典は全58節に欠番・重複がない', () => {
  const compatibility = readFileSync(new URL('./rules/COMPATIBILITY_RULES.md', import.meta.url), 'utf8')
  const audit = auditRuleSourceDocument(compatibility, 58)
  assert.equal(audit.complete, true)
  assert.deepEqual(audit.missingSections, [])
  assert.deepEqual(audit.duplicateSections, [])
})

test('相性の切替診断を本人鑑定から分離し主要39スコアで判定する', () => {
  const compatibility = readFileSync(new URL('./rules/COMPATIBILITY_RULES.md', import.meta.url), 'utf8')
  const current = assessCompatibilityCutoverReadiness(compatibility, IMPLEMENTED_COMPATIBILITY_SCORE_KEYS)
  assert.equal(current.ready, false)
  assert.equal(current.compatibilitySections, 58)
  assert.equal(current.coveredScores, 37)
  assert.equal(current.requiredScores, 39)
  assert.deepEqual(current.reasons, ['相性の主要スコアが未完了（37/39種）'])

  const complete = assessCompatibilityCutoverReadiness(compatibility, REQUIRED_COMPATIBILITY_SCORE_KEYS)
  assert.equal(complete.ready, true)
  assert.deepEqual(complete.reasons, [])
})

test('全原典と全スコアの根拠が揃った場合だけ切替可能にする', () => {
  const rules: TraitScoreRule[] = REQUIRED_TRAIT_SCORE_KEYS.map(score => ({
    score, match: { signal: ['communication'] }, weight: 0.5, source: '性格§1',
  }))
  const readiness = assessDeterministicCutoverReadiness(sections(58), sections(53), rules)
  assert.equal(readiness.ready, true)
  assert.deepEqual(readiness.reasons, [])
  assert.equal(readiness.coveredScores, 70)
})
