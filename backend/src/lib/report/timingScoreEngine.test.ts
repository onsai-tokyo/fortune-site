import assert from 'node:assert/strict'
import test from 'node:test'
import { computeTimingScore, computeTimingScores, type CorrelationGroup, type SourceFamily, type TimingEvidenceDefinition } from './timingScoreEngine.js'
import { TIMING_SCORE_KEYS, type TimingScoreKey } from './timingClaim.js'
import { TIMING_CLAIM_ASSETS } from './timingClaimAssets.js'
import { claimFit, hardGateReason, type AnnualTimingProfile, type TimingScoreResult } from './timingClaimSelector.js'

const evidence = (id: string, sourceFamily: SourceFamily, overrides: Partial<TimingEvidenceDefinition> = {}): TimingEvidenceDefinition => {
  const factLineageId = overrides.factLineageId ?? `${sourceFamily}:fixture:${id}`
  return {
    id,
    scoreKey: 'identity_reset',
    sourceFamily,
    technique: overrides.technique ?? factLineageId.split(':')[1]!,
    correlationGroup: ({ western: 'astronomical_ephemeris', vedic: 'astronomical_ephemeris', stem_branch: 'stem_branch_calendar', ziwei: 'ziwei_chart', auxiliary: 'independent_auxiliary' } as Record<SourceFamily, CorrelationGroup>)[sourceFamily],
    available: true,
    matched: true,
    support: 1,
    maximumContribution: ({ western: 0.24, vedic: 0.24, stem_branch: 0.24, ziwei: 0.23, auxiliary: 0.05 } as Record<SourceFamily, number>)[sourceFamily],
    ...overrides,
    factLineageId,
  }
}

test('W/Vは同一ephemerisとして0.6補正し、stem_branchとziweiはrawSupportで独立加算する', () => {
  const result = computeTimingScore('identity_reset', [evidence('w', 'western'), evidence('v', 'vedic'), evidence('s', 'stem_branch'), evidence('z', 'ziwei')])
  assert.equal(Number(result.rawSupport.toFixed(3)), 0.854)
  assert.equal(result.sourceFamilyCount, 4)
  assert.equal(result.correlationGroupCount, 3)
  assert.equal(result.familyContributions.ziwei, 0.23)
})

test('ziweiをstem_branchへ統合せず、別FactLineage・別Source Familyとして保持する', () => {
  const result = computeTimingScore('marriage_legalization', [
    evidence('s', 'stem_branch', { scoreKey: 'marriage_legalization', factLineageId: 'stem_branch:annual_relation:day_branch:combine' }),
    evidence('z', 'ziwei', { scoreKey: 'marriage_legalization', factLineageId: 'ziwei:annual_life_palace:natal_spouse_palace' }),
  ])
  assert.deepEqual(Object.keys(result.familyContributions).sort(), ['stem_branch', 'ziwei'])
  assert.equal(result.sourceFamilyCount, 2)
})

test('stem_branch内の四柱推命・算命学・天中殺・納音は同一Lineageなら1票へ統合する', () => {
  const lineage = 'stem_branch:annual_relation:day_branch:clash'
  const result = computeTimingScore('relationship_disruption', ['bazi', 'sanmei', 'void', 'nayin'].map(id => evidence(id, 'stem_branch', { scoreKey: 'relationship_disruption', factLineageId: lineage })))
  assert.equal(result.sourceFamilyCount, 1)
  assert.equal(result.evidence.length, 1)
  assert.equal(result.rawSupport, 0.24)
})

test('同じFactLineageの別名Evidenceを二重加点しない', () => {
  const shared = 'stem_branch:monthly_relation:day_branch:break'
  const result = computeTimingScore('relationship_disruption', [
    evidence('bazi', 'stem_branch', { scoreKey: 'relationship_disruption', factLineageId: shared, support: 0.7 }),
    evidence('sanmei', 'stem_branch', { scoreKey: 'relationship_disruption', factLineageId: shared, support: 0.7 }),
  ])
  assert.equal(result.evidence.length, 1)
  assert.equal(Number(result.rawSupport.toFixed(3)), 0.168)
})

