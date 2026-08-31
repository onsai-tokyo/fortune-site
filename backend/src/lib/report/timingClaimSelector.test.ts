import assert from 'node:assert/strict'
import test from 'node:test'
import { TIMING_CLAIM_ASSETS } from './timingClaimAssets.js'
import type { LifeEventKey } from './lifeEventLabels.js'
import type { TimingClaimAsset, TimingScoreKey } from './timingClaim.js'
import { claimFit, createTimingReportSelectionState, hardGateReason, isTimingGateDefinitionValid, passesTimingScoreGate, selectTimingClaims, type AnnualTimingProfile, type TimingScoreResult } from './timingClaimSelector.js'

const score = (key: TimingScoreKey, relativeStrength = 0.9, overrides: Partial<TimingScoreResult> = {}): TimingScoreResult => ({
  key, rawSupport: 0.8, relativeStrength, confidence: 0.8, sourceFamilyCount: 3, correlationGroupCount: 2,
  familyContributions: { western: 0.3, stem_branch: 0.3, ziwei: 0.2 },
  evidence: [{ id: `${key}:1`, sourceFamily: 'western', correlationGroup: 'astronomical_ephemeris' }], ...overrides,
})
const keys: TimingScoreKey[] = ['relationship_activation','relationship_binding','relationship_disruption','relationship_secrecy','relationship_idealization','marriage_legalization','career_activation','career_change','career_expansion','money_status','home_family','relocation','education_activation','education_disruption','identity_reset','social_network_change','responsibility','emotional_stress']
const allScores = (value = 0.9) => Object.fromEntries(keys.map(key => [key, score(key, value)])) as NonNullable<AnnualTimingProfile['scores']>

function profile(year: number, display: LifeEventKey[], active: LifeEventKey[] = display): AnnualTimingProfile {
  return { year, displayEvents: display.map(event => ({ event, occurrenceIndex: 0, clusterCount: 2, strength: 'strong' })), activeDomains: new Set(active), scores: allScores(), traits: new Proxy({}, { get: () => 0.9 }), relationshipStatus: 'dating', workStatus: 'employed', history: new Set(['past_serious_relationship', 'marriage', 'past_job_change']), context: {} }
}
function asset(overrides: Partial<TimingClaimAsset> & Pick<TimingClaimAsset, 'id' | 'events'>): TimingClaimAsset {
  return { occurrence: 'any', shape: 'event', typeLabel: overrides.id, proposition: '本文', behavior: '行動', headline: true, salienceBase: 0.8, specificity: 'score_specific', availability: 'enabled', semanticGroup: overrides.id, match: { allScores: [{ key: 'identity_reset', op: 'gte', value: 0.66, level: 'high' }] }, ...overrides }
}

