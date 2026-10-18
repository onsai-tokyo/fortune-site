import assert from 'node:assert/strict'
import { measureClaimDiversity } from '../lib/report/qualityMetrics.js'
import { CLAIM_ASSETS } from '../lib/report/claimAssets.js'
import { buildClaimStructuredReport, type ClaimAuditRow } from '../lib/report/claimComposer.js'
import { buildSelfReport } from '../lib/report/buildSelfReport.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from '../lib/report/fixtures.js'
import { extractReportMetadata } from '../lib/report/metadata.js'
import type { ReportFindingV2 } from '../lib/report/findingsV2.js'
import type { ReportFactV2 } from '../lib/report/factsV2.js'

// Diagnostics use the runtime selector, including score aliasing, actual salience,
// floor, forbidden text, tiers and seeded rotation. No parallel audit selector.
const rows: (ClaimAuditRow & { fixtureIndex: number })[] = []
const chapters: number[] = []
for (const [fixtureIndex, fixture] of BIRTH_FIXTURES.entries()) {
  const input = buildFixtureReportInput(fixture)
  const result = buildSelfReport(input, extractReportMetadata(input))
  const report = buildClaimStructuredReport(result.facts as ReportFactV2[], result.findings as ReportFindingV2[], input,
    trace => rows.push(...trace.map(row => ({ ...row, fixtureIndex }))))
  const ids = (cards: typeof report.cards) => cards.filter(card => card.tab === 'essence').map(card => ({
    chapter: card.id, ids: (card.sections ?? []).map(section => section.claimId),
  }))
  assert.deepEqual(ids(report.cards), ids(result.report.cards), `runtime parity at fixture ${fixtureIndex}`)
  chapters.push(report.cards.filter(card => card.tab === 'essence').length)
}
assert.equal(rows.length, CLAIM_ASSETS.length * BIRTH_FIXTURES.length)
const assets = CLAIM_ASSETS.map(asset => {
  const candidates = rows.filter(row => row.claimId === asset.id)
  const selected = candidates.filter(row => row.reason === 'selected').length
  const matched = candidates.filter(row => row.findingId !== null).length
  return { claimId: asset.id, typeLabel: asset.typeLabel, selected, matched,
    diagnosis: selected ? 'selected' : matched ? 'see_runtime_exclusion_reasons' : 'undiagnosed',
    reasons: Object.fromEntries([...new Set(candidates.map(row => row.reason))].map(reason => [reason, candidates.filter(row => row.reason === reason).length])) }
})
const samples = BIRTH_FIXTURES.map((fixture, fixtureIndex) => ({
  id: fixture.id, rows: rows.filter(row => row.fixtureIndex === fixtureIndex),
}))
// Fixed seeded permutations expose prefix-coverage sensitivity; runtime birth seeds stay unchanged.
const orderFor = (seed: number) => {
  const ordered = [...samples]
  let state = seed >>> 0
  for (let i = ordered.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
  }
  return ordered
}
const diversity = [1, 42, 20260905].map(orderSeed => {
  const metrics = measureClaimDiversity(orderFor(orderSeed), CLAIM_ASSETS)
  assert.deepEqual(metrics, measureClaimDiversity(orderFor(orderSeed), CLAIM_ASSETS))
  return { orderSeed, ...metrics }
})
console.log(JSON.stringify({ schemaVersion: 2, purpose: 'selection_diagnostics', qualityEligible: false,
  summary: { totalAssets: CLAIM_ASSETS.length, fixtures: BIRTH_FIXTURES.length, candidateRows: rows.length,
    runtimeParity: true, chapterCounts: chapters, allEightChapters: chapters.every(count => count === 8),
    typeLabelCount: new Set(CLAIM_ASSETS.map(asset => asset.typeLabel)).size,
    baseBelowFloorButRuntimeEligible: rows.filter(row => row.baseSalience < row.floor && row.runtimeSalience !== null && row.runtimeSalience >= row.floor).length },
  diversity, assets, rows,
}, null, 2))
