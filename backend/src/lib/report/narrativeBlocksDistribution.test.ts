import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSelfReport } from './buildSelfReport.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { extractReportMetadata } from './metadata.js'
import { measureCorpusQuality, measureReportQuality } from './qualityMetrics.js'

test('PR-2 blocksは40件で8章・再現性・領域分離を守る', () => {
  const samples = BIRTH_FIXTURES.map(fixture => {
    const input = buildFixtureReportInput(fixture)
    const metadata = extractReportMetadata(input)
    const options = { factPipeline: 'v2', narrativeEngine: 'blocks' } as const
    const first = buildSelfReport(input, metadata, options)
    const second = buildSelfReport(input, metadata, options)
    assert.deepEqual(first.report, second.report, fixture.id)
    const essence = first.report.cards.filter(card => card.kind === 'essence')
    assert.equal(essence.length, 8, fixture.id)
    assert.ok(essence.every(card => {
      const sectionCount = card.sections?.length ?? 0
      return sectionCount >= 1 && sectionCount <= 6 && card.generator === 'deterministic'
    }), fixture.id)
    const quality = measureReportQuality(first.report, first.findings)
    assert.equal(quality.loveWorkLeakage, 0, fixture.id)
    assert.equal(quality.duplicateTitleCount, 0, fixture.id)
    return { id: fixture.id, report: first.report, findings: first.findings }
  })
  const metrics = measureCorpusQuality(samples)
  console.info('Narrative blocks V2 corpus metrics', metrics)
  // Report every failing gate. These are the unchanged acceptance thresholds.
  const failures = [
    { metric: 'totalLoveWorkLeakage', actual: metrics.totalLoveWorkLeakage, expected: '= 0', pass: metrics.totalLoveWorkLeakage === 0 },
    { metric: 'emptyEvidenceCardCount', actual: metrics.emptyEvidenceCardCount, expected: '= 0', pass: metrics.emptyEvidenceCardCount === 0 },
    { metric: 'youSubjectRate', actual: metrics.youSubjectRate, expected: '= 0', pass: metrics.youSubjectRate === 0 },
    { metric: 'maxTitleRepeat', actual: metrics.maxTitleRepeat, expected: '<= 11', pass: metrics.maxTitleRepeat <= 11 },
    { metric: 'distinctEssenceTitles', actual: metrics.distinctEssenceTitles, expected: '>= 114', pass: metrics.distinctEssenceTitles >= 114 },
    { metric: 'distinctDisplayedClaimHeadings', actual: metrics.distinctDisplayedClaimHeadings, expected: '>= 157', pass: metrics.distinctDisplayedClaimHeadings >= 157 },
    { metric: 'pairwisePageJaccardMedian', actual: metrics.pairwisePageJaccardMedian, expected: '<= 0.127', pass: metrics.pairwisePageJaccardMedian <= 0.127 },
  ].filter(check => !check.pass)
  assert.deepEqual(failures, [], 'All current distribution failures (thresholds unchanged)')
})

test('確定版資産は出生時刻なしでも仕事の2章を欠落させない', () => {
  for (const fixtureId of ['f037', 'f040']) {
    const fixture = BIRTH_FIXTURES.find(item => item.id === fixtureId)
    assert.ok(fixture)
    const input = buildFixtureReportInput(fixture)
    const metadata = extractReportMetadata(input)
    const essence = buildSelfReport(input, metadata).report.cards.filter(card => card.kind === 'essence')
    assert.ok(essence.some(card => card.id === 'work-mode'), `${fixtureId}: work-mode`)
    assert.ok(essence.some(card => card.id === 'work-fit'), `${fixtureId}: work-fit`)
  }
})
