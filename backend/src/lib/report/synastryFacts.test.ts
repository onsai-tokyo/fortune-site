import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSynastryFacts, computeCompatibilityProfile, computeMutualUnderstanding, computeRelationScores } from './synastryFacts.js'

const self = { shichuDay: '壬午', lifePathNumber: 1, sukuyo: '心', astrology: { western: { planets: { 月: { sign: '蟹座', degree: 10 }, 金星: { sign: '牡羊座', degree: 5 } } } } }
const partner = { shichuDay: '乙亥', lifePathNumber: 5, sukuyo: '婁', astrology: { western: { planets: { 月: { sign: '蠍座', degree: 11 }, 火星: { sign: '天秤座', degree: 6 } } } } }

test('PR-4 Synastry Factは複数系統を統合し再現可能', () => {
  const first = buildSynastryFacts(self, partner)
  assert.deepEqual(first, buildSynastryFacts(self, partner))
  assert.ok(new Set(first.map(fact => fact.kind)).size >= 3)
  assert.ok(first.some(fact => fact.axis === 'attraction'))
  const scores = computeRelationScores(first)
  assert.equal(scores.length, 11)
  assert.ok(scores.every(score => score.value >= 0 && score.value <= 1))
})

test('正式な宿関係表がない状態で異なる宿を修復力へ推測しない', () => {
  const different = buildSynastryFacts({ sukuyo: '心宿' }, { sukuyo: '婁宿' })
  assert.equal(different.some(fact => fact.kind === 'sukuyo'), false)
  assert.equal(different.some(fact => fact.signal === 'different-recovery'), false)
  const same = buildSynastryFacts({ sukuyo: '心宿' }, { sukuyo: '心' })
  assert.equal(same.filter(fact => fact.kind === 'sukuyo').length, 1)
  assert.equal(same.find(fact => fact.kind === 'sukuyo')?.signal, 'same-mansion')
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
  const conversationalDepth = profile.find(score => score.key === 'conversational_depth')
  assert.ok(conversationalDepth)
  assert.ok(conversationalDepth.contributingFacts.length > 0)
  assert.ok(conversationalDepth.contributingFacts.every(id => /月|冥王星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.notDeepEqual(conversationalDepth.contributingFacts, profile[0].contributingFacts)
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

test('相性§52は相互理解を認知・感情・深層の3成分で保持する', () => {
  const left = { astrology: { western: { planets: [
    { name: '水星', longitude: 10 }, { name: '月', longitude: 40 }, { name: '冥王星', longitude: 70 },
  ] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Mercury', longitude: 10 }, { name: 'Moon', longitude: 12 }, { name: 'Pluto', longitude: 10 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const unknown = computeMutualUnderstanding(facts)
  const known = computeMutualUnderstanding(facts, { self: true, partner: true })
  assert.deepEqual(Object.keys(unknown.components), ['cognitive', 'emotional', 'deep'])
  assert.ok(unknown.components.cognitive.contributingFacts.length > 0)
  assert.ok(unknown.components.emotional.contributingFacts.length > 0)
  assert.ok(unknown.components.deep.contributingFacts.length > 0)
  assert.equal(unknown.components.cognitive.confidence, known.components.cognitive.confidence)
  assert.ok(unknown.components.emotional.confidence < known.components.emotional.confidence)
  assert.ok(unknown.components.deep.confidence < known.components.deep.confidence)
  assert.notDeepEqual(unknown.components.cognitive.contributingFacts, unknown.components.deep.contributingFacts)
})

test('相性§9は掛け合いの楽しさを会話の流れから分離する', () => {
  const left = { astrology: { western: { planets: [{ name: '水星', longitude: 10 }] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Mars', longitude: 70 }, { name: 'Jupiter', longitude: 130 }, { name: 'Uranus', longitude: 190 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const profiles = computeCompatibilityProfile(facts)
  const humor = profiles.find(score => score.key === 'humor_compatibility')!
  const flow = profiles.find(score => score.key === 'conversational_flow')!
  assert.equal(humor.contributingFacts.length, 3)
  assert.ok(humor.confidence > 0)
  assert.equal(flow.contributingFacts.length, 2)
  assert.notDeepEqual(humor.contributingFacts, flow.contributingFacts)
  assert.ok(humor.contributingFacts.every(id => /木星|火星|天王星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
})

test('相性§9・§21は友達的な結びつきを水星系Factの重複なしで算出する', () => {
  const left = { astrology: { western: { planets: [{ name: '水星', longitude: 10 }] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Mercury', longitude: 10 }, { name: 'Moon', longitude: 70 }, { name: 'Venus', longitude: 130 },
    { name: 'Jupiter', longitude: 190 }, { name: 'Mars', longitude: 100 }, { name: 'Uranus', longitude: 250 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const unknown = computeCompatibilityProfile(facts).find(score => score.key === 'friendship_compatibility')!
  const known = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'friendship_compatibility')!
  assert.ok(unknown.contributingFacts.length >= 5)
  assert.equal(new Set(unknown.contributingFacts).size, unknown.contributingFacts.length)
  assert.ok(unknown.contributingFacts.every(id => /水星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.equal(unknown.value, known.value)
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

test('相性§7は許す力を修復手段全体から分離する', () => {
  const left = { astrology: { western: { planets: [{ name: '木星', longitude: 10 }, { name: '月', longitude: 70 }] } } }
  const right = { astrology: { western: { planets: [{ name: 'Venus', longitude: 10 }, { name: 'Mercury', longitude: 130 }] } } }
  const facts = buildSynastryFacts(left, right)
  const profiles = computeCompatibilityProfile(facts)
  const repair = profiles.find(score => score.key === 'repair_capacity')!
  const forgiveness = profiles.find(score => score.key === 'forgiveness_capacity')!
  assert.ok(repair.contributingFacts.length > forgiveness.contributingFacts.length)
  assert.ok(forgiveness.contributingFacts.length > 0)
  assert.ok(forgiveness.contributingFacts.every(id => /木星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(repair.contributingFacts.some(id => !/木星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
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

test('衝突強度は太陽・水星・火星のハードな接触だけを部分算出する', () => {
  const left = { astrology: { western: { planets: [{ name: '太陽', longitude: 0 }, { name: '水星', longitude: 180 }] } } }
  const right = { astrology: { western: { planets: [{ name: 'Mars', longitude: 90 }, { name: 'Venus', longitude: 0 }] } } }
  const facts = buildSynastryFacts(left, right)
  const conflict = computeCompatibilityProfile(facts).find(score => score.key === 'conflict_intensity')!
  assert.ok(conflict.contributingFacts.length >= 2)
  assert.ok(conflict.value > 0.5)
  assert.ok(conflict.confidence > 0 && conflict.confidence <= 0.7)
  assert.ok(conflict.contributingFacts.every(id => /火星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(conflict.contributingFacts.every(id => /square|opposition/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
})

test('相性§45は時刻不要の木星接触だけで共同成長を部分算出する', () => {
  const left = { astrology: { western: { planets: [{ name: '木星', longitude: 0 }] } } }
  const right = { astrology: { western: { planets: [{ name: 'Sun', longitude: 0 }, { name: 'Mercury', longitude: 120 }, { name: 'Venus', longitude: 0 }] } } }
  const facts = buildSynastryFacts(left, right)
  const growth = computeCompatibilityProfile(facts).find(score => score.key === 'growth_compatibility')!
  assert.equal(growth.contributingFacts.length, 2)
  assert.ok(growth.value > 0.5)
  assert.ok(growth.confidence > 0 && growth.confidence <= 0.7)
  assert.ok(growth.contributingFacts.every(id => /木星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(growth.contributingFacts.every(id => !/金星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
})

test('相性§14・§54は太陽と金星だけで価値観一致を部分算出する', () => {
  const left = { astrology: { western: { planets: [{ name: '太陽', longitude: 0 }, { name: '金星', longitude: 120 }, { name: '水星', longitude: 30 }] } } }
  const right = { astrology: { western: { planets: [{ name: 'Sun', longitude: 0 }, { name: 'Venus', longitude: 120 }, { name: 'Mercury', longitude: 30 }] } } }
  const facts = buildSynastryFacts(left, right)
  const values = computeCompatibilityProfile(facts).find(score => score.key === 'value_alignment')!
  assert.ok(values.contributingFacts.length >= 2)
  assert.ok(values.value > 0.5)
  assert.ok(values.confidence > 0 && values.confidence <= 0.65)
  assert.ok(values.contributingFacts.every(id => /太陽|金星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(values.contributingFacts.every(id => !/水星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
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