test('同一LineageはmaximumContributionを含む実寄与が最大のEvidenceを採る', () => {
  const lineage = 'stem_branch:annual_pillar:day_branch:clash'
  const result = computeTimingScore('relationship_disruption', [
    evidence('large', 'stem_branch', { scoreKey: 'relationship_disruption', factLineageId: lineage, maximumContribution: 0.24, support: 0.5 }),
    evidence('small', 'stem_branch', { scoreKey: 'relationship_disruption', factLineageId: lineage, maximumContribution: 0.10, support: 0.6 }),
  ])
  assert.equal(result.evidence[0]?.id, 'large')
  assert.equal(result.rawSupport, 0.12)
})

test('potentialはsupportに左右されず同一LineageのmaximumContribution最大値を使う', () => {
  const lineage = 'stem_branch:annual_pillar:day_branch:clash'
  const result = computeTimingScore('relationship_disruption', [
    evidence('large-potential', 'stem_branch', { scoreKey: 'relationship_disruption', factLineageId: lineage, maximumContribution: 0.24, support: 0.3 }),
    evidence('small-potential', 'stem_branch', { scoreKey: 'relationship_disruption', factLineageId: lineage, maximumContribution: 0.08, support: 1 }),
  ])
  assert.equal(result.rawSupport, 0.08)
  assert.equal(Number(result.relativeStrength.toFixed(3)), 0.333)
})

test('出生時刻不明はEvidenceをavailableMaxから除外し、追加の一律ペナルティを掛けない', () => {
  const result = computeTimingScore('career_activation', [
    evidence('w', 'western', { scoreKey: 'career_activation', available: true, matched: true }),
    evidence('z', 'ziwei', { scoreKey: 'career_activation', available: false, matched: false, support: 0 }),
  ])
  assert.equal(result.relativeStrength, 1)
  assert.ok(result.confidence < 1)
})

test('availableMaxはFamily一括ではなくEvidence単位で部分欠損を反映する', () => {
  const result = computeTimingScore('career_change', [
    evidence('available-half', 'western', { scoreKey: 'career_change', maximumContribution: 0.12 }),
    evidence('missing-half', 'western', { scoreKey: 'career_change', maximumContribution: 0.12, available: false, matched: false, support: 0 }),
  ])
  assert.equal(result.rawSupport, 0.12)
  assert.equal(result.relativeStrength, 1)
  assert.equal(result.confidence, 0.5)
})

test('0.6相関補正はwesternとvedicだけに掛かり、stem_branchとziweiのrawSupportには掛からない', () => {
  const astronomical = computeTimingScore('identity_reset', [evidence('w', 'western'), evidence('v', 'vedic')])
  const calendar = computeTimingScore('identity_reset', [evidence('s', 'stem_branch'), evidence('z', 'ziwei')])
  assert.equal(astronomical.rawSupport, 0.384)
  assert.equal(calendar.rawSupport, 0.47)
  assert.equal(calendar.confidence, 0.85)
})

test('Family上限とauxiliary 0.05上限を超えて加点しない', () => {
  const result = computeTimingScore('relationship_activation', [
    evidence('a1', 'auxiliary', { scoreKey: 'relationship_activation', factLineageId: 'auxiliary:one' }),
    evidence('a2', 'auxiliary', { scoreKey: 'relationship_activation', factLineageId: 'auxiliary:two' }),
  ])
  assert.equal(result.rawSupport, 0.05)
  assert.equal(result.familyContributions.auxiliary, 0.05)
})

