import assert from 'node:assert/strict'
import test from 'node:test'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { extractReportMetadata } from './metadata.js'
import { buildSelfReport } from './buildSelfReport.js'
import { measureCorpusQuality, measureReportQuality, type CorpusSample } from './qualityMetrics.js'

function samples(factPipeline: 'v1' | 'v2'): CorpusSample[] {
  return BIRTH_FIXTURES.map(fixture => {
    const input = buildFixtureReportInput(fixture)
    const metadata = extractReportMetadata(input)
    const result = buildSelfReport(input, metadata, { factPipeline, narrativeEngine: 'legacy' })
    return { id: fixture.id, report: result.report, findings: result.findings }
  })
}

test('PR-1: V2 Fact層は40件で個人差と章充足を改善し領域混入を増やさない', () => {
  const v1 = samples('v1')
  const v2 = samples('v2')
  const before = measureCorpusQuality(v1)
  const after = measureCorpusQuality(v2)

  assert.ok(after.meanSupplementChapterRate <= before.meanSupplementChapterRate)
  assert.ok(after.pairwiseFindingJaccardMedian < before.pairwiseFindingJaccardMedian)
  assert.ok(after.pairwisePageJaccardMedian <= before.pairwisePageJaccardMedian)
  assert.ok(after.distinctEssenceTitles >= before.distinctEssenceTitles)
  assert.ok(after.totalLoveWorkLeakage <= before.totalLoveWorkLeakage)

  const averageSystems = (items: CorpusSample[]) => items.reduce(
    (sum, sample) => sum + measureReportQuality(sample.report, sample.findings).evidenceSystemCount,
    0,
  ) / items.length
  assert.ok(averageSystems(v2) > averageSystems(v1))
})

test('PR-1: V2 Fact層は再現可能で時刻なしFactを混入させない', () => {
  for (const fixture of BIRTH_FIXTURES) {
    const input = buildFixtureReportInput(fixture)
    const metadata = extractReportMetadata(input)
    const options = { factPipeline: 'v2', narrativeEngine: 'legacy' } as const
    const first = buildSelfReport(input, metadata, options)
    const second = buildSelfReport(input, metadata, options)
    assert.deepEqual(first.report, second.report, fixture.id)
    if (fixture.birthTime === null) {
      assert.equal(first.facts.filter(fact => fact.requiresBirthTime).length, 0, fixture.id)
    }
  }
})
