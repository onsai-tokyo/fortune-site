import test from 'node:test'
import assert from 'node:assert/strict'
import { traceReviewClaims } from './readingReviewEvidence.js'
import { reviewTargets } from './readingReview.js'
import { buildFixtureReportInput, BIRTH_FIXTURES } from '../lib/report/fixtures.js'
import { buildSelfReport } from '../lib/report/buildSelfReport.js'
import { extractReportMetadata } from '../lib/report/metadata.js'
import type { ReportFactV2 } from '../lib/report/factsV2.js'
import type { ReportFindingV2 } from '../lib/report/findingsV2.js'

test('selector trace separates finding votes from score-only evidence without dropping provenance',()=>{
 const input=buildFixtureReportInput(BIRTH_FIXTURES[0]),result=buildSelfReport(input,extractReportMetadata(input))
 const before=structuredClone(result)
 const traces=traceReviewClaims(input,result.facts as ReportFactV2[],result.findings as ReportFindingV2[])
 assert.ok(traces.size)
 for(const trace of traces.values()){
  assert.equal(trace.statisticalValidation,'not_estimated')
  assert.equal(trace.interpretationStatus,'editorial_hypothesis')
  const triggers=new Set([...trace.primary,...trace.supporting].map(f=>f.id))
  assert.ok(trace.scoreOnly.every(f=>!triggers.has(f.id)))
  assert.deepEqual([...new Set([...triggers,...trace.scoreOnly.map(f=>f.id)])].sort(),[...new Set(trace.selection.evidenceFactIds)].sort())
 }
 assert.deepEqual(result,before)
})

test('a chapter summary uses its actual lead claim, not the evidence union of other claims',()=>{
 const input=buildFixtureReportInput(BIRTH_FIXTURES[0]),result=buildSelfReport(input,extractReportMetadata(input))
 const traces=traceReviewClaims(input,result.facts as ReportFactV2[],result.findings as ReportFindingV2[])
 const targets=reviewTargets(result.report.cards,traces)
 for(const card of result.report.cards.filter(c=>c.kind==='essence')){
  const first=card.sections![0],summary=targets.find(t=>t.id===`${card.id}/summary`)!
  assert.equal(summary.claimID,first.claimId)
  assert.deepEqual(summary.evidence,first.evidence)
  assert.deepEqual(summary.selectionTrace,traces.get(first.claimId!))
  for(const t of targets.filter(t=>t.cardID===card.id))assert.equal(t.selectionTrace?.claimID,t.claimID)
 }
 // Availability must be explicit for old snapshots; no trace is fabricated.
 assert.ok(reviewTargets(result.report.cards).every(t=>!t.selectionTrace))
})