test('activeDomains 3件なら displayEvents 2件でも cp-14 を選べる', () => {
  const cp14 = TIMING_CLAIM_ASSETS.find(item => item.id === 'cp-14')!
  const result = selectTimingClaims([cp14], profile(2030, ['work', 'separation'], ['work', 'separation', 'move']), createTimingReportSelectionState(), 'cp')
  assert.ok(result.selected.some(item => item.asset.id === 'cp-14'))
})
test('領域が違う3件では rs-09 を出さない', () => assert.equal(hardGateReason(TIMING_CLAIM_ASSETS.find(item => item.id === 'rs-09')!, profile(2030, ['reset', 'study'], ['reset', 'study', 'money'])), 'activeDomains'))
test('全資産のlevelとop/value/min/maxはSCORE_BOUNDSに完全一致する', () => {
  const gates = TIMING_CLAIM_ASSETS.flatMap(item => [
    ...(item.match.allScores ?? []), ...(item.match.anyScores ?? []),
    ...(item.match.traitAll ?? []), ...(item.match.traitAny ?? []),
  ])
  assert.ok(gates.length > 0)
  assert.ok(gates.every(isTimingGateDefinitionValid))
})
test('levelと数値条件が矛盾するgateは安全に不成立となる', () => {
  assert.equal(isTimingGateDefinitionValid({ level: 'high', op: 'gte', value: .33 }), false)
  assert.equal(isTimingGateDefinitionValid({ level: 'medium', op: 'between', min: .33, max: .66 }), false)
  assert.equal(isTimingGateDefinitionValid({ level: 'low', op: 'gte', value: .32 }), false)
})
test('reset+work+move+meeting では rs-09 が候補になる', () => {
  const p = profile(2030, ['reset', 'work'], ['reset', 'work', 'move', 'meeting'])
  assert.equal(hardGateReason(TIMING_CLAIM_ASSETS.find(item => item.id === 'rs-09')!, p), null)
  const rs09 = TIMING_CLAIM_ASSETS.find(item => item.id === 'rs-09')!
  assert.ok(selectTimingClaims([rs09], p, createTimingReportSelectionState(), 'rs').selected.some(item => item.asset.id === 'rs-09'))
})
test('同一 semanticGroup の rs-09 と cp-14 を同じ年に出さない', () => {
  const candidates = TIMING_CLAIM_ASSETS.filter(item => item.id === 'rs-09' || item.id === 'cp-14')
  const ids = selectTimingClaims(candidates, profile(2030, ['reset', 'separation'], ['reset', 'work', 'move', 'separation']), createTimingReportSelectionState(), 'same-group').selected.map(item => item.asset.id)
  assert.ok(ids.includes('rs-09') || ids.includes('cp-14')); assert.ok(!(ids.includes('rs-09') && ids.includes('cp-14')))
})
test('選択中に activeDomains を変更しない', () => {
  const p = profile(2030, ['work', 'move'], ['work', 'move', 'reset']); const before = [...p.activeDomains]
  selectTimingClaims(TIMING_CLAIM_ASSETS, p, createTimingReportSelectionState(), 'immutable'); assert.deepEqual([...p.activeDomains], before)
})
test('明確に成立した候補を閾値ぎりぎりの候補より優先し breakdown を返す', () => {
  const strong = asset({ id: 'strong', events: ['reset'], match: { allScores: [{ key: 'identity_reset', op: 'gte', value: 0.66, level: 'high' }] } })
  const marginal = asset({ id: 'marginal', events: ['reset'], match: { allScores: [{ key: 'career_change', op: 'gte', value: 0.66, level: 'high' }] } })
  const p = profile(2030, ['reset']); p.scores = { ...p.scores, identity_reset: score('identity_reset', 0.95), career_change: score('career_change', 0.661) }
  const result = selectTimingClaims([marginal, strong], p, createTimingReportSelectionState(), 'fit')
  assert.equal(result.selected[0].asset.id, 'strong'); assert.ok(Object.values(result.selected[0].fit.breakdown).filter(value => value !== null).every(Number.isFinite))
})
test('付帯条件なしの明確な成立が、付帯条件つきの閾値ぎりぎり候補に逆転されない', () => {
  const clear = asset({ id: 'clear', events: ['reset'] })
  const marginalWithConditions = asset({
    id: 'marginal-with-conditions', events: ['reset', 'work'],
    match: {
      allScores: [{ key: 'identity_reset', op: 'gte', value: 0.66, level: 'high' }],
      traitAll: [{ key: 'plan_orientation', op: 'gte', value: 0.66, level: 'high' }],
      relationshipStatus: ['dating'], historyAll: ['past_serious_relationship'], coEventsAll: ['work'],
    },
  })
  const clearProfile = profile(2030, ['reset', 'work']); clearProfile.scores = { ...clearProfile.scores, identity_reset: score('identity_reset', 0.966) }
  const marginalProfile = profile(2030, ['reset', 'work']); marginalProfile.scores = { ...marginalProfile.scores, identity_reset: score('identity_reset', 0.677) }
  const clearFit = claimFit(clear, clearProfile); const marginalFit = claimFit(marginalWithConditions, marginalProfile)
  assert.equal(clearFit.appliedWeight, 0.6)
  assert.equal(marginalFit.appliedWeight, 1)
  assert.ok(clearFit.total > marginalFit.total, `${clearFit.total} <= ${marginalFit.total}`)
})
test('fallback はfitが高くても score_specific より後の別プールで評価する', () => {
  const fallback = asset({ id: 'high-fallback', events: ['reset'], specificity: 'fallback', salienceBase: 1, match: {} })
  const specific = asset({ id: 'lower-specific', events: ['reset'], salienceBase: 0.5 })
  const p = profile(2030, ['reset']); p.scores = { ...p.scores, identity_reset: score('identity_reset', 0.67, { confidence: 0.5, sourceFamilyCount: 1 }) }
  const result = selectTimingClaims([fallback, specific], p, createTimingReportSelectionState(), 'fallback-pool', 1)
  assert.ok(claimFit(fallback, p).total > claimFit(specific, p).total)
  assert.equal(result.selected[0].asset.id, 'lower-specific')
  assert.deepEqual(result.eligible.map(item => item.asset.id), ['lower-specific', 'high-fallback'])
})
test('複数の必須スコアを持つClaimは最も弱いconfidenceを全体上限にする', () => {
  const multi = asset({
    id: 'confidence-min', events: ['reset'],
    match: { allScores: [
      { key: 'relationship_idealization', op: 'gte', value: 0.66, level: 'high' },
      { key: 'relationship_secrecy', op: 'gte', value: 0.66, level: 'high' },
    ] },
  })
  const p = profile(2030, ['reset'])
  p.scores = { ...p.scores,
    relationship_idealization: score('relationship_idealization', 0.9, { confidence: 0.95, rawSupport: 0.384, sourceFamilyCount: 2, correlationGroupCount: 1 }),
    relationship_secrecy: score('relationship_secrecy', 0.9, { confidence: 0.95 }),
  }
  assert.equal(claimFit(multi, p).breakdown.confidence, 0.65)
})
test('confidenceCapは表示順位だけでなくHard GateのminConfidenceより前に適用する', () => {
  const gate = { key: 'relationship_idealization', op: 'gte', value: 0.66, level: 'high' } as const
  const idealization = score('relationship_idealization', 0.9, { confidence: 1, rawSupport: 0.384, sourceFamilyCount: 2, correlationGroupCount: 1 })
  assert.equal(passesTimingScoreGate(gate, idealization, { relativeStrengthMin: 0.66, minConfidence: 0.7, confidenceCap: 0.65 }), false)
})
test('非有限スコアとtraitはHard Gateを安全側で不通過にする', () => {
  const gate = { key: 'identity_reset', op: 'gte', value: 0.66, level: 'high' } as const
  assert.equal(passesTimingScoreGate(gate, score('identity_reset', Number.NaN)), false)
  const p = profile(2030, ['reset'])
  p.traits = { plan_orientation: Number.NaN }
  assert.equal(hardGateReason(asset({ id: 'nan-trait', events: ['reset'], match: { traitAll: [{ key: 'plan_orientation', op: 'gte', value: 0.66, level: 'high' }] } }), p), 'traitAll')
})

