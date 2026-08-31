import assert from 'node:assert/strict'
import test from 'node:test'
import { TIMING_SCORE_KEYS } from './timingClaim.js'
import { SOURCE_FAMILY_CORRELATION_GROUP } from './timingEvidenceContract.js'
import { TIMING_SCORE_DESIGN_CONTRACT } from './timingScoreDesignContract.js'
import { SOURCE_FAMILY_WEIGHTS, type TimingEvidenceDefinition } from './timingScoreEngine.js'
import {
  auditTimingExactManifest,
  assertTimingEvidenceMatchesManifest,
  hashTimingLineageManifest,
  type TimingBuilderRegistration,
  type TimingLineageManifestEntry,
  type TimingSmokeEvidenceProof,
} from './timingExactManifest.js'

const version = 'fixture-v1'
const manifest: TimingLineageManifestEntry[] = TIMING_SCORE_KEYS.flatMap(scoreKey =>
  TIMING_SCORE_DESIGN_CONTRACT[scoreKey].sourceFamilies.map(sourceFamily => ({
    manifestVersion: version,
    factLineageId: `${sourceFamily}:fixture:${scoreKey}`,
    scoreKey,
    sourceFamily,
    correlationGroup: SOURCE_FAMILY_CORRELATION_GROUP[sourceFamily],
    technique: 'fixture',
    maximumContribution: SOURCE_FAMILY_WEIGHTS[sourceFamily],
    polarity: 1 as const,
    expectedStatus: 'connected' as const,
    implementationId: `fixture-builder-${scoreKey}-${sourceFamily}`,
  })),
)
const evidenceFor = (entry: TimingLineageManifestEntry): TimingEvidenceDefinition => ({
  id: `smoke:${entry.factLineageId}`, scoreKey: entry.scoreKey, sourceFamily: entry.sourceFamily,
  correlationGroup: entry.correlationGroup, technique: entry.technique, factLineageId: entry.factLineageId,
  available: true, matched: true, support: 1, maximumContribution: entry.maximumContribution, polarity: entry.polarity,
})
const registry: TimingBuilderRegistration[] = manifest.map(entry => ({
  implementationId: entry.implementationId,
  factLineageIds: [entry.factLineageId],
  buildSmokeEvidence: () => [evidenceFor(entry)],
}))
const smoke: TimingSmokeEvidenceProof[] = manifest.map(entry => ({
  implementationId: entry.implementationId,
  factLineageId: entry.factLineageId,
  scoreKey: entry.scoreKey,
  sourceFamily: entry.sourceFamily,
  correlationGroup: entry.correlationGroup,
  technique: entry.technique,
  maximumContribution: entry.maximumContribution,
  polarity: entry.polarity,
  available: true,
}))
const hash = hashTimingLineageManifest(manifest)

test('exact manifest・registry・smoke・version・hashが完全一致した場合だけreadyになる', () => {
  const result = auditTimingExactManifest(manifest, registry, smoke, version, hash)
  assert.equal(result.ready, true)
  assert.deepEqual(result.errors, [])
})

test('manifest配列の順序では固定hashが変わらない', () => {
  assert.equal(hashTimingLineageManifest([...manifest].reverse()), hash)
})

test('missing・extra・renamed・重複・builder欠落・smoke未生成・hash差を拒否する', () => {
  const removedScore = manifest[0]!.scoreKey
  const changed = manifest.filter(entry => entry.scoreKey !== removedScore).map(entry => ({ ...entry }))
  changed[0]!.factLineageId = 'auxiliary:fixture:renamed'
  changed.push({ ...changed[0]! })
  const brokenRegistry = registry.slice(2).concat([{ implementationId: 'extra-builder', factLineageIds: ['auxiliary:fixture:extra'], buildSmokeEvidence: () => [] }])
  const result = auditTimingExactManifest(changed, brokenRegistry, [], 'wrong-version', 'wrong-hash')
  assert.equal(result.ready, false)
  for (const prefix of ['duplicate:', 'score-missing:', 'version:', 'builder-extra:', 'smoke-missing:', 'hash:']) {
    assert.ok(result.errors.some(error => error.startsWith(prefix)), `${prefix} must be detected`)
  }
})

test('manifest外builderとsmoke出力を拒否する', () => {
  const result = auditTimingExactManifest(
    manifest,
    [...registry, { implementationId: 'rogue', factLineageIds: ['auxiliary:fixture:rogue'], buildSmokeEvidence: () => [] }],
    [...smoke, { ...smoke[0]!, factLineageId: 'auxiliary:fixture:rogue' }],
    version,
    hash,
  )
  assert.equal(result.ready, false)
  assert.ok(result.errors.includes('builder-extra:auxiliary:fixture:rogue'))
  assert.ok(result.errors.includes('smoke-extra:auxiliary:fixture:rogue'))
})

test('upstream_missingだけのmanifestをproduction readyにしない', () => {
  const missing = manifest.map(entry => ({ ...entry, expectedStatus: 'upstream_missing' as const }))
  const result = auditTimingExactManifest(missing, [], [], version, hashTimingLineageManifest(missing))
  assert.equal(result.ready, false)
  assert.ok(result.errors.some(error => error.startsWith('production-status:')))
})

test('builderとlineageのpairwise対応を入れ替えても通さない', () => {
  const swapped = registry.map((entry, index) => ({
    ...entry,
    factLineageIds: registry[(index + 1) % registry.length]!.factLineageIds,
  }))
  const result = auditTimingExactManifest(manifest, swapped, smoke, version, hash)
  assert.equal(result.ready, false)
  assert.ok(result.errors.some(error => error.startsWith('builder-pair-mismatch:')))
})

