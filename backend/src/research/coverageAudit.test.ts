import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrivateLedger } from './ledger.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync, readFileSync } from 'node:fs'
import { auditSectionCoverage, type SectionLocatorIndex } from './coverageAudit.js'
import type { Dataset, CoverageRecord } from './ledger.js'
const index = JSON.parse(readFileSync(new URL('./sectionLocatorIndex.json', import.meta.url), 'utf8')) as SectionLocatorIndex
const dataset: Dataset = { schemaVersion: 1, datasetId: 'test', purpose: 'private_draft', records: [] }
const first = index.records[0]
const coverage: CoverageRecord = { kind: 'coverage', id: 'private-record-id', revision: 1, previousRevision: null, observationId: null, sourceDocumentId: first.document, sourceSection: first.sourceId, predicateId: 'private-predicate', semanticConcept: 'private-text', featureIds: [], calculationAvailability: 'unknown', ruleId: null, scoreBindingId: null, claimId: null, assetId: null, implementationStatus: 'needs_review', runtimeEvidence: [], tests: [], adoptionStatus: 'blocked', blockedReason: 'private-reason', decisionOwner: 'developer', modelVersion: null }

test('audit reports 172 section gaps without claiming atomic review', () => {
  const report = auditSectionCoverage(dataset, index)
  assert.equal(report.totalSections, 172)
  assert.equal(report.sectionsWithoutMapping, 172)
  assert.equal(report.unclassified, 0) // zero observations is not full source coverage
  assert.equal(report.atomicReviewComplete, false)
  assert.equal(report.qualityEligible, false)
})
test('known, unknown and pending locators remain distinct; no private contents in output', () => {
  const data = { ...dataset, records: [coverage, { ...coverage, id: 'second-private', sourceSection: 'unknown' }] }
  const before = JSON.stringify(data)
  const report = auditSectionCoverage(data, index)
  assert.equal(report.sectionsWithoutMapping, 171)
  assert.equal(report.sectionsWithPendingReview, 1)
  assert.equal(report.unknownSectionReferences, 1)
  assert.equal(report.unreviewedCoverageRecords, 2)
  assert.doesNotMatch(JSON.stringify(report), /private-record|private-predicate|private-text|private-reason|second-private/)
  assert.equal(JSON.stringify(data), before)
  assert.throws(() => auditSectionCoverage(data, { ...index, records: [first, first] }), /duplicate/)
})


test('developer coverage CLI reads the private ledger without writing a snapshot', () => {
  const root = mkdtempSync(join(tmpdir(), 'fatelab-coverage-'))
  try {
    const store = new PrivateLedger(root)
    store.import(dataset, true)
    const files = readdirSync(root)
    const before = readFileSync(join(root, 'test.json'), 'utf8')
    const run = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../scripts/research/cli.ts', import.meta.url)), 'coverage', '--dataset', 'test'], {
      env: { ...process.env, FATELAB_RESEARCH_DATA_DIR: root }, encoding: 'utf8',
    })
    assert.equal(run.status, 0, run.stderr)
    assert.equal(JSON.parse(run.stdout).sectionsWithoutMapping, 172)
    assert.deepEqual(readdirSync(root), files)
    assert.equal(readFileSync(join(root, 'test.json'), 'utf8'), before)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