test('非有限値・範囲外・系統不一致のEvidenceを入力境界で拒否する', () => {
  assert.throws(() => computeTimingScore('identity_reset', [evidence('nan', 'western', { support: Number.NaN })]), RangeError)
  assert.throws(() => computeTimingScore('identity_reset', [evidence('infinity', 'western', { maximumContribution: Number.POSITIVE_INFINITY })]), RangeError)
  assert.throws(() => computeTimingScore('identity_reset', [evidence('quality', 'western', { quality: 1.01 })]), RangeError)
  assert.throws(() => computeTimingScore('identity_reset', [evidence('prefix', 'western', { factLineageId: 'vedic:wrong' })]), TypeError)
  assert.throws(() => computeTimingScore('identity_reset', [evidence('duplicate', 'western'), evidence('duplicate', 'western')]), /Duplicate timing evidence id/)
  assert.throws(() => computeTimingScore('identity_reset', [evidence('family', 'western', { sourceFamily: 'unknown' as SourceFamily })]), /sourceFamily is unknown/)
  assert.throws(() => computeTimingScore('identity_reset', [evidence('group', 'western', { correlationGroup: 'unknown' as CorrelationGroup })]), /correlationGroup is unknown/)
  assert.throws(() => computeTimingScore('identity_reset', [evidence('unavailable', 'western', { available: false, matched: true })]), /cannot be matched/)
  assert.throws(() => computeTimingScore('identity_reset', [evidence('unmatched', 'western', { matched: false })]), /cannot have support/)
})

test('同一寄与のEvidenceは入力順によらず安定IDで選ぶ', () => {
  const lineage = 'stem_branch:tie:one'
  const left = evidence('a-stable', 'stem_branch', { factLineageId: lineage, maximumContribution: 0.12 })
  const right = evidence('z-later', 'stem_branch', { factLineageId: lineage, maximumContribution: 0.12 })
  assert.deepEqual(computeTimingScore('identity_reset', [left, right]), computeTimingScore('identity_reset', [right, left]))
  assert.equal(computeTimingScore('identity_reset', [right, left]).evidence[0]?.id, 'a-stable')
})

test('複数系統・重複・反証・欠損を混ぜてもEvidence順列で結果が変わらない', () => {
  const scoreKey = 'relationship_idealization' as const
  const definitions = [
    evidence('western-main', 'western', { scoreKey, factLineageId: 'western:transit:neptune:venus', maximumContribution: .24, support: .8 }),
    evidence('western-alias', 'western', { scoreKey, factLineageId: 'western:transit:neptune:venus', maximumContribution: .20, support: .9 }),
    evidence('western-counter', 'western', { scoreKey, factLineageId: 'western:transit:neptune:end', maximumContribution: .10, support: .6, polarity: -1 }),
    evidence('vedic-main', 'vedic', { scoreKey, factLineageId: 'vedic:antardasha:rahu:romance', maximumContribution: .16, support: .7 }),
    evidence('stem-unmatched', 'stem_branch', { scoreKey, matched: false, support: 0, maximumContribution: .12 }),
    evidence('ziwei-missing', 'ziwei', { scoreKey, available: false, matched: false, support: 0, maximumContribution: .18 }),
    evidence('auxiliary-main', 'auxiliary', { scoreKey, maximumContribution: .05, support: .5, quality: .8 }),
  ]
  const quality = { birthTimePrecision: .85, locationPrecision: .9 }
  const expected = computeTimingScore(scoreKey, definitions, quality)
  let seed = 0x5eed1234
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const shuffled = [...definitions]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const target = seed % (index + 1)
      ;[shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!]
    }
    assert.deepEqual(computeTimingScore(scoreKey, shuffled, quality), expected, `permutation ${iteration}`)
  }
})

test('寄与上限ゼロのavailable Evidenceは相関group分母へ入れない', () => {
  const active = evidence('active', 'western')
  const zero = evidence('zero', 'auxiliary', { maximumContribution: 0, matched: false, support: 0 })
  assert.equal(computeTimingScore('identity_reset', [active, zero]).confidence, computeTimingScore('identity_reset', [active]).confidence)
})

