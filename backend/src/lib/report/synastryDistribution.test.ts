import assert from 'node:assert/strict'
import test from 'node:test'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { buildCompatibilityTraitScoreBundle, buildDeterministicCompatibilityReport } from './deterministicCompatibility.js'
import { buildSynastryFacts, computeRelationScores, type RelationAxis } from './synastryFacts.js'

const pairs = Array.from({ length: 20 }, (_, index) => ({
  self: buildFixtureReportInput(BIRTH_FIXTURES[index]),
  partner: buildFixtureReportInput(BIRTH_FIXTURES[index + 20]),
}))

test('PR-4相性分布は20組で入力差・再現性・根拠参照を維持する', () => {
  const samples = pairs.map(({ self, partner }) => {
    const facts = buildSynastryFacts(self, partner)
    const scores = computeRelationScores(facts)
    assert.deepEqual(facts, buildSynastryFacts(self, partner))
    assert.ok(facts.length >= 2)
    assert.ok(facts.some(fact => fact.kind === 'stem-relation'))
    assert.ok(facts.some(fact => fact.kind === 'number'))
    assert.ok(facts.every(fact => fact.selfFactId && fact.partnerFactId))
    assert.equal(new Set(facts.map(fact => fact.id)).size, facts.length)
    return {
      factSignature: facts.map(fact => `${fact.kind}:${fact.axis}:${fact.signal}`).sort().join('|'),
      scoreSignature: scores.map(score => `${score.key}:${score.value}`).join('|'),
      axes: new Set(facts.map(fact => fact.axis)),
    }
  })
  const uniqueFactSignatures = new Set(samples.map(sample => sample.factSignature)).size
  const uniqueScoreSignatures = new Set(samples.map(sample => sample.scoreSignature)).size
  console.info('PR-4 synastry distribution', { sampleCount: samples.length, uniqueFactSignatures, uniqueScoreSignatures })
  assert.ok(uniqueFactSignatures >= 18)
  assert.ok(uniqueScoreSignatures >= 18)
  assert.ok(samples.every(sample => sample.axes.size >= 2))
})

test('PR-4相性レポートは20組で同じ内容へ収束せず関係ラベルを守る', () => {
  const reports = pairs.map(({ self, partner }, index) => {
    const label = index % 2 === 0 ? '片思い' : 'お付き合い中'
    const report = buildDeterministicCompatibilityReport(self, partner, 'romantic', label)
    assert.equal(report.cards.length, 8)
    assert.ok(report.cards.every(card => card.scope === 'couple' && card.generator === 'deterministic'))
    const chapterAxes = new Set(report.cards.flatMap(card => (card.metadataRefs ?? []).filter(ref => ref.startsWith('synastry.axis.'))))
    const availableAxes = new Set(buildSynastryFacts(self, partner).map(fact => fact.axis))
    assert.ok(chapterAxes.size >= Math.min(4, availableAxes.size))
    assert.ok([...chapterAxes].every(ref => availableAxes.has(ref.replace('synastry.axis.', '') as RelationAxis)))
    const text = report.cards.flatMap(card => [card.title, card.summary, ...card.pages.map(page => page.text)]).join('\n')
    if (label === '片思い') assert.doesNotMatch(text, /お付き合い中|交際中/)
    return report.cards.map(card => `${card.title}\n${card.summary}`).join('\n')
  })
  assert.ok(new Set(reports).size >= 18)
})

test('出生時刻なし同士でも相性を生成し時刻依存Factを混入させない', () => {
  const self = buildFixtureReportInput(BIRTH_FIXTURES[36])
  const partner = buildFixtureReportInput(BIRTH_FIXTURES[37])
  const facts = buildSynastryFacts(self, partner)
  assert.ok(facts.length >= 2)
  assert.ok(facts.some(fact => fact.kind === 'stem-relation'))
  assert.ok(facts.some(fact => fact.kind === 'number'))
  assert.equal(facts.some(fact => fact.requiresSelfBirthTime || fact.requiresPartnerBirthTime), false)
  assert.equal(buildDeterministicCompatibilityReport(self, partner, 'friend', '友人').cards.length, 7)
})


test('C02 birth-to-bundle-to-report preserves missing context, pair symmetry and directional exchange for 20 pairs', () => {
  for (const [index, { self, partner }] of pairs.entries()) {
    const bundle = buildCompatibilityTraitScoreBundle(self, partner)
    const swapped = buildCompatibilityTraitScoreBundle(partner, self)
    assert.deepEqual(bundle.pair, swapped.pair, `pair symmetry: ${index}`)
    for (const key of ['transparency', 'predictability', 'betrayal_risk_pattern', 'long_term_binding', 'mystery_distance']) {
      const score = bundle.profile.find(score => score.key === key)!
      assert.equal(score.confidence, 0, `${index}:${key}`)
      assert.deepEqual(score.contributingFacts, [])
    }
    for (const key of ['social_display_affection', 'private_affection']) {
      const forward = bundle.profile.find(score => score.key === key)!
      const reverse = swapped.profile.find(score => score.key === key)!
      assert.equal(forward.value, reverse.value, `${index}:${key}`)
      assert.equal(forward.confidence, reverse.confidence)
      assert.equal(forward.directions?.selfToPartner, reverse.directions?.partnerToSelf)
      assert.equal(forward.directions?.partnerToSelf, reverse.directions?.selfToPartner)
    }
    const report = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い', bundle)
    assert.deepEqual(report, buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い', bundle))
    assert.equal(report.cards.length, 8)
    for (const card of report.cards) {
      assert.ok(card.evidence.every(e => !/NaN|Infinity|confidence=0(?:$|;)/.test(e.detail)))
      for (const ref of card.metadataRefs ?? []) {
        if (ref.startsWith('compatibilityProfile.')) {
          assert.ok(bundle.profile.find(score => score.key === ref.slice('compatibilityProfile.'.length))!.confidence > 0)
        }
      }
    }
  }
})
