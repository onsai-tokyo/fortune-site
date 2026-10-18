import test from 'node:test'
import assert from 'node:assert/strict'
import { measureClaimDiversity, measureTitleDistribution, type DiversitySample } from './qualityMetrics.js'
const assets = Array.from({ length: 320 }, (_, i) => ({ id: `${i}`, chapter: i < 160 ? 'life-mission' as const : 'work-fit' as const, typeLabel: `title-${i}` }))
const sample = (id: string, offset = 0): DiversitySample => ({ id, rows: assets.map((asset, i) => ({
  claimId: asset.id, chapter: asset.chapter,
  reason: i >= offset && i < offset + 14 ? 'selected' : i < 40 ? 'eligible_not_selected' : 'no_finding', lead: i === offset,
})) })
test('two balanced titles mean two effective titles, not perfect quality', () => {
  const result = measureTitleDistribution(['a', 'b', 'a', 'b'])
  assert.equal(result.entropy, Math.log(2)); assert.equal(result.effectiveTitleCount, 2); assert.equal(result.maxShare, .5)
  assert.equal(measureTitleDistribution(['a', 'a']).effectiveTitleCount, 1)
})
test('14/320 differs from 14/40; lead and chapters stay separate', () => {
  const result = measureClaimDiversity([sample('one')], assets)
  assert.equal(result.qualityEligible, false)
  const section = result.groups.find(g => g.chapter === null && g.role === 'section')!
  assert.deepEqual(section.coverageCurve[0], { sampleCount: 1, selectedAssetCount: 14, eligibleAssetCount: 40, allAssetCount: 320, eligibleCoverage: 14 / 40, allAssetCoverage: 14 / 320 })
  assert.equal(result.groups.find(g => g.chapter === null && g.role === 'lead')!.distribution.observations, 1)
  assert.equal(result.groups.find(g => g.chapter === 'work-fit')!.distribution.entropy, null)
})
test('zero denominators and empty observations stay null', () => {
  assert.deepEqual(measureTitleDistribution([]), { observations: 0, distinctTitles: 0, entropy: null, effectiveTitleCount: null, maxShare: null })
  assert.equal(measureClaimDiversity([{ id: 'empty', rows: [] }], []).groups[0].coverageCurve[0].allAssetCoverage, null)
  assert.equal(measureClaimDiversity([sample('one')], assets).groups.find(g => g.chapter === 'work-fit')!.coverageCurve[0].eligibleCoverage, null)
})
test('order changes prefixes but final coverage and distributions are repeatable', () => {
  const samples = [sample('one'), sample('two', 7), sample('three', 20)]
  const first = measureClaimDiversity(samples, assets)
  assert.deepEqual(first, measureClaimDiversity(samples, assets))
  const reverse = measureClaimDiversity([...samples].reverse(), assets)
  for (const [i, group] of first.groups.entries()) {
    assert.deepEqual(group.coverageCurve.at(-1), reverse.groups[i].coverageCurve.at(-1))
    assert.deepEqual(group.distribution, reverse.groups[i].distribution)
  }
  assert.notDeepEqual(first.sampleOrder, reverse.sampleOrder)
})
test('incomplete or mismatched traces cannot silently inflate coverage', () => {
  assert.throws(() => measureClaimDiversity([{ id: 'missing', rows: [] }], assets), /Incomplete/)
  assert.throws(() => measureClaimDiversity([sample('same'), sample('same')], assets), /Duplicate sample/)
  const bad = sample('bad'); bad.rows = bad.rows.map((r, i) => i ? r : { ...r, chapter: 'work-mode' as const })
  assert.throws(() => measureClaimDiversity([bad], assets), /Unknown asset/)
})