test('manifestの不正enum・寄与・polarityを自己hashでも拒否する', () => {
  const malformed = manifest.map(entry => ({ ...entry })) as unknown as Array<Record<string, unknown>>
  malformed[0] = { ...malformed[0], correlationGroup: 'invalid', maximumContribution: -1, polarity: 0 }
  const typed = malformed as unknown as TimingLineageManifestEntry[]
  const result = auditTimingExactManifest(typed, registry, smoke, version, hashTimingLineageManifest(typed))
  assert.equal(result.ready, false)
  for (const prefix of ['group-invalid:', 'maximumContribution:', 'polarity:']) {
    assert.ok(result.errors.some(error => error.startsWith(prefix)))
  }
})

test('smokeはlineage名だけでなく実装IDと全metadataの完全一致を要求する', () => {
  const malformed = smoke.map(entry => ({ ...entry }))
  malformed[0] = { ...malformed[0]!, implementationId: 'wrong-builder', maximumContribution: 0.02 }
  const result = auditTimingExactManifest(manifest, registry, malformed, version, hash)
  assert.equal(result.ready, false)
  assert.ok(result.errors.includes(`smoke-metadata:${manifest[0]!.factLineageId}`))
})

test('manifest外の空builderと非connected lineageのbuilderを拒否する', () => {
  const impossible = manifest.map((entry, index) => index === 0
    ? { ...entry, expectedStatus: 'mathematically_impossible' as const }
    : entry)
  const result = auditTimingExactManifest(
    impossible,
    [...registry, { implementationId: 'empty-rogue', factLineageIds: [], buildSmokeEvidence: () => [] }],
    smoke.slice(1),
    version,
    hashTimingLineageManifest(impossible),
  )
  assert.equal(result.ready, false)
  assert.ok(result.errors.includes('builder-extra-implementation:empty-rogue'))
  assert.ok(result.errors.some(error => error.startsWith('builder-nonconnected:')))
})

test('全18スコアがimpossibleだけ、または1スコアだけconnectedなしならreadyにしない', () => {
  const allImpossible = manifest.map(entry => ({ ...entry, expectedStatus: 'mathematically_impossible' as const }))
  const allResult = auditTimingExactManifest(allImpossible, [], [], version, hashTimingLineageManifest(allImpossible))
  assert.equal(allResult.ready, false)
  assert.ok(allResult.errors.some(error => error.startsWith('score-connected-missing:')))

  const target = TIMING_SCORE_KEYS[0]!
  const oneMissing = manifest.map(entry => entry.scoreKey === target
    ? { ...entry, expectedStatus: 'mathematically_impossible' as const }
    : entry)
  const oneRegistry = registry.filter(registration => !registration.factLineageIds.some(lineage => lineage.includes(`:${target}`)))
  const oneSmoke = smoke.filter(proof => proof.scoreKey !== target)
  const oneResult = auditTimingExactManifest(oneMissing, oneRegistry, oneSmoke, version, hashTimingLineageManifest(oneMissing))
  assert.ok(oneResult.errors.includes(`score-connected-missing:${target}`))
})

test('ghost registry、family/group不一致、sentinel version、設計fullMax不一致を拒否する', () => {
  const ghost = registry.map(({ implementationId, factLineageIds }) => ({ implementationId, factLineageIds })) as TimingBuilderRegistration[]
  assert.equal(auditTimingExactManifest(manifest, ghost, smoke, version, hash).ready, false)

  const wrongGroup = manifest.map(entry => ({ ...entry }))
  wrongGroup[0] = { ...wrongGroup[0]!, correlationGroup: 'ziwei_chart' }
  assert.ok(auditTimingExactManifest(wrongGroup, registry, smoke, version, hashTimingLineageManifest(wrongGroup)).errors.some(error => error.startsWith('family-group:')))

  const wrongMax = manifest.map(entry => ({ ...entry }))
  wrongMax[0] = { ...wrongMax[0]!, maximumContribution: wrongMax[0]!.maximumContribution / 2 }
  assert.ok(auditTimingExactManifest(wrongMax, registry, smoke, version, hashTimingLineageManifest(wrongMax)).errors.some(error => error.startsWith('score-fullMax:')))

  const unavailable = manifest.map(entry => ({ ...entry, manifestVersion: 'unavailable' }))
  assert.ok(auditTimingExactManifest(unavailable, registry, smoke, 'unavailable', hashTimingLineageManifest(unavailable)).errors.includes('version-sentinel-populated'))
})

test('手書きsmokeが実builder出力と異なる場合は拒否する', () => {
  const wrongExecutor = registry.map((registration, index) => index === 0
    ? { ...registration, buildSmokeEvidence: () => [] }
    : registration)
  const result = auditTimingExactManifest(manifest, wrongExecutor, smoke, version, hash)
  assert.equal(result.ready, false)
  assert.ok(result.errors.includes('smoke-not-executed-output'))
})

test('runtime Evidenceはcanonical exact setの不足・余分・metadata差を拒否する', () => {
  const definitions = manifest.map(evidenceFor)
  assert.doesNotThrow(() => assertTimingEvidenceMatchesManifest(definitions, manifest))
  assert.throws(() => assertTimingEvidenceMatchesManifest(definitions.slice(1), manifest), /was not produced/)
  assert.throws(() => assertTimingEvidenceMatchesManifest([...definitions, { ...definitions[0]!, id: 'duplicate' }], manifest), /Duplicate/)
  assert.throws(() => assertTimingEvidenceMatchesManifest([{ ...definitions[0]!, correlationGroup: 'ziwei_chart' }, ...definitions.slice(1)], manifest), /metadata mismatch/)
})
