import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSynastryFacts, computeCompatibilityProfile, computeRelationScores } from './synastryFacts.js'

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

test('相性§44は会話の流れと心の深さを別スコアにする', () => {
  const left = { astrology: { western: { planets: [
    { name: '水星', longitude: 10 }, { name: '月', longitude: 40 },
  ] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Mercury', longitude: 10 }, { name: 'Moon', longitude: 12 }, { name: 'Jupiter', longitude: 70 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  assert.ok(facts.some(fact => fact.signal.startsWith('水星-水星-') && fact.axis === 'communication'))
  assert.ok(facts.some(fact => /^(月-水星|水星-月)-/.test(fact.signal) && fact.axis === 'depth'))
  const profile = computeCompatibilityProfile(facts)
  assert.equal(profile[0].key, 'conversational_flow')
  assert.ok(profile[0].confidence > 0)
  assert.ok(profile[0].contributingFacts.every(id => facts.find(fact => fact.id === id)?.axis === 'communication'))
  const emotional = profile.find(score => score.key === 'emotional_intimacy')
  assert.ok(emotional)
  assert.ok(emotional.contributingFacts.every(id => facts.find(fact => fact.id === id)?.axis === 'depth'))
  assert.ok(emotional.contributingFacts.every(id => !facts.find(fact => fact.id === id)?.signal.includes('冥王星')))
})

test('相性§43は出生時刻なしでも感情親密度を返すが確信度を抑える', () => {
  const left = { astrology: { western: { planets: [{ name: '月', longitude: 10 }, { name: '太陽', longitude: 40 }] } } }
  const right = { astrology: { western: { planets: [{ name: 'Moon', longitude: 10 }, { name: 'Venus', longitude: 40 }] } } }
  const facts = buildSynastryFacts(left, right)
  const unknown = computeCompatibilityProfile(facts).find(score => score.key === 'emotional_intimacy')!
  const known = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'emotional_intimacy')!
  assert.ok(unknown.contributingFacts.length > 0)
  assert.equal(unknown.value, known.value)
  assert.ok(unknown.confidence > 0)
  assert.ok(unknown.confidence < known.confidence)
})

test('相性§7は衝突量ではなく仲直りへ戻る力を独立算出する', () => {
  const left = { astrology: { western: { planets: [{ name: '木星', longitude: 10 }, { name: '火星', longitude: 90 }] } } }
  const right = { astrology: { western: { planets: [{ name: 'Moon', longitude: 10 }, { name: 'Venus', longitude: 130 }] } } }
  const facts = buildSynastryFacts(left, right)
  const repair = computeCompatibilityProfile(facts).find(score => score.key === 'repair_capacity')!
  assert.ok(repair.contributingFacts.length > 0)
  assert.ok(repair.confidence > 0)
  assert.ok(repair.contributingFacts.every(id => {
    const signal = facts.find(fact => fact.id === id)?.signal ?? ''
    return /木星|月|金星|水星/.test(signal) && !signal.includes('火星')
  }))
})

test('感情の安心感は会話の流れと修復力から独立して算出する', () => {
  const left = { astrology: { western: { planets: [{ name: '月', longitude: 10 }, { name: '水星', longitude: 90 }] } } }
  const right = { astrology: { western: { planets: [{ name: 'Sun', longitude: 10 }, { name: 'Mercury', longitude: 90 }] } } }
  const facts = buildSynastryFacts(left, right)
  const profiles = computeCompatibilityProfile(facts, { self: true, partner: true })
  const safety = profiles.find(score => score.key === 'emotional_safety')!
  const conversation = profiles.find(score => score.key === 'conversational_flow')!
  assert.ok(safety.contributingFacts.length > 0)
  assert.ok(conversation.contributingFacts.length > 0)
  assert.notDeepEqual(safety.contributingFacts, conversation.contributingFacts)
  assert.ok(safety.contributingFacts.every(id => /月/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
})

test('本番calcAstrologyのplanets配列から天体間Factを生成する', () => {
  const withArray = {
    ...self,
    astrology: { western: { planets: [
      { name: '月', longitude: 100 },
      { name: '金星', longitude: 5 },
    ] } },
  }
  const partnerWithArray = {
    ...partner,
    astrology: { western: { planets: [
      { name: '月', longitude: 220 },
      { name: '火星', longitude: 185 },
    ] } },
  }
  const facts = buildSynastryFacts(withArray, partnerWithArray)
  assert.ok(facts.some(fact => fact.kind === 'cross-aspect'))
  assert.ok(facts.some(fact => fact.axis === 'attraction'))
})
