import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { assessDeterministicCutoverReadiness } from './deterministicCutoverReadiness.js'
import { ALL_TRAIT_SCORE_KEYS, TRAIT_SCORE_RULES, type TraitScoreRule } from './traitScores.js'

const sections = (count: number) => Array.from({ length: count }, (_, index) => `# ${index + 1}. source`).join('\n\n')

test('現在の根拠資料不足を決定論の本番切替可能と誤判定しない', () => {
  const personality = readFileSync(new URL('./rules/PERSONALITY_RULES.md', import.meta.url), 'utf8')
  const readiness = assessDeterministicCutoverReadiness(personality, '', TRAIT_SCORE_RULES)
  assert.equal(readiness.ready, false)
  assert.equal(readiness.personalitySections, 4)
  assert.equal(readiness.eventSections, 0)
  assert.equal(readiness.coveredScores, 4)
  assert.ok(readiness.reasons.some(reason => reason.includes('4/58節')))
  assert.ok(readiness.reasons.some(reason => reason.includes('0/53節')))
  assert.ok(readiness.reasons.some(reason => reason.includes('4/71種')))
})

test('全原典と全スコアの根拠が揃った場合だけ切替可能にする', () => {
  const rules: TraitScoreRule[] = ALL_TRAIT_SCORE_KEYS.map(score => ({
    score, match: { signal: ['communication'] }, weight: 0.5, source: '性格§1',
  }))
  const readiness = assessDeterministicCutoverReadiness(sections(58), sections(53), rules)
  assert.equal(readiness.ready, true)
  assert.deepEqual(readiness.reasons, [])
  assert.equal(readiness.coveredScores, 71)
})
