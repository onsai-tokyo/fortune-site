import test from 'node:test'
import assert from 'node:assert/strict'
import { coverageSummary, mergeDataset, type Dataset, type CoverageRecord } from './ledger.js'
const empty: Dataset = { schemaVersion: 1, datasetId: 'coverage-test', purpose: 'private_draft', records: [] }
const dataset: Dataset = { ...empty, records: [
  { kind: 'subject', id: 's1', revision: 1, previousRevision: null, clusterIds: ['c1'], sourceRef: 'synthetic-source', dataUse: { status: 'draft', purposes: [], sourceRef: 'synthetic-permission' }, discoveryOnly: true },
  { kind: 'observation', id: 'o1', revision: 1, previousRevision: null, domain: 'personality', subjectIds: ['s1'], episodeId: 'e1', sourceRef: 'synthetic-source', rawStatementRef: 'synthetic-raw', observer: 'self', status: 'draft', interval: { start: null, end: null, precision: 'unknown' }, observedThrough: null, phase: 'reported', direction: null, context: [], outcome: { kind: 'unknown', reason: 'not evaluated' } },
] }
const coverage: CoverageRecord = { kind: 'coverage', id: 'cv1', revision: 1, previousRevision: null, observationId: 'o1', sourceDocumentId: 'synthetic-doc', sourceSection: 'synthetic-section', predicateId: 'predicate1', semanticConcept: 'synthetic-concept', featureIds: [], calculationAvailability: 'unknown', ruleId: null, scoreBindingId: null, claimId: null, assetId: null, implementationStatus: 'needs_review', runtimeEvidence: [], tests: [], adoptionStatus: 'blocked', blockedReason: 'pending review', decisionOwner: 'developer', modelVersion: null }

test('needs_review cannot clear unclassified observations; corrections remain immutable', () => {
  const original = mergeDataset(empty, dataset)
  assert.equal(coverageSummary(original).unclassified, 1)
  const pending = mergeDataset(original, { ...empty, records: [coverage] })
  assert.equal(coverageSummary(pending).observationsWithoutCoverage, 0)
  assert.equal(coverageSummary(pending).unclassified, 1)
  assert.equal(coverageSummary(pending).unreviewedCoverageRecords, 1)
  const reviewed = mergeDataset(pending, { ...empty, records: [{ ...coverage, revision: 2, previousRevision: 1, implementationStatus: 'blocked_canon' }] })
  assert.equal(coverageSummary(reviewed).unclassified, 0)
  assert.equal(coverageSummary(reviewed).supported, 0)
  assert.equal(coverageSummary(pending).unclassified, 1)
  const mixed = mergeDataset(reviewed, { ...empty, records: [{ ...coverage, id: 'cv2', predicateId: 'predicate2' }] })
  assert.equal(coverageSummary(mixed).unclassified, 1)
  assert.deepEqual(reviewed.records.filter(r => r.kind === 'observation'), dataset.records.filter(r => r.kind === 'observation'))
})
test('coverage references require an existing observation; section-only coverage stays separate', () => {
  assert.throws(() => mergeDataset(empty, { ...dataset, records: [...dataset.records, { ...coverage, observationId: 'missing' }] }), /Missing coverage observation/)
  const sectionOnly = mergeDataset(empty, { ...dataset, records: [...dataset.records, { ...coverage, observationId: null }] })
  assert.equal(coverageSummary(sectionOnly).unclassified, 1)
  assert.equal(coverageSummary(sectionOnly).unreviewedCoverageRecords, 1)
})
