import { mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { PrivateLedger } from './ledger.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateNatalDiagnostic, buildNatalDiagnostic, NATAL_DIAGNOSTIC_CATALOG } from './natalDiagnostic.js'
import type { BirthRevision, Dataset, Subject } from './ledger.js'

const input = { date: '2000-04-10', datePrecision: 'day' as const, time: '12:00', timePrecision: 'exact' as const, timezone: 'Asia/Tokyo' }
test('real calculator to solar Fact to boolean features preserves evidence and false values', () => {
  for (const date of ['2000-04-10', '2000-10-10', '2000-01-10']) {
    const result = calculateNatalDiagnostic({ ...input, date })
    assert.equal(result.facts.length, 1)
    for (const [index, feature] of result.features.entries()) {
      assert.equal(feature.status, 'known')
      const [low, high] = NATAL_DIAGNOSTIC_CATALOG[index].interval
      const longitude = result.facts[0].longitude
      assert.equal(feature.value, longitude >= low && longitude < high)
      assert.deepEqual(feature.evidenceIds, [result.facts[0].id])
    }
  }
})
test('unknown time, timezone, invalid date and unsupported eras are never filled', () => {
  for (const change of [{ time: null }, { timePrecision: 'approximate' as const }, { timezone: null },
    { timezone: 'America/New_York' }, { date: '2000-02-30' }, { time: '24:00' }, { date: '1948-05-10' }]) {
    const result = calculateNatalDiagnostic({ ...input, ...change })
    assert.equal(result.facts.length, 0)
    assert.ok(result.features.every(f => f.status === 'unsupported' && f.value === null && f.evidenceIds.length === 0))
  }
})
test('observed outcomes and names cannot change calculated features or input identity', () => {
  const a = calculateNatalDiagnostic({ ...input, outcome: 'yes', person: 'A' } as typeof input)
  const b = calculateNatalDiagnostic({ ...input, outcome: 'no', person: 'B' } as typeof input)
  assert.deepEqual(a, b)
  assert.notEqual(a.inputHash, calculateNatalDiagnostic({ ...input, time: '13:00' }).inputHash)
})
test('private draft snapshot remains non-training and outside synthetic feature format', () => {
  const birth: BirthRevision = { kind: 'birth', id: 'birth-1', subjectId: 'subject-1', revision: 1, previousRevision: null,
    ...input, place: null, sourceRef: 'synthetic-test', rawStatementRef: 'synthetic-test' }
  const subject: Subject = { kind: 'subject', id: 'subject-1', revision: 1, previousRevision: null, clusterIds: ['synthetic-cluster'], sourceRef: 'synthetic-test', dataUse: { status: 'draft', purposes: [], sourceRef: 'synthetic-test' }, discoveryOnly: true }
  const dataset: Dataset = { schemaVersion: 1, datasetId: 'natal-test', purpose: 'private_draft', records: [subject, birth] }
  const snapshot = buildNatalDiagnostic(dataset)
  assert.throws(() => buildNatalDiagnostic({ ...dataset, records: [birth] }), /linked subject/)
  assert.throws(() => buildNatalDiagnostic({ ...dataset, records: [{ ...subject, dataUse: { ...subject.dataUse, status: 'withdrawn' } }, birth] }), /linked subject/)
  assert.match(snapshot.calculationSourceHash, /^[a-f0-9]{64}$/)
  assert.equal(snapshot.kind, 'natal_calculation_diagnostic')
  assert.equal(snapshot.rows.length, 1)
  assert.equal(snapshot.productionEligible, false)
  assert.equal(snapshot.trainingEligible, false)
  assert.equal(snapshot.qualityEligible, false)
  assert.equal(snapshot.rows[0].features[0].value, true)
  const root = mkdtempSync('/private/tmp/fatelab-natal-test-'), ledger = new PrivateLedger(root)
  ledger.import(dataset, true)
  const { snapshotId } = ledger.snapshot(dataset.datasetId)
  const args = ['--import', 'tsx', 'src/scripts/research/cli.ts', 'natal-diagnostic', '--snapshot', snapshotId]
  const options = { env: { ...process.env, FATELAB_RESEARCH_DATA_DIR: root }, encoding: 'utf8' as const, stdio: 'pipe' as const }
  const result = JSON.parse(execFileSync(process.execPath, args, options))
  assert.equal(result.rows, 1)
  assert.equal(result.productionEligible, false)
  assert.ok(ledger.read(`natal-diagnostic-${result.diagnosticId}.json`))
  ledger.write('revoked-datasets.json', [snapshotId])
  assert.throws(() => execFileSync(process.execPath, args, options))

})
