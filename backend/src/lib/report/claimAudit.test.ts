import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClaimStructuredReport, claimRuntimeSalience, type ClaimAuditRow } from './claimComposer.js'
import { CLAIM_ASSETS } from './claimAssets.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { buildSelfReport } from './buildSelfReport.js'
import { extractReportMetadata } from './metadata.js'
import type { ReportFactV2 } from './factsV2.js'
import type { ReportFindingV2 } from './findingsV2.js'
test('audit observes real selection without changing report output', () => {
  const input = buildFixtureReportInput(BIRTH_FIXTURES[0])
  const result = buildSelfReport(input, extractReportMetadata(input))
  const facts = result.facts as ReportFactV2[], findings = result.findings as ReportFindingV2[]
  let rows: readonly ClaimAuditRow[] = []
  const traced = buildClaimStructuredReport(facts, findings, input, value => { rows = value })
  assert.deepEqual(traced, buildClaimStructuredReport(facts, findings, input))
  assert.equal(rows.length, CLAIM_ASSETS.length)
  for (const card of traced.cards) {
    assert.deepEqual(rows.filter(row => row.chapter === card.id && row.reason === 'selected').sort((a, b) => a.section! - b.section!).map(row => row.claimId), card.sections!.map(section => section.claimId))
  }
  assert.ok(rows.filter(row => row.reason === 'selected').every(row => row.runtimeSalience! >= row.floor && row.evidenceFactIds.length > 0))
})
test('a base .65 candidate can cross .70 at runtime; base-only exclusion is invalid', () => {
  assert.ok(Math.abs(claimRuntimeSalience(.65, 1, 1) - .72) < 1e-12)
})

test('shared evidence display preserves every contributing Fact ID in audit and card provenance', () => {
  const input = buildFixtureReportInput(BIRTH_FIXTURES[0])
  const result = buildSelfReport(input, extractReportMetadata(input))
  const first = { ...(result.facts[0] as ReportFactV2), id: 'source-a' }
  const second = { ...first, id: 'source-b', canonicalSourceId: 'distinct-source-b' }
  const finding: ReportFindingV2 = {
    id: 'shared-display-finding', key: 'independence', kind: 'signature', axis: first.axis,
    confidence: 0.9, lineages: [first.lineage], systems: [first.system], independence: 1,
    primaryFacts: [first.id, second.id], supportingFacts: [first.id, 'unresolved-source'],
  }
  let rows: readonly ClaimAuditRow[] = []
  const report = buildClaimStructuredReport([first, second], [finding], input, value => { rows = value })
  const row = rows.find(row => row.claimId === 'lm-01')!
  assert.equal(row.reason, 'selected')
  assert.deepEqual(row.evidenceFactIds, ['source-a', 'source-b'])
  const card = report.cards.find(card => card.id === 'life-mission')!
  assert.ok(card.metadataRefs!.includes('fact:source-a'))
  assert.ok(card.metadataRefs!.includes('fact:source-b'))
  assert.ok(!card.metadataRefs!.includes('fact:unresolved-source'))
  const section = card.sections!.find(section => section.claimId === 'lm-01')!
  assert.equal(section.evidence.length, 1, 'display evidence stays deduplicated')
})

test('axis candidates only fill the chapter minimum after concrete candidates', () => {
  let filledChapters = 0
  for (const fixture of BIRTH_FIXTURES) {
    const input = buildFixtureReportInput(fixture)
    const result = buildSelfReport(input, extractReportMetadata(input))
    let rows: readonly ClaimAuditRow[] = []
    const report = buildClaimStructuredReport(result.facts as ReportFactV2[], result.findings as ReportFindingV2[], input, value => { rows = value })
    for (const card of report.cards) {
      const eligible = rows.filter(row => row.chapter === card.id && ['selected', 'eligible_not_selected'].includes(row.reason))
      const concrete = eligible.filter(row => row.tier !== 'axis')
      const selected = eligible.filter(row => row.reason === 'selected')
      const axis = selected.filter(row => row.tier === 'axis')
      const expectedAxis = Math.min(Math.max(0, 3 - concrete.length), eligible.length - concrete.length)
      assert.equal(axis.length, expectedAxis, `${fixture.id}/${card.id}: axis must only fill the minimum`)
      assert.equal(selected.filter(row => row.tier !== 'axis').length, Math.min(6, concrete.length))
      assert.equal(card.sections!.length, Math.min(6, concrete.length) + expectedAxis)
      if (axis.length > 0) filledChapters += 1
    }
  }
  assert.ok(filledChapters > 0, 'corpus must exercise chapters needing axis support')
})