test('Evidence単位qualityと全体qualityを別々に適用する', () => {
  const base = computeTimingScore('relationship_idealization', [evidence('w', 'western', { scoreKey: 'relationship_idealization', quality: 0.5 })])
  const uncertain = computeTimingScore('relationship_idealization', [evidence('w', 'western', { scoreKey: 'relationship_idealization', quality: 0.5 })], { birthTimePrecision: 0.8, locationPrecision: 0.9 })
  assert.equal(base.rawSupport, 0.12)
  assert.equal(Number((uncertain.confidence / base.confidence).toFixed(2)), 0.72)
})

test('反証Evidenceは支持を減らすがfullMaxとavailableMaxを増やさない', () => {
  const result = computeTimingScore('relationship_idealization', [
    evidence('support', 'western', { scoreKey: 'relationship_idealization', factLineageId: 'western:transit:neptune:venus', maximumContribution: 0.24 }),
    evidence('counter', 'western', { scoreKey: 'relationship_idealization', factLineageId: 'western:transit:neptune:desc_long_term_end', maximumContribution: 0.10, polarity: -1 }),
  ])
  assert.equal(Number(result.rawSupport.toFixed(3)), 0.14)
  assert.equal(Number(result.relativeStrength.toFixed(3)), 0.583)
  assert.equal(result.evidence.find(item => item.id === 'counter')?.contribution, -0.1)
})

test('反証Evidenceだけが成立しても支持系統・相関グループとして数えない', () => {
  const result = computeTimingScore('relationship_idealization', [
    evidence('counter', 'western', { scoreKey: 'relationship_idealization', maximumContribution: 0.10, polarity: -1 }),
  ])
  assert.deepEqual({ rawSupport: result.rawSupport, relativeStrength: result.relativeStrength, confidence: result.confidence }, { rawSupport: 0, relativeStrength: 0, confidence: 0 })
  assert.equal(result.sourceFamilyCount, 0)
  assert.equal(result.correlationGroupCount, 0)
})

test('同一Lineageでも支持と反証は別々に保持して同一family内で相殺する', () => {
  const lineage = 'western:transit:neptune:desc'
  const result = computeTimingScore('relationship_idealization', [
    evidence('positive', 'western', { scoreKey: 'relationship_idealization', factLineageId: lineage, maximumContribution: 0.20, support: 0.6, polarity: 1 }),
    evidence('negative', 'western', { scoreKey: 'relationship_idealization', factLineageId: lineage, maximumContribution: 0.10, support: 0.9, polarity: -1 }),
  ])
  assert.equal(result.evidence.length, 2)
  assert.equal(Number(result.rawSupport.toFixed(3)), 0.03)
})

test('純反証familyはゼロに留め、独立した別familyの支持を減算しない', () => {
  const result = computeTimingScore('relationship_idealization', [
    evidence('western-counter', 'western', { scoreKey: 'relationship_idealization', maximumContribution: 0.20, polarity: -1 }),
    evidence('vedic-support', 'vedic', { scoreKey: 'relationship_idealization', maximumContribution: 0.16 }),
  ])
  assert.equal(result.rawSupport, 0.16)
  assert.deepEqual(result.familyContributions, { vedic: 0.16 })
})

test('18キーを常に返し、Evidenceがないキーは安全なゼロになる', () => {
  const result = computeTimingScores([evidence('one', 'western')])
  assert.equal(Object.keys(result).length, 18)
  const emptyKey: TimingScoreKey = 'emotional_stress'
  assert.deepEqual({ rawSupport: result[emptyKey].rawSupport, relativeStrength: result[emptyKey].relativeStrength, confidence: result[emptyKey].confidence }, { rawSupport: 0, relativeStrength: 0, confidence: 0 })
  assert.ok(Number.isFinite(result[emptyKey].relativeStrength))
})

test('要求されたscore key自体が不正なら空結果を返さず拒否する', () => {
  assert.throws(() => computeTimingScore('unknown' as never, []), /Unknown requested timing score key/)
})

