import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { assessDeterministicCutoverReadiness } from './deterministicCutoverReadiness.js'
import { auditRuleSourceDocument } from './traitScoreRuleValidation.js'
import { REQUIRED_TRAIT_SCORE_KEYS, TRAIT_SCORE_RULES, type TraitScoreRule } from './traitScores.js'

const sections = (count: number) => Array.from({ length: count }, (_, index) => `# ${index + 1}. source`).join('\n\n')

test('原典が揃っても根拠付きスコア不足を決定論の本番切替可能と誤判定しない', () => {
  const personality = readFileSync(new URL('./rules/PERSONALITY_RULES.md', import.meta.url), 'utf8')
  const events = readFileSync(new URL('./rules/EVENT_RULES.md', import.meta.url), 'utf8')
  const readiness = assessDeterministicCutoverReadiness(personality, events, TRAIT_SCORE_RULES)
  assert.equal(readiness.ready, false)
  assert.equal(readiness.personalitySections, 58)
  assert.equal(readiness.eventSections, 53)
  assert.equal(readiness.coveredScores, 4)
  assert.ok(readiness.reasons.some(reason => reason.includes('4/70種')))
})

test('相性原典は全58節に欠番・重複がない', () => {
  const compatibility = readFileSync(new URL('./rules/COMPATIBILITY_RULES.md', import.meta.url), 'utf8')
  const audit = auditRuleSourceDocument(compatibility, 58)
  assert.equal(audit.complete, true)
  assert.deepEqual(audit.missingSections, [])
  assert.deepEqual(audit.duplicateSections, [])
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
