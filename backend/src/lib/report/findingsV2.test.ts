import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportFactV2 } from './factsV2.js'
import { buildReportFindingsV2, factsShareSource, weightedDerivationOverlap } from './findingsV2.js'

function fact(id: string, overrides: Partial<ReportFactV2> = {}): ReportFactV2 {
  return {
    id, system: '四柱推命', lineage: 'shichu', factor: id, axis: 'drive', signal: 'independence', polarity: 1,
    strength: 0.8, requiresBirthTime: false, signature: false, votesInConsensus: true,
    derivations: [{ key: 'day-stem', weight: 1 }], canonicalSourceId: 'day-stem',
    ...overrides,
  }
}

test('由来の重み付き重複率を設計式どおり計算する', () => {
  assert.equal(weightedDerivationOverlap(
    [{ key: 'day-stem', weight: 1 }],
    [{ key: 'day-stem', weight: 1 }, { key: 'month-pillar', weight: 0.3 }],
  ), 1)
  assert.equal(weightedDerivationOverlap(
    [{ key: 'month-pillar', weight: 1 }, { key: 'day-stem', weight: 0.4 }],
    [{ key: 'day-stem', weight: 1 }],
  ), 0.4)
})

test('canonicalSourceIdが同じFactは系統が異なっても1票へ統合する', () => {
  const left = fact('left')
  const right = fact('right', { lineage: 'lunar', system: '紫微斗数', derivations: [{ key: 'lunar-date', weight: 1 }], canonicalSourceId: 'day-stem' })
  assert.equal(factsShareSource(left, right), true)
  assert.deepEqual(buildReportFindingsV2([left, right]), [])
})

test('由来の独立票へ統合後、2系統以上のみ合議を作る', () => {
  const findings = buildReportFindingsV2([
    fact('shichu'),
    fact('sanmei', { system: '算命学', derivations: [{ key: 'day-stem', weight: 1 }, { key: 'month-pillar', weight: 0.3 }] }),
    fact('western', { system: '西洋占星術', lineage: 'ephemeris', derivations: [{ key: 'solar-longitude', weight: 1 }], canonicalSourceId: 'solar-longitude', strength: 0.7 }),
  ])
  assert.equal(findings.length, 1)
  assert.deepEqual(findings[0].lineages.sort(), ['ephemeris', 'shichu'])
  assert.deepEqual(findings[0].systems, ['四柱推命', '西洋占星術', '算命学'].sort())
  assert.equal(findings[0].primaryFacts.length, 2)
  assert.equal(findings[0].supportingFacts.length, 1)
  assert.equal(findings[0].independence, 2 / 3)
  assert.ok(findings[0].confidence <= 0.95)
})

test('納音などvotesInConsensus=falseのFactは合議票から除外する', () => {
  const findings = buildReportFindingsV2([
    fact('stems'),
    fact('nayin', { system: '納音', votesInConsensus: false, canonicalSourceId: 'year-pillar', derivations: [{ key: 'year-pillar', weight: 1 }] }),
    fact('lunar', { system: '宿曜', lineage: 'lunar', canonicalSourceId: 'lunar-date', derivations: [{ key: 'lunar-date', weight: 1 }] }),
  ])
  assert.equal(findings.length, 1)
  assert.equal(findings[0].primaryFacts.includes('nayin'), false)
  assert.equal(findings[0].supportingFacts.includes('nayin'), false)
})

test('単一占術の極端値はsignature Findingとして保持する', () => {
  const findings = buildReportFindingsV2([fact('signature', { signature: true, strength: 1 })])
  assert.equal(findings.length, 1)
  assert.equal(findings[0].kind, 'signature')
  assert.equal(findings[0].confidence, 0.95)
  assert.equal(findings[0].independence, 1)
})