test('claimFitは参照スコア欠損時に例外ではなくゼロを返す', () => {
  const p = profile(2030, ['reset'])
  p.scores = undefined
  const result = claimFit(asset({ id: 'missing-score', events: ['reset'] }), p)
  assert.equal(result.total, 0)
  assert.equal(result.appliedWeight, 0)
  assert.ok(Object.values(result.breakdown).filter(value => value !== null).every(Number.isFinite))
})
test('anyScoresの一部欠損は通過した枝だけを評価し例外にしない', () => {
  const p = profile(2030, ['reset'])
  p.scores = { identity_reset: score('identity_reset', 0.9) }
  const candidate = asset({
    id: 'partial-any-score',
    events: ['reset'],
    match: { anyScores: [
      { key: 'identity_reset', op: 'gte', value: 0.66, level: 'high' },
      { key: 'career_change', op: 'gte', value: 0.66, level: 'high' },
    ] },
  })
  assert.equal(hardGateReason(candidate, p), null)
  assert.doesNotThrow(() => claimFit(candidate, p))
  assert.ok(claimFit(candidate, p).total > 0)
})

test('有限でも範囲外・キー違い・非整数countのスコアをゲートで拒否する', () => {
  const gate = { key: 'identity_reset', op: 'lte', value: 0.32, level: 'low' } as const
  assert.equal(passesTimingScoreGate(gate, score('identity_reset', -100)), false)
  assert.equal(passesTimingScoreGate(gate, score('career_change', 0.1)), false)
  assert.equal(passesTimingScoreGate(gate, score('identity_reset', 0.1, { sourceFamilyCount: 1.5 })), false)
  assert.equal(passesTimingScoreGate(gate, score('identity_reset', 0.1, { confidence: 1.01 })), false)
})
test('不正なruntime key・level・NaN policyを例外なくfail closedにする', () => {
  const valid = { key: 'identity_reset', op: 'gte', value: 0.66, level: 'high' } as const
  const value = score('identity_reset', 0.9, { confidence: 0 })
  assert.equal(passesTimingScoreGate({ ...valid, key: 'unknown' } as never, value), false)
  assert.equal(passesTimingScoreGate({ ...valid, level: 'unknown' } as never, value), false)
  assert.equal(passesTimingScoreGate(valid, value, { minConfidence: Number.NaN }), false)
})

