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
    assert.ok(essence.every(card => card.pages.length >= 13 && card.generator === 'deterministic'), fixture.id)
    const quality = measureReportQuality(first.report, first.findings)
    assert.equal(quality.loveWorkLeakage, 0, fixture.id)
    assert.equal(quality.duplicateTitleCount, 0, fixture.id)
    return { id: fixture.id, report: first.report, findings: first.findings }
  })
  const metrics = measureCorpusQuality(samples)
  console.info('Narrative blocks V2 corpus metrics', metrics)
  assert.equal(metrics.totalLoveWorkLeakage, 0)
  assert.ok(metrics.pairwisePageJaccardMedian < 0.0775)
})
