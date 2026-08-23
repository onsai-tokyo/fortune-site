import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSynastryFacts, computeRelationScores } from './synastryFacts.js'

const self = { shichuDay: '壬午', lifePathNumber: 1, sukuyo: '心', astrology: { western: { planets: { 月: { sign: '蟹座', degree: 10 }, 金星: { sign: '牡羊座', degree: 5 } } } } }
const partner = { shichuDay: '乙亥', lifePathNumber: 5, sukuyo: '婁', astrology: { western: { planets: { 月: { sign: '蠍座', degree: 11 }, 火星: { sign: '天秤座', degree: 6 } } } } }

test('PR-4 Synastry Factは複数系統を統合し再現可能', () => {
  const first = buildSynastryFacts(self, partner)
  assert.deepEqual(first, buildSynastryFacts(self, partner))
  assert.ok(new Set(first.map(fact => fact.kind)).size >= 4)
  assert.ok(first.some(fact => fact.axis === 'attraction'))
  const scores = computeRelationScores(first)
  assert.equal(scores.length, 11)
  assert.ok(scores.every(score => score.value >= 0 && score.value <= 1))
})