test('fallbackでもスコア条件を持つ場合はscores欠損を迂回しない', () => {
  const p = profile(2030, ['reset'])
  p.scores = undefined
  const candidate = asset({
    id: 'gated-fallback', events: ['reset'], specificity: 'fallback',
    match: { allScores: [{ key: 'identity_reset', op: 'gte', value: 0.66, level: 'high' }] },
  })
  assert.equal(hardGateReason(candidate, p), 'scoresMissing')
})
test('不正なTraitGate keyは同名のruntime propertyがあってもfail closedにする', () => {
  const p = profile(2030, ['reset'])
  p.traits = { arbitrary_runtime_key: 1 } as never
  const candidate = asset({
    id: 'malformed-trait', events: ['reset'],
    match: { traitAll: [{ key: 'arbitrary_runtime_key', op: 'gte', value: 0.5, level: 'high' } as never] },
  })
  assert.equal(hardGateReason(candidate, p), 'traitAll')
})
test('hash は完全同点だけに使う', () => {
  const a = asset({ id: 'a', events: ['reset'] }); const b = asset({ id: 'b', events: ['reset'] })
  assert.ok(selectTimingClaims([a, b], profile(2030, ['reset']), createTimingReportSelectionState(), 'tie').eligible.every(item => item.tieBreakUsed))
  const c = asset({ id: 'c', events: ['reset'], salienceBase: 0.9 })
  assert.ok(selectTimingClaims([a, c], profile(2030, ['reset']), createTimingReportSelectionState(), 'untied').eligible.every(item => !item.tieBreakUsed))
})
test('2バッジ年300件で説明欠落が0件', () => {
  let missing = 0
  for (let index = 0; index < 300; index += 1) {
    const result = selectTimingClaims(TIMING_CLAIM_ASSETS, profile(2030, ['meeting', 'work'], ['meeting', 'work', 'move']), createTimingReportSelectionState(), `two-${index}`)
    for (const event of ['meeting', 'work'] as const) if (!result.selected.some(item => item.asset.events.length === 1 && item.asset.events[0] === event)) missing += 1
  }
  assert.equal(missing, 0)
})
test('20年で score_specific/compound の Claim ID 重複が0', () => {
  const state = createTimingReportSelectionState(); const ids: string[] = []
  for (let year = 2026; year < 2046; year += 1) {
    const events: LifeEventKey[] = year % 2 ? ['meeting', 'work'] : ['reset', 'move']
    ids.push(...selectTimingClaims(TIMING_CLAIM_ASSETS, profile(year, events, [...events, 'money']), state, 'twenty').selected.filter(item => item.asset.specificity !== 'fallback').map(item => item.asset.id))
  }
  assert.equal(new Set(ids).size, ids.length)
})
test('semanticGroup は5年以内に再利用しない', () => {
  const state = createTimingReportSelectionState(); const a = asset({ id: 'one', events: ['reset'], semanticGroup: 'shared' }); const b = asset({ id: 'two', events: ['reset'], semanticGroup: 'shared' })
  assert.equal(selectTimingClaims([a], profile(2030, ['reset']), state, 's').selected.length, 1)
  assert.equal(selectTimingClaims([b], profile(2034, ['reset']), state, 's').selected.length, 0)
  assert.equal(selectTimingClaims([b], profile(2035, ['reset']), state, 's').selected.length, 1)
})
test('fallback は代替がなく8年以上空けば再利用できる', () => {
  const state = createTimingReportSelectionState(); const fallback = asset({ id: 'fallback', events: ['reset'], specificity: 'fallback', match: {} }); const p = (year: number) => ({ ...profile(year, ['reset']), scores: undefined })
  assert.equal(selectTimingClaims([fallback], p(2030), state, 'f').selected.length, 1)
  assert.equal(selectTimingClaims([fallback], p(2037), state, 'f').selected.length, 0)
  assert.equal(selectTimingClaims([fallback], p(2038), state, 'f').selected.length, 1)
})
test('fallback は8年以上後でも代替候補があれば再利用しない', () => {
  const state = createTimingReportSelectionState(); const fallback = asset({ id: 'fallback-alt', events: ['reset'], specificity: 'fallback', match: {} })
  selectTimingClaims([fallback], { ...profile(2030, ['reset']), scores: undefined }, state, 'fa')
  const alternative = asset({ id: 'specific-alt', events: ['reset'] })
  const result = selectTimingClaims([fallback, alternative], profile(2038, ['reset']), state, 'fa')
  assert.ok(result.selected.some(item => item.asset.id === 'specific-alt'))
  assert.ok(!result.selected.some(item => item.asset.id === 'fallback-alt'))
  assert.ok(result.excluded.some(item => item.asset.id === 'fallback-alt' && item.reason === 'fallbackAlternativeAvailable'))
})
test('scores/traits/pending の安全側フォールバックと同一入力 deepEqual', () => {
  const fallback = asset({ id: 'fb', events: ['reset'], specificity: 'fallback', match: {} })
  const gated = asset({ id: 'trait', events: ['reset'], match: { traitAll: [{ key: 'plan_orientation', op: 'gte', value: 0.66, level: 'high' }] } })
  const pending = asset({ id: 'pending', events: ['reset'], availability: 'disabled_until_resolved', match: { pending: ['role_shift'] } })
  const p = { ...profile(2030, ['reset']), scores: undefined, traits: undefined }
  const first = selectTimingClaims([fallback, gated, pending], p, createTimingReportSelectionState(), 'same'); const second = selectTimingClaims([fallback, gated, pending], p, createTimingReportSelectionState(), 'same')
  assert.deepEqual(first, second); assert.deepEqual(first.selected.map(item => item.asset.id), ['fb'])
})
test('claimFit 単体も診断可能', () => { const result = claimFit(asset({ id: 'diagnostic', events: ['reset'] }), profile(2030, ['reset'])); assert.equal(Object.keys(result.breakdown).length, 7); assert.ok(result.total > 0) })