test('Source FamilyとCorrelation Groupの意味不一致を入口で拒否する', () => {
  const malformed = { ...evidence('wrong-group', 'western'), correlationGroup: 'ziwei_chart' as const }
  assert.throws(() => computeTimingScore('relationship_disruption', [malformed]), /correlationGroup/)
})

test('A改案で旧到達不能6資産の全Hard Gateが到達可能になる', () => {
  const idealization = computeTimingScore('relationship_idealization', [
    evidence('ideal-w', 'western', { scoreKey: 'relationship_idealization' }),
    evidence('ideal-v', 'vedic', { scoreKey: 'relationship_idealization' }),
  ])
  const education = computeTimingScore('education_disruption', [
    evidence('edu-w', 'western', { scoreKey: 'education_disruption' }),
    evidence('edu-v', 'vedic', { scoreKey: 'education_disruption' }),
    evidence('edu-s', 'stem_branch', { scoreKey: 'education_disruption' }),
  ])
  assert.equal(idealization.rawSupport, 0.384)
  assert.equal(idealization.relativeStrength, 1)
  assert.equal(education.rawSupport, 0.624)
  assert.equal(education.relativeStrength, 1)

  const generic = (key: TimingScoreKey, relativeStrength = 0.9): TimingScoreResult => ({ key, rawSupport: 0.8, relativeStrength, confidence: 0.8, sourceFamilyCount: 4, correlationGroupCount: 3, familyContributions: { western: 0.24, vedic: 0.144, stem_branch: 0.24, ziwei: 0.23 }, evidence: [] })
  const scores = Object.fromEntries(TIMING_SCORE_KEYS.map(key => [key, generic(key)])) as Record<TimingScoreKey, TimingScoreResult>
  scores.relationship_idealization = idealization
  scores.education_disruption = education
  scores.relationship_binding = generic('relationship_binding', 0.2)
  const profile: AnnualTimingProfile = {
    year: 2030,
    displayEvents: (['meeting', 'separation', 'study', 'reset'] as const).map(event => ({ event, occurrenceIndex: 0, clusterCount: 1, strength: 'strong' })),
    activeDomains: new Set(['meeting', 'separation', 'study', 'reset']),
    scores,
    relationshipStatus: 'unknown', workStatus: 'unknown', history: new Set(), context: {},
  }
  const ids = new Set(['me-14', 'me-15', 'se-10', 'st-05', 'st-10', 'cp-13'])
  const targets = TIMING_CLAIM_ASSETS.filter(asset => ids.has(asset.id))
  assert.equal(targets.length, 6)
  assert.deepEqual(targets.map(asset => [asset.id, hardGateReason(asset, profile)]), targets.map(asset => [asset.id, null]))
  assert.equal(claimFit(TIMING_CLAIM_ASSETS.find(asset => asset.id === 'me-15')!, profile).breakdown.confidence, 0.65)
})

test('relationship_idealizationはwestern単独ではSource Family下限を通らない', () => {
  const westernOnly = computeTimingScore('relationship_idealization', [evidence('only-w', 'western', { scoreKey: 'relationship_idealization' })])
  assert.equal(westernOnly.sourceFamilyCount, 1)
  const asset = TIMING_CLAIM_ASSETS.find(item => item.id === 'me-15')!
  const profile: AnnualTimingProfile = { year: 2030, displayEvents: [{ event: 'meeting', occurrenceIndex: 0, clusterCount: 1, strength: 'strong' }], activeDomains: new Set(['meeting']), scores: { relationship_idealization: westernOnly, relationship_secrecy: { ...westernOnly, key: 'relationship_secrecy', rawSupport: 0.8, relativeStrength: 0.9, confidence: 0.8, sourceFamilyCount: 4 } }, relationshipStatus: 'unknown', workStatus: 'unknown', history: new Set(), context: {} }
  assert.equal(hardGateReason(asset, profile), 'allScores')
})
