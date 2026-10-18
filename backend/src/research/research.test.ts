import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, chmodSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canonical, digest, latest, mergeDataset, PrivateLedger, validateDataset, type Dataset, type Subject, type Observation, type BirthRevision } from './ledger.js'
import { andFeature, buildFeatureSnapshot, SYNTHETIC_FEATURES } from './features.js'
import { evaluate, syntheticPlan } from './evaluation.js'
import { propose, researchSourceLockHash } from './artifact.js'
import { loadStagingArtifact, stagingPrediction, type StagingArtifact, type SignedStagingArtifact } from '../lib/researchStagingModel.js'
function syntheticDataset(count = 240, signal = true): Dataset {
  const records: Dataset['records'] = []
  for (let i = 0; i < count; i++) {
    const id = `s${i}`, a = i % 4 < 2, b = i % 2 === 0
    const p = signal ? (a && b ? .85 : a || b ? .25 : .15) : .5
    const draw = parseInt(digest(['outcome', i]).slice(0, 8), 16) / 0x100000000
    records.push({ kind: 'subject', id, revision: 1, previousRevision: null, clusterIds: [`c${i}`], sourceRef: `synthetic-${i}`,
      dataUse: { status: 'granted', purposes: ['research'], sourceRef: 'synthetic-consent' }, discoveryOnly: false },
      { kind: 'birth', id: `b${i}`, subjectId: id, revision: 1, previousRevision: null, date: `1990-${a ? '03' : '09'}-15`, time: b ? '08:00' : '16:00', timezone: null, place: null, datePrecision: 'day', timePrecision: 'exact', sourceRef: 'synthetic-input', rawStatementRef: 'synthetic' },
      { kind: 'observation', id: `o${i}`, revision: 1, previousRevision: null, domain: 'personality', subjectIds: [id], episodeId: `e${i}`,
        sourceRef: `synthetic-${i}`, rawStatementRef: 'synthetic', observer: 'self', status: 'confirmed',
        interval: { start: '2020-01-01', end: '2021-01-01', precision: 'year' }, observedThrough: '2021-01-01',
        phase: 'reported-trait', direction: null, context: [], outcome: { kind: draw < p ? 'positive' : 'confirmed_negative', targetId: 'toy-target' } })
  }
  return validateDataset({ schemaVersion: 1, datasetId: 'synthetic', purpose: 'synthetic_software_test', records })
}
test('dry-run, duplicate import, immutable corrections, permission and private path', () => {
  const root = mkdtempSync(join(tmpdir(), 'fatelab-research-'))
  try {
    const store = new PrivateLedger(root), dataset = syntheticDataset(2)
    assert.equal(store.import(dataset, false).addedRevisions, 6)
    assert.equal(store.read('synthetic.json'), undefined)
    store.import(dataset, true); assert.equal(store.import(dataset, true).addedRevisions, 0)
    const before = store.snapshot('synthetic').snapshotId
    const first = dataset.records[0] as Subject
    const correction = { ...dataset, records: [{ ...first, revision: 2, previousRevision: 1, dataUse: { ...first.dataUse, status: 'withdrawn' as const } }] }
    store.import(correction, true)
    assert.notEqual(store.snapshot('synthetic').snapshotId, before)
    assert.ok(store.read<string[]>('revoked-datasets.json')!.includes(before))
    assert.equal(buildFeatureSnapshot(store.read<Dataset>('synthetic.json')!).rows[0].eligible, false)
    assert.throws(() => store.import({ ...dataset, records: [{ ...first, discoveryOnly: true }] }, true), /Immutable/)
    assert.throws(() => new PrivateLedger(process.cwd()), /outside/)
    chmodSync(root, 0o755); assert.throws(() => new PrivateLedger(root), /owner-only/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
test('missing and unknown data stay distinct, label edits never change feature values', () => {
  const dataset = syntheticDataset(4), changed = structuredClone(dataset)
  for (const r of changed.records) if (r.kind === 'observation') r.outcome = { kind: 'unknown', reason: 'unobserved' }
  assert.equal(buildFeatureSnapshot(dataset).featureHash, buildFeatureSnapshot(changed).featureHash)
  const birth = changed.records.find(r => r.kind === 'birth') as BirthRevision
  birth.time = null; birth.timePrecision = 'unknown'
  assert.equal(buildFeatureSnapshot(changed).rows[0].features['toy.morning'].status, 'unknown')
  assert.equal(andFeature({ status: 'known', value: false, evidenceIds: [] }, { status: 'unknown', reason: 'missing' }).status, 'known')
  assert.equal(andFeature({ status: 'known', value: true, evidenceIds: [] }, { status: 'unknown', reason: 'missing' }).status, 'unknown')
  assert.throws(() => evaluate({ ...dataset, purpose: 'private_draft' }, syntheticPlan()), /human/)
})
test('unknown, one cluster, discovery-only and single class return no_change', () => {
  for (const change of ['unknown', 'cluster', 'discovery', 'single-class']) {
    const dataset = syntheticDataset(40)
    for (const record of dataset.records) {
      if (record.kind === 'subject' && change === 'cluster') record.clusterIds = ['shared-family']
      if (record.kind === 'subject' && change === 'discovery') record.discoveryOnly = true
      if (record.kind === 'observation' && change === 'unknown') record.outcome = { kind: 'unknown', reason: 'missing' }
      if (record.kind === 'observation' && change === 'single-class') record.outcome = { kind: 'positive', targetId: 'toy-target' }
    }
    assert.equal(evaluate(dataset, syntheticPlan()).status, 'no_change')
  }
})
test('unobserved future cannot be a negative; unknown fields and fake expected scores rejected', () => {
  const dataset = syntheticDataset(1), o = dataset.records.find(r => r.kind === 'observation') as Observation
  o.outcome = { kind: 'confirmed_negative', targetId: 'toy-target' }; o.observedThrough = '2020-01-01'
  assert.throws(() => validateDataset(dataset), /future/)
  const fake = syntheticDataset(1); (fake.records[0] as any).expectedScore = 1
  assert.throws(() => validateDataset(fake), /fields/)
})
test('toy addition → fit/compare → signed staging inference → diff/rollback; tamper and withdrawal rejected', () => {
  const dataset = syntheticDataset(), plan = syntheticPlan()
  const run = evaluate(dataset, plan)
  assert.equal(run.status, 'candidate', run.reason)
  assert.deepEqual(evaluate(dataset, plan), run)
  assert.equal(run.solverResult!.candidates.length, 4)
  const artifact = propose(run) as StagingArtifact
  const pair = generateKeyPairSync('ed25519'), owner = 'synthetic-test-owner'
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const signed = (a: StagingArtifact): SignedStagingArtifact => {
    const checksum = digest(a)
    return { artifact: a, checksum, approval: { owner, stage: 'synthetic_staging', signature: sign(null, Buffer.from(canonical({ checksum, owner, stage: a.stage })), pair.privateKey).toString('base64') } }
  }
  const policy = { ownerPublicKey: publicKey, sourceLockHash: researchSourceLockHash(), catalogHash: digest(SYNTHETIC_FEATURES), revokedDatasetHashes: [] as string[], stage: 'synthetic_staging' as const }
  const approved = signed(artifact), loaded = loadStagingArtifact(approved, policy)
  const result = stagingPrediction(loaded, { 'toy.early_month': true, 'toy.morning': true })
  assert.equal(result.status, 'known')
  for (const [i, vector] of (run.solverResult!.parityInputs as number[][]).entries()) {
    const actual = stagingPrediction(loaded, { 'toy.early_month': Boolean(vector[0]), 'toy.morning': Boolean(vector[1]) })
    assert.ok(actual.status === 'known' && Math.abs(actual.rankingValue - run.solverResult!.parityScores[i]) < 1e-12)
  }
  const updated = mergeDataset(dataset, { ...dataset, records: syntheticDataset(241).records.slice(-3) })
  const nextRun = evaluate(updated, plan)
  assert.equal(nextRun.status, 'candidate')
  const next = loadStagingArtifact(signed(propose(nextRun, artifact.modelVersion) as StagingArtifact), policy)
  assert.notEqual(stagingPrediction(next, { 'toy.early_month': true, 'toy.morning': true }).cacheNamespace, result.cacheNamespace)
  assert.deepEqual(stagingPrediction(loadStagingArtifact(approved, policy), { 'toy.early_month': true, 'toy.morning': true }), result)
  const tampered = structuredClone(approved); tampered.artifact.model.intercept += 1
  assert.throws(() => loadStagingArtifact(tampered, policy), /checksum/)
  assert.throws(() => loadStagingArtifact(approved, { ...policy, revokedDatasetHashes: [artifact.datasetHash] }), /Withdrawn/)
  const wrong = structuredClone(artifact); wrong.model.columns[0] = 'eval:malicious'
  assert.throws(() => loadStagingArtifact(signed(wrong), policy), /operator/)
  const privateField = { ...artifact, privateBirth: 'private' }
  assert.throws(() => loadStagingArtifact(signed(privateField), policy), /fields/)
  assert.ok(!canonical(artifact).includes('subjectIds'))
  assert.equal(stagingPrediction(loaded, { 'toy.early_month': null, 'toy.morning': true }).status, 'unknown')
})
test('fixed null control does not mandate a changed model', () => {
  const dataset = syntheticDataset(800, false)
  const result = evaluate(dataset, syntheticPlan())
  assert.equal(result.status, 'no_change')
})


test('CLI import through signed export and rollback works without production access', () => {
  const root = mkdtempSync(join(tmpdir(), 'fatelab-cli-'))
  try {
    const cli = fileURLToPath(new URL('../scripts/research/cli.ts', import.meta.url))
    const pair = generateKeyPairSync('ed25519')
    const publicKeyPath = join(root, 'owner.pem')
    writeFileSync(publicKeyPath, pair.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o600 })
    const env = { ...process.env, FATELAB_RESEARCH_DATA_DIR: root, FATELAB_RESEARCH_OWNER_PUBLIC_KEY_FILE: publicKeyPath }
    const call = (args: string[], expected = 0) => {
      const result = spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], { env, encoding: 'utf8', timeout: 60_000 })
      assert.equal(result.status, expected, result.stderr)
      return JSON.parse(expected === 0 ? result.stdout : result.stderr)
    }
    const input = join(root, 'input.json'), plan = join(root, 'plan.json')
    writeFileSync(input, JSON.stringify(syntheticDataset()), { mode: 0o600 })
    writeFileSync(plan, JSON.stringify(syntheticPlan()), { mode: 0o600 })
    call(['import', '--input', input, '--dry-run']); call(['import', '--input', input, '--commit'])
    const snapshot = call(['snapshot', '--dataset', 'synthetic']).snapshotId
    const features = call(['features', '--snapshot', snapshot, '--canon', 'synthetic-software-test']).featureSnapshotId
    const run = call(['evaluate', '--features', features, '--plan', plan]).runId
    const candidate = call(['propose', '--run', run]).candidateId
    call(['export', '--approved', candidate], 1)
    const owner = 'cli-synthetic-owner', stage = 'synthetic_staging'
    const approval = join(root, 'approval.json')
    writeFileSync(approval, JSON.stringify({ owner, stage, signature: sign(null, Buffer.from(canonical({ checksum: candidate, owner, stage })), pair.privateKey).toString('base64') }), { mode: 0o600 })
    call(['approve', '--candidate', candidate, '--approval-file', approval])
    call(['export', '--approved', candidate, '--output', join(root, 'export.json')])
    call(['activate', '--artifact', candidate]); call(['rollback', '--artifact', candidate])
    assert.equal(call(['diff', '--old', candidate, '--new', candidate]).length, 4)
    const exported = JSON.parse(readFileSync(join(root, 'export.json'), 'utf8'))
    assert.equal(exported.artifact.stage, 'synthetic_staging')
    assert.equal(JSON.stringify(exported).includes('synthetic@example'), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('all 172 source sections retain locators, without claiming atomic equivalence', () => {
  const index = JSON.parse(readFileSync(new URL('./sectionLocatorIndex.json', import.meta.url), 'utf8'))
  assert.equal(index.records.length, 172)
  assert.equal(index.atomicReviewComplete, false)
  assert.ok(index.records.every((record: any) => record.sourceLines && record.status === 'needs_review'))
})
