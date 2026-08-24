import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSynastryFacts, computeAmbitionAlignmentProfile, computeCompatibilityProfile, computeEgoCompetitionProfile, computeFateCompanionFeelingProfile, computeLongTermBindingProfile, computeMysteryDistanceProfile, computeMutualUnderstanding, computePartnershipTeamFeelingProfile, computePowerBalanceProfile, computePrivateAffectionProfile, computeRelationScores, computeRelationshipBoredomRiskProfile, computeRelationshipStimulationNeedProfile, computeSocialDisplayAffectionProfile, computeTransparencyProfile, computeTrustStabilityProfile } from './synastryFacts.js'

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

test('恋愛的な引力は金星と太陽・月・金星から部分算出し身体的引力と混ぜない', () => {
  const left = { astrology: { western: { planets: [
    { name: '金星', longitude: 10 }, { name: '火星', longitude: 40 },
  ] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Sun', longitude: 10 }, { name: 'Moon', longitude: 130 }, { name: 'Mars', longitude: 40 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const romantic = computeCompatibilityProfile(facts).find(score => score.key === 'romantic_attraction')!
  assert.ok(romantic.confidence > 0)
  assert.ok(romantic.contributingFacts.every(id => /金星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(romantic.contributingFacts.every(id => !/金星-火星|火星-火星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
})

test('恋愛的な個人天体接触がなければ引力を一般論で推測しない', () => {
  const facts = buildSynastryFacts(
    { astrology: { western: { planets: [{ name: '水星', longitude: 10 }] } } },
    { astrology: { western: { planets: [{ name: 'Mercury', longitude: 10 }] } } },
  )
  const romantic = computeCompatibilityProfile(facts).find(score => score.key === 'romantic_attraction')!
  assert.equal(romantic.value, 0.5)
  assert.equal(romantic.confidence, 0)
  assert.deepEqual(romantic.contributingFacts, [])
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

test('相性§25は暮らしの相性を月・金星から算出し感情親密度と分離する', () => {
  const left = { astrology: { western: { planets: [{ name: '月', longitude: 10 }, { name: '金星', longitude: 70 }] } } }
  const right = { astrology: { western: { planets: [{ name: 'Moon', longitude: 10 }, { name: 'Venus', longitude: 70 }] } } }
  const facts = buildSynastryFacts(left, right)
  const unknown = computeCompatibilityProfile(facts).find(score => score.key === 'domestic_compatibility')!
  const known = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'domestic_compatibility')!
  const emotional = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'emotional_intimacy')!
  assert.ok(unknown.contributingFacts.length >= 3)
  assert.equal(new Set(unknown.contributingFacts).size, unknown.contributingFacts.length)
  assert.ok(unknown.contributingFacts.every(id => /月|金星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(unknown.contributingFacts.some(id => /金星-金星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.notDeepEqual(known.contributingFacts, emotional.contributingFacts)
  assert.equal(unknown.value, known.value)
  assert.ok(unknown.confidence < known.confidence)
})

test('相性§3・§26は新体験の相性を木星・天王星と個人天体の接触から算出する', () => {
  const left = { astrology: { western: { planets: [{ name: '木星', longitude: 10 }, { name: '天王星', longitude: 70 }] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Sun', longitude: 10 }, { name: 'Moon', longitude: 130 }, { name: 'Mercury', longitude: 70 },
    { name: 'Venus', longitude: 190 }, { name: 'Mars', longitude: 250 }, { name: 'Jupiter', longitude: 10 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const unknown = computeCompatibilityProfile(facts).find(score => score.key === 'novelty_compatibility')!
  const known = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'novelty_compatibility')!
  assert.ok(unknown.contributingFacts.length >= 5)
  assert.equal(new Set(unknown.contributingFacts).size, unknown.contributingFacts.length)
  assert.ok(unknown.contributingFacts.every(id => /木星|天王星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(unknown.contributingFacts.every(id => !/木星-木星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.equal(unknown.value, known.value)
  assert.ok(unknown.confidence < known.confidence)
})

test('相性§4は共同プロジェクトの推進力を火星・木星・土星から算出する', () => {
  const left = { astrology: { western: { planets: [
    { name: '火星', longitude: 10 }, { name: '木星', longitude: 70 }, { name: '土星', longitude: 130 },
  ] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Mars', longitude: 10 }, { name: 'Jupiter', longitude: 70 }, { name: 'Saturn', longitude: 130 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const project = computeCompatibilityProfile(facts).find(score => score.key === 'shared_project_compatibility')!
  const novelty = computeCompatibilityProfile(facts).find(score => score.key === 'novelty_compatibility')!
  assert.ok(project.contributingFacts.length >= 6)
  assert.equal(new Set(project.contributingFacts).size, project.contributingFacts.length)
  assert.ok(project.contributingFacts.every(id => /火星|木星|土星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(project.contributingFacts.some(id => /土星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.notDeepEqual(project.contributingFacts, novelty.contributingFacts)
  assert.ok(project.confidence > 0)
})

test('相性§26は旅行や外出の行動相性を広い新体験スコアから分離する', () => {
  const left = { astrology: { western: { planets: [{ name: '木星', longitude: 10 }, { name: '天王星', longitude: 70 }] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Sun', longitude: 10 }, { name: 'Mars', longitude: 130 }, { name: 'Mercury', longitude: 70 }, { name: 'Venus', longitude: 190 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const adventure = computeCompatibilityProfile(facts).find(score => score.key === 'adventure_compatibility')!
  const novelty = computeCompatibilityProfile(facts).find(score => score.key === 'novelty_compatibility')!
  assert.ok(adventure.contributingFacts.length >= 3)
  assert.equal(new Set(adventure.contributingFacts).size, adventure.contributingFacts.length)
  assert.ok(adventure.contributingFacts.every(id => /太陽|火星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(novelty.contributingFacts.length > adventure.contributingFacts.length)
  assert.notDeepEqual(adventure.contributingFacts, novelty.contributingFacts)
  assert.ok(adventure.confidence > 0)
})

test('相性§27・§33は相互尊敬を職業情報の推測なしで部分算出する', () => {
  const left = { astrology: { western: { planets: [{ name: '木星', longitude: 10 }, { name: '土星', longitude: 70 }] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Sun', longitude: 10 }, { name: 'Mars', longitude: 130 }, { name: 'Mercury', longitude: 70 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const admiration = computeCompatibilityProfile(facts).find(score => score.key === 'admiration_mutual')!
  assert.ok(admiration.contributingFacts.length >= 3)
  assert.equal(new Set(admiration.contributingFacts).size, admiration.contributingFacts.length)
  assert.ok(admiration.contributingFacts.every(id => /太陽|火星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(admiration.contributingFacts.every(id => /木星|土星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(admiration.confidence > 0)
  assert.ok(admiration.confidence <= 0.65)
})

test('相性§6はプライド衝突を火星系のハード接触だけから算出する', () => {
  const left = { astrology: { western: { planets: [
    { name: '太陽', longitude: 10 }, { name: '火星', longitude: 70 }, { name: '月', longitude: 130 },
  ] } } }
  const right = { astrology: { western: { planets: [
    { name: 'Sun', longitude: 100 }, { name: 'Mars', longitude: 160 }, { name: 'Moon', longitude: 310 }, { name: 'Mercury', longitude: 160 },
  ] } } }
  const facts = buildSynastryFacts(left, right)
  const unknown = computeCompatibilityProfile(facts).find(score => score.key === 'pride_collision')!
  const known = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'pride_collision')!
  const conflict = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'conflict_intensity')!
  assert.ok(unknown.contributingFacts.length >= 3)
  assert.equal(new Set(unknown.contributingFacts).size, unknown.contributingFacts.length)
  assert.ok(unknown.contributingFacts.every(id => /square|opposition/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.ok(unknown.contributingFacts.every(id => !/水星/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.notDeepEqual(known.contributingFacts, conflict.contributingFacts)
  assert.equal(unknown.value, known.value)
  assert.ok(unknown.confidence < known.confidence)
})

test('相性§4・§5は双方の個人Traitの積から競争性を独立算出する', () => {
  const trait = (value: number, confidence: number, fact: string) => ({ value, confidence, contributingFacts: [fact] })
  const high = computeEgoCompetitionProfile(
    { pride_sensitivity: trait(0.9, 0.8, 'self-pride'), status_attraction: trait(0.8, 0.7, 'self-status') },
    { pride_sensitivity: trait(0.85, 0.75, 'partner-pride'), status_attraction: trait(0.9, 0.65, 'partner-status') },
  )
  const low = computeEgoCompetitionProfile(
    { pride_sensitivity: trait(0.2, 0.8, 'self-pride'), status_attraction: trait(0.3, 0.7, 'self-status') },
    { pride_sensitivity: trait(0.25, 0.75, 'partner-pride'), status_attraction: trait(0.2, 0.65, 'partner-status') },
  )
  assert.equal(high.key, 'ego_competition')
  assert.ok(high.value > 0.7)
  assert.ok(low.value < 0.1)
  assert.equal(high.confidence, 0.65)
  assert.deepEqual(high.contributingFacts.sort(), ['partner-pride', 'partner-status', 'self-pride', 'self-status'])
})

test('相性§5は根拠のない個人Traitから競争性を推測しない', () => {
  const score = { value: 0.9, confidence: 0, contributingFacts: [] }
  const result = computeEgoCompetitionProfile(
    { pride_sensitivity: score, status_attraction: score },
    { pride_sensitivity: score, status_attraction: score },
  )
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.contributingFacts, [])
})

test('相性§6・§42は衝突の回数と強さを別スコアとして保持する', () => {
  const fact = (id: string, signal: string, strength: number) => ({
    id, kind: 'cross-aspect' as const, selfFactId: 'planet:太陽', partnerFactId: 'planet:火星',
    axis: 'conflict' as const, signal, polarity: -1 as const, strength,
    requiresSelfBirthTime: false, requiresPartnerBirthTime: false, detail: signal,
  })
  const close = [fact('close-1', '太陽-火星-square', 0.95), fact('close-2', '火星-火星-opposition', 0.9)]
  const wide = [fact('wide-1', '太陽-火星-square', 0.25), fact('wide-2', '火星-火星-opposition', 0.2)]
  const closeScores = computeCompatibilityProfile(close)
  const wideScores = computeCompatibilityProfile(wide)
  const closeFrequency = closeScores.find(score => score.key === 'conflict_frequency')!
  const wideFrequency = wideScores.find(score => score.key === 'conflict_frequency')!
  const closeIntensity = closeScores.find(score => score.key === 'conflict_intensity')!
  const wideIntensity = wideScores.find(score => score.key === 'conflict_intensity')!
  assert.equal(closeFrequency.value, wideFrequency.value)
  assert.equal(closeFrequency.confidence, wideFrequency.confidence)
  assert.ok(closeIntensity.value > wideIntensity.value)
})

test('相性§42は冥王星と個人天体のハード接触を頻度へ含め強度の火星集合には混ぜない', () => {
  const facts = buildSynastryFacts(
    { astrology: { western: { planets: [{ name: '冥王星', longitude: 10 }] } } },
    { astrology: { western: { planets: [{ name: 'Venus', longitude: 100 }] } } },
  )
  const profile = computeCompatibilityProfile(facts)
  const frequency = profile.find(score => score.key === 'conflict_frequency')!
  const intensity = profile.find(score => score.key === 'conflict_intensity')!
  assert.equal(frequency.contributingFacts.length, 1)
  assert.equal(intensity.contributingFacts.length, 0)
  assert.ok(frequency.confidence > 0)
})

test('相性§4・§5は双方の達成志向から目標の熱量一致を独立算出する', () => {
  const trait = (value: number, confidence: number, fact: string) => ({ value, confidence, contributingFacts: [fact] })
  const high = computeAmbitionAlignmentProfile(
    { career_absorption: trait(0.9, 0.8, 'self-career'), recognition_motivation: trait(0.8, 0.7, 'self-recognition') },
    { career_absorption: trait(0.85, 0.75, 'partner-career'), recognition_motivation: trait(0.9, 0.65, 'partner-recognition') },
  )
  const mismatch = computeAmbitionAlignmentProfile(
    { career_absorption: trait(0.9, 0.8, 'self-career'), recognition_motivation: trait(0.8, 0.7, 'self-recognition') },
    { career_absorption: trait(0.15, 0.75, 'partner-career'), recognition_motivation: trait(0.1, 0.65, 'partner-recognition') },
  )
  assert.equal(high.key, 'ambition_alignment')
  assert.ok(high.value > 0.7)
  assert.ok(mismatch.value < 0.15)
  assert.equal(high.confidence, 0.65)
})

test('目標志向と共同プロジェクト相性は互いを打ち消さず同時に保持できる', () => {
  const trait = { value: 0.9, confidence: 0.8, contributingFacts: ['trait'] }
  const ambition = computeAmbitionAlignmentProfile(
    { career_absorption: trait, recognition_motivation: trait },
    { career_absorption: trait, recognition_motivation: trait },
  )
  const facts = buildSynastryFacts(
    { astrology: { western: { planets: [{ name: '火星', longitude: 10 }, { name: '木星', longitude: 70 }] } } },
    { astrology: { western: { planets: [{ name: 'Mars', longitude: 10 }, { name: 'Saturn', longitude: 130 }] } } },
  )
  const project = computeCompatibilityProfile(facts).find(score => score.key === 'shared_project_compatibility')!
  assert.ok(ambition.value > 0.8)
  assert.ok(project.confidence > 0)
})

test('相性§14は月を中心に生活リズムを算出し価値観や家事適性と分離する', () => {
  const facts = buildSynastryFacts(
    { astrology: { western: { planets: [{ name: '月', longitude: 10 }, { name: '金星', longitude: 70 }] } } },
    { astrology: { western: { planets: [{ name: 'Moon', longitude: 130 }, { name: 'Sun', longitude: 10 }, { name: 'Venus', longitude: 70 }] } } },
  )
  const unknown = computeCompatibilityProfile(facts).find(score => score.key === 'lifestyle_alignment')!
  const known = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'lifestyle_alignment')!
  const values = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'value_alignment')!
  const domestic = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'domestic_compatibility')!
  assert.ok(unknown.contributingFacts.length >= 2)
  assert.ok(unknown.contributingFacts.every(id => /月/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.notDeepEqual(known.contributingFacts, values.contributingFacts)
  assert.notDeepEqual(known.contributingFacts, domestic.contributingFacts)
  assert.equal(unknown.value, known.value)
  assert.ok(unknown.confidence < known.confidence)
})

test('相性§2は中核天体の調和が複数ある時だけ共有自己感を部分算出する', () => {
  const facts = buildSynastryFacts(
    { astrology: { western: { planets: [{ name: '太陽', longitude: 10 }, { name: '月', longitude: 70 }] } } },
    { astrology: { western: { planets: [{ name: 'Sun', longitude: 10 }, { name: 'Moon', longitude: 130 }, { name: 'Venus', longitude: 70 }] } } },
  )
  const unknown = computeCompatibilityProfile(facts).find(score => score.key === 'shared_identity')!
  const known = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'shared_identity')!
  assert.ok(unknown.contributingFacts.length >= 2)
  assert.ok(unknown.contributingFacts.every(id => /conjunction|sextile|trine/.test(facts.find(fact => fact.id === id)?.signal ?? '')))
  assert.equal(new Set(unknown.contributingFacts).size, unknown.contributingFacts.length)
  assert.equal(unknown.value, known.value)
  assert.ok(unknown.confidence < known.confidence)
  assert.ok(known.confidence <= 0.65)
})

test('相性§2はハード接触だけで運命共同体感を捏造しない', () => {
  const facts = buildSynastryFacts(
    { astrology: { western: { planets: [{ name: '太陽', longitude: 10 }, { name: '月', longitude: 10 }] } } },
    { astrology: { western: { planets: [{ name: 'Sun', longitude: 100 }, { name: 'Moon', longitude: 190 }] } } },
  )
  const shared = computeCompatibilityProfile(facts, { self: true, partner: true }).find(score => score.key === 'shared_identity')!
  assert.equal(shared.confidence, 0)
  assert.deepEqual(shared.contributingFacts, [])
})

test('相性§4は共同作業と目標志向からチーム感を派生し競争性で相殺しない', () => {
  const score = (key: 'shared_project_compatibility' | 'ambition_alignment' | 'ego_competition', value: number, confidence: number, fact: string) => ({
    key, value, confidence, contributingFacts: [fact],
  })
  const profiles = [
    score('shared_project_compatibility', 0.8, 0.7, 'project'),
    score('ambition_alignment', 0.9, 0.6, 'ambition'),
    score('ego_competition', 0.95, 0.8, 'competition'),
  ]
  const team = computePartnershipTeamFeelingProfile(profiles)
  assert.equal(team.key, 'partnership_team_feeling')
  assert.equal(team.value, 0.85)
  assert.equal(team.confidence, 0.6)
  assert.deepEqual(team.contributingFacts.sort(), ['ambition', 'project'])
  assert.ok(!team.contributingFacts.includes('competition'))
})

test('相性§19は個人傾向の差が小さいほど力関係の拮抗度を高くする', () => {
  const trait = (value: number, fact: string) => ({ value, confidence: 0.8, contributingFacts: [fact] })
  const close = computePowerBalanceProfile(
    { pride_sensitivity: trait(0.8, 'self-pride'), group_coordination: trait(0.7, 'self-lead') },
    { pride_sensitivity: trait(0.75, 'partner-pride'), group_coordination: trait(0.65, 'partner-lead') },
  )
  const distant = computePowerBalanceProfile(
    { pride_sensitivity: trait(0.9, 'self-pride'), group_coordination: trait(0.9, 'self-lead') },
    { pride_sensitivity: trait(0.1, 'partner-pride'), group_coordination: trait(0.2, 'partner-lead') },
  )
  assert.equal(close.key, 'power_balance')
  assert.ok(close.value > distant.value)
  assert.equal(close.confidence, 0.8)
  assert.equal(close.contributingFacts.length, 4)
})

test('相性§19は個人傾向の根拠が欠ける場合に力関係を推測しない', () => {
  const known = { value: 0.7, confidence: 0.8, contributingFacts: ['known'] }
  const unknown = { value: 0.5, confidence: 0, contributingFacts: [] }
  const result = computePowerBalanceProfile(
    { pride_sensitivity: known, group_coordination: known },
    { pride_sensitivity: known, group_coordination: unknown },
  )
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.contributingFacts, [])
})

test('相性§11・§30は透明性を自分から相手と相手から自分の2方向で保持する', () => {
  const trait = (value: number, fact: string) => ({ value, confidence: 0.8, contributingFacts: [fact] })
  const result = computeTransparencyProfile(
    { compatibility_transparency: trait(0.8, 'self-open') },
    { compatibility_transparency: trait(0.3, 'partner-open') },
  )
  assert.equal(result.key, 'transparency')
  assert.equal(result.value, 0.55)
  assert.equal(result.confidence, 0.65)
  assert.deepEqual(result.directions, { selfToPartner: 0.8, partnerToSelf: 0.3 })
  assert.deepEqual(result.contributingFacts.sort(), ['partner-open', 'self-open'])
})

test('相性§30は片方向の根拠が欠ける場合に透明性を対称値として推測しない', () => {
  const result = computeTransparencyProfile(
    { compatibility_transparency: { value: 0.8, confidence: 0.8, contributingFacts: ['self'] } },
    { compatibility_transparency: { value: 0.5, confidence: 0, contributingFacts: [] } },
  )
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.equal(result.directions, undefined)
})

test('相性§11・§30は海王星と個人天体の接触を方向別の読み取りにくさへ変換する', () => {
  const facts = [
    { id: 'partner-neptune-self-moon', kind: 'cross-aspect', selfFactId: 'planet:月', partnerFactId: 'planet:海王星', axis: 'depth', signal: '月-海王星-conjunction', polarity: 1, strength: 0.8, requiresSelfBirthTime: false, requiresPartnerBirthTime: false, detail: '月:海王星:conjunction' },
    { id: 'self-neptune-partner-mercury', kind: 'cross-aspect', selfFactId: 'planet:海王星', partnerFactId: 'planet:水星', axis: 'communication', signal: '水星-海王星-square', polarity: -1, strength: 0.3, requiresSelfBirthTime: false, requiresPartnerBirthTime: false, detail: '水星:海王星:square' },
  ] as const
  const result = computeMysteryDistanceProfile(facts, {
    key: 'transparency', value: 0.6, confidence: 0.65, contributingFacts: ['open-self', 'open-partner'],
    directions: { selfToPartner: 0.8, partnerToSelf: 0.4 },
  })
  assert.equal(result.key, 'mystery_distance')
  assert.equal(result.confidence, 0.55)
  assert.ok(result.directions!.selfToPartner > result.directions!.partnerToSelf)
  assert.deepEqual(result.contributingFacts.sort(), ['open-partner', 'open-self', 'partner-neptune-self-moon', 'self-neptune-partner-mercury'])
})

test('海王星接触または方向別透明性がなければ読み取りにくさを推測しない', () => {
  const transparent = { key: 'transparency' as const, value: 0.5, confidence: 0.65, contributingFacts: ['known'], directions: { selfToPartner: 0.5, partnerToSelf: 0.5 } }
  assert.equal(computeMysteryDistanceProfile([], transparent).confidence, 0)
  assert.equal(computeMysteryDistanceProfile([], { ...transparent, confidence: 0, directions: undefined }).confidence, 0)
})

test('相性§29は人前での愛情表現傾向を二方向で保持する', () => {
  const trait = (value: number, fact: string) => ({ value, confidence: 0.8, contributingFacts: [fact] })
  const result = computeSocialDisplayAffectionProfile(
    { social_neutrality: trait(0.8, 'self-neutral'), public_agreeableness: trait(0.6, 'self-public') },
    { social_neutrality: trait(0.2, 'partner-neutral'), public_agreeableness: trait(0.4, 'partner-public') },
  )
  assert.equal(result.key, 'social_display_affection')
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0.65)
  assert.deepEqual(result.directions, { selfToPartner: 0.7, partnerToSelf: 0.3 })
  assert.equal(result.contributingFacts.length, 4)
})

test('相性§29は片方の個人傾向が欠ける場合に人前の愛情表現を推測しない', () => {
  const known = { value: 0.7, confidence: 0.8, contributingFacts: ['known'] }
  const unknown = { value: 0.5, confidence: 0, contributingFacts: [] }
  const result = computeSocialDisplayAffectionProfile(
    { social_neutrality: known, public_agreeableness: known },
    { social_neutrality: known, public_agreeableness: unknown },
  )
  assert.equal(result.confidence, 0)
  assert.equal(result.directions, undefined)
})

test('相性§16・性格§35・§36は生活内の愛情表現を二方向で保持する', () => {
  const trait = (value: number, fact: string) => ({ value, confidence: 0.8, contributingFacts: [fact] })
  const result = computePrivateAffectionProfile(
    { domestic_affection: trait(0.9, 'self-domestic'), practical_generosity: trait(0.7, 'self-practical') },
    { domestic_affection: trait(0.3, 'partner-domestic'), practical_generosity: trait(0.5, 'partner-practical') },
  )
  assert.equal(result.key, 'private_affection')
  assert.equal(result.value, 0.6)
  assert.equal(result.confidence, 0.6)
  assert.deepEqual(result.directions, { selfToPartner: 0.8, partnerToSelf: 0.4 })
  assert.equal(result.contributingFacts.length, 4)
})

test('生活内の愛情表現は片方向の根拠が欠ける場合に対称値を推測しない', () => {
  const known = { value: 0.7, confidence: 0.8, contributingFacts: ['known'] }
  const unknown = { value: 0.5, confidence: 0, contributingFacts: [] }
  const result = computePrivateAffectionProfile(
    { domestic_affection: known, practical_generosity: known },
    { domestic_affection: unknown, practical_generosity: known },
  )
  assert.equal(result.confidence, 0)
  assert.equal(result.directions, undefined)
})

test('相性§4は共同作業か目標志向の片方が根拠不足ならチーム感を推測しない', () => {
  const team = computePartnershipTeamFeelingProfile([
    { key: 'shared_project_compatibility', value: 0.9, confidence: 0.8, contributingFacts: ['project'] },
  ])
  assert.equal(team.value, 0.5)
  assert.equal(team.confidence, 0)
  assert.deepEqual(team.contributingFacts, [])
})

test('相性§2は共有自己感とチーム感の両方から人生の一部として残る感覚を部分算出する', () => {
  const result = computeFateCompanionFeelingProfile([
    { key: 'shared_identity', value: 0.8, confidence: 0.6, contributingFacts: ['identity'] },
    { key: 'partnership_team_feeling', value: 0.9, confidence: 0.65, contributingFacts: ['team'] },
  ])
  assert.equal(result.key, 'fate_companion_feeling')
  assert.equal(result.value, 0.85)
  assert.equal(result.confidence, 0.55)
  assert.deepEqual(result.contributingFacts.sort(), ['identity', 'team'])
})

test('相性§2は共有自己感かチーム感が欠ける場合に運命共同体感を推測しない', () => {
  const result = computeFateCompanionFeelingProfile([
    { key: 'shared_identity', value: 0.9, confidence: 0.6, contributingFacts: ['identity'] },
  ])
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.contributingFacts, [])
})

test('相性§3は新体験・冒険・成長・共同目標・野心の5軸から刺激必要度を部分算出する', () => {
  const keys = ['novelty_compatibility', 'adventure_compatibility', 'growth_compatibility', 'shared_project_compatibility', 'ambition_alignment'] as const
  const result = computeRelationshipStimulationNeedProfile(keys.map((key, index) => ({
    key, value: 0.6 + index * 0.05, confidence: 0.7, contributingFacts: [`fact-${index}`],
  })))
  assert.equal(result.key, 'relationship_stimulation_need')
  assert.equal(result.value, 0.7)
  assert.equal(result.confidence, 0.55)
  assert.equal(result.contributingFacts.length, 5)
})

test('相性§3は構成軸が一つでも欠ける場合に刺激必要度を推測しない', () => {
  const result = computeRelationshipStimulationNeedProfile([
    { key: 'novelty_compatibility', value: 0.9, confidence: 0.7, contributingFacts: ['novelty'] },
  ])
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.contributingFacts, [])
})

test('相性§3・§26は双方の新奇性傾向と刺激必要度からマンネリ化リスクを派生する', () => {
  const novelty = (value: number, fact: string) => ({ value, confidence: 0.8, contributingFacts: [fact] })
  const result = computeRelationshipBoredomRiskProfile([
    { key: 'relationship_stimulation_need', value: 0.8, confidence: 0.55, contributingFacts: ['stimulation'] },
  ], { novelty_attraction: novelty(0.9, 'self') }, { novelty_attraction: novelty(0.8, 'partner') })
  assert.equal(result.key, 'relationship_boredom_risk')
  assert.equal(result.value, 0.76)
  assert.equal(result.confidence, 0.55)
  assert.deepEqual(result.contributingFacts.sort(), ['partner', 'self', 'stimulation'])
})

test('相性§26は個人傾向か刺激必要度の根拠が欠ける場合にマンネリ化を推測しない', () => {
  const known = { value: 0.8, confidence: 0.8, contributingFacts: ['known'] }
  const unknown = { value: 0.5, confidence: 0, contributingFacts: [] }
  const result = computeRelationshipBoredomRiskProfile([], { novelty_attraction: known }, { novelty_attraction: unknown })
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.contributingFacts, [])
})

test('相性§31・§34は双方の信頼維持傾向と安心・修復から基礎信頼を算出する', () => {
  const reliability = (value: number, fact: string) => ({ value, confidence: 0.8, contributingFacts: [fact] })
  const result = computeTrustStabilityProfile([
    { key: 'emotional_safety', value: 0.8, confidence: 0.7, contributingFacts: ['safety'] },
    { key: 'repair_capacity', value: 0.7, confidence: 0.65, contributingFacts: ['repair'] },
  ], { compatibility_reliability: reliability(0.9, 'self') }, { compatibility_reliability: reliability(0.8, 'partner') })
  assert.equal(result.key, 'trust_stability')
  assert.equal(result.value, 0.74)
  assert.equal(result.confidence, 0.55)
  assert.deepEqual(result.contributingFacts.sort(), ['partner', 'repair', 'safety', 'self'])
})

test('相性§31は安心・修復・個人信頼のいずれかが欠ければ信頼安定を推測しない', () => {
  const known = { value: 0.8, confidence: 0.8, contributingFacts: ['known'] }
  const result = computeTrustStabilityProfile([
    { key: 'emotional_safety', value: 0.8, confidence: 0.7, contributingFacts: ['safety'] },
  ], { compatibility_reliability: known }, { compatibility_reliability: known })
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.contributingFacts, [])
})

test('相性§57は惹かれる強さを使わず維持要因と未修復摩擦から長期結合を部分算出する', () => {
  const positiveKeys = ['emotional_safety', 'value_alignment', 'domestic_compatibility', 'friendship_compatibility', 'repair_capacity', 'growth_compatibility'] as const
  const profiles = positiveKeys.map((key, index) => ({ key, value: 0.8, confidence: 0.7, contributingFacts: [`positive-${index}`] }))
  const result = computeLongTermBindingProfile([
    ...profiles,
    { key: 'conflict_intensity', value: 0.8, confidence: 0.65, contributingFacts: ['conflict'] },
    { key: 'power_balance', value: 0.7, confidence: 0.6, contributingFacts: ['power'] },
    { key: 'admiration_mutual', value: 1, confidence: 1, contributingFacts: ['attraction-not-used'] },
  ])
  assert.equal(result.key, 'long_term_binding')
  assert.equal(result.value, 0.758)
  assert.equal(result.confidence, 0.5)
  assert.ok(!result.contributingFacts.includes('attraction-not-used'))
})

test('相性§57は維持要因か摩擦要因が欠ける場合に長期結合を推測しない', () => {
  const result = computeLongTermBindingProfile([
    { key: 'emotional_safety', value: 0.8, confidence: 0.7, contributingFacts: ['safety'] },
  ])
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.contributingFacts, [])
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

test('相性§43は月と冥王星の接触を親密さや安心と分けて依存強度へ保持する', () => {
  const facts = buildSynastryFacts(
    { astrology: { western: { planets: [{ name: '月', longitude: 10 }] } } },
    { astrology: { western: { planets: [{ name: 'Pluto', longitude: 10 }] } } },
  )
  const profiles = computeCompatibilityProfile(facts, { self: true, partner: true })
  const dependency = profiles.find(score => score.key === 'dependency_intensity')!
  const safety = profiles.find(score => score.key === 'emotional_safety')!
  assert.ok(dependency.value > 0.5)
  assert.ok(dependency.confidence > 0)
  assert.equal(safety.confidence, 0)
  assert.ok(dependency.contributingFacts.every(factId => /月-冥王星|冥王星-月/.test(facts.find(fact => fact.id === factId)?.signal ?? '')))
})

test('相性§43は月と冥王星の接触がなければ依存強度を推測しない', () => {
  const result = computeCompatibilityProfile(buildSynastryFacts(
    { astrology: { western: { planets: [{ name: '月', longitude: 10 }] } } },
    { astrology: { western: { planets: [{ name: 'Venus', longitude: 10 }] } } },
  )).find(score => score.key === 'dependency_intensity')!
  assert.equal(result.value, 0.5)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.contributingFacts, [])
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
