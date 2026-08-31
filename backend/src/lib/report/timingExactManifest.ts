import { createHash } from 'node:crypto'
import { TIMING_SCORE_KEYS, type TimingScoreKey } from './timingClaim.js'
import { isCanonicalFamilyGroup } from './timingEvidenceContract.js'
import { TIMING_SCORE_DESIGN_CONTRACT } from './timingScoreDesignContract.js'
import { SOURCE_FAMILY_WEIGHTS, type CorrelationGroup, type SourceFamily, type TimingEvidenceDefinition } from './timingScoreEngine.js'

export type TimingLineageExpectedStatus = 'connected' | 'upstream_missing' | 'mathematically_impossible'

export interface TimingLineageManifestEntry {
  manifestVersion: string
  factLineageId: string
  scoreKey: TimingScoreKey
  sourceFamily: SourceFamily
  correlationGroup: CorrelationGroup
  technique: string
  maximumContribution: number
  polarity: 1 | -1
  expectedStatus: TimingLineageExpectedStatus
  implementationId: string
}

export interface TimingBuilderRegistration {
  implementationId: string
  /** 当該builderが生成を許可されるlineageのexact set。 */
  factLineageIds: readonly string[]
  /** canonical fixtureを実コードへ通した結果。手書きmetadataをsmoke証明にしない。 */
  buildSmokeEvidence: () => readonly TimingEvidenceDefinition[]
}

export interface TimingSmokeEvidenceProof {
  implementationId: string
  factLineageId: string
  scoreKey: TimingScoreKey
  sourceFamily: SourceFamily
  correlationGroup: CorrelationGroup
  technique: string
  maximumContribution: number
  polarity: 1 | -1
  available: boolean
}

export interface TimingExactManifestAudit {
  manifestHash: string
  errors: readonly string[]
  ready: boolean
}

/** A-D正本未受領。正本manifestをコミットしたPRでのみ実値へ置き換える。 */
export const TIMING_EXACT_MANIFEST_HASH: string | null = null
export const TIMING_EXACT_MANIFEST_VERSION = 'unavailable'
export const CANONICAL_TIMING_MANIFEST: readonly TimingLineageManifestEntry[] = []
export const TIMING_BUILDER_REGISTRY: readonly TimingBuilderRegistration[] = []
export const TIMING_SMOKE_PROOF: readonly TimingSmokeEvidenceProof[] = []

export function assertTimingManifestHash(actualHash: string | null, expectedProductionHash: string | undefined): void {
  if (!actualHash || !/^[a-f0-9]{64}$/.test(actualHash)) throw new Error('Timing exact manifest hash is not available')
  if (!expectedProductionHash || !/^[a-f0-9]{64}$/.test(expectedProductionHash)) throw new Error('TIMING_V2_MANIFEST_HASH is missing or invalid')
  if (actualHash !== expectedProductionHash) throw new Error(`Timing manifest hash mismatch: actual=${actualHash}; expected=${expectedProductionHash}`)
}

const identity = (entry: Pick<TimingLineageManifestEntry, 'scoreKey' | 'factLineageId' | 'polarity'>) =>
  `${entry.scoreKey}\u0000${entry.factLineageId}\u0000${entry.polarity}`

const SCORE_KEYS = new Set<string>(TIMING_SCORE_KEYS)
const SOURCE_FAMILIES = new Set<string>(Object.keys(SOURCE_FAMILY_WEIGHTS))
const CORRELATION_GROUPS = new Set<string>(['astronomical_ephemeris', 'stem_branch_calendar', 'ziwei_chart', 'independent_auxiliary'])
const EXPECTED_STATUSES = new Set<string>(['connected', 'upstream_missing', 'mathematically_impossible'])

function validateManifestEntry(entry: TimingLineageManifestEntry, expectedManifestVersion: string): string[] {
  const errors: string[] = []
  const id = typeof entry.factLineageId === 'string' ? entry.factLineageId : String(entry.factLineageId)
  if (typeof entry.manifestVersion !== 'string' || !entry.manifestVersion.trim() || entry.manifestVersion !== expectedManifestVersion) errors.push(`version:${id}`)
  if (!SCORE_KEYS.has(entry.scoreKey)) errors.push(`score-invalid:${id}`)
  if (!SOURCE_FAMILIES.has(entry.sourceFamily)) errors.push(`family-invalid:${id}`)
  if (!CORRELATION_GROUPS.has(entry.correlationGroup)) errors.push(`group-invalid:${id}`)
  if (SOURCE_FAMILIES.has(entry.sourceFamily) && CORRELATION_GROUPS.has(entry.correlationGroup)
    && !isCanonicalFamilyGroup(entry.sourceFamily, entry.correlationGroup)) errors.push(`family-group:${id}`)
  if (typeof entry.technique !== 'string' || !entry.technique.trim()) errors.push(`technique-empty:${id}`)
  if (typeof entry.factLineageId !== 'string' || !entry.factLineageId.trim()) errors.push(`lineage-empty:${id}`)
  if (typeof entry.implementationId !== 'string' || !entry.implementationId.trim()) errors.push(`implementation-empty:${id}`)
  if (entry.polarity !== 1 && entry.polarity !== -1) errors.push(`polarity:${id}`)
  if (!EXPECTED_STATUSES.has(entry.expectedStatus)) errors.push(`status-invalid:${id}`)
  const familyLimit = SOURCE_FAMILY_WEIGHTS[entry.sourceFamily as SourceFamily]
  if (!Number.isFinite(entry.maximumContribution) || entry.maximumContribution <= 0 || familyLimit === undefined || entry.maximumContribution > familyLimit) {
    errors.push(`maximumContribution:${id}`)
  }
  if (typeof entry.factLineageId === 'string' && typeof entry.sourceFamily === 'string' && typeof entry.technique === 'string'
    && !entry.factLineageId.startsWith(`${entry.sourceFamily}:${entry.technique}:`)) errors.push(`identity:${id}`)
  return errors
}

/** 配列順に依存しないproduction固定用SHA-256。 */
export function hashTimingLineageManifest(entries: readonly TimingLineageManifestEntry[]): string {
  const canonical = [...entries]
    .sort((a, b) => identity(a).localeCompare(identity(b)))
    .map(entry => ({
      manifestVersion: entry.manifestVersion,
      factLineageId: entry.factLineageId,
      scoreKey: entry.scoreKey,
      sourceFamily: entry.sourceFamily,
      correlationGroup: entry.correlationGroup,
      technique: entry.technique,
      maximumContribution: entry.maximumContribution,
      polarity: entry.polarity,
      expectedStatus: entry.expectedStatus,
      implementationId: entry.implementationId,
    }))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

/**
 * A-D正本受領後に使う完全一致監査。現在の26件カタログを正本へ昇格させるものではない。
 * manifest・builder registry・smoke fixtureの3者が同じlineage exact setを持つまでreadyにしない。
 */
export function auditTimingExactManifest(
  manifest: readonly TimingLineageManifestEntry[],
  registry: readonly TimingBuilderRegistration[],
  smokeProof: readonly TimingSmokeEvidenceProof[],
  expectedManifestVersion: string,
  expectedManifestHash: string,
): TimingExactManifestAudit {
  const errors: string[] = []
  const expectedScores = new Set<string>(TIMING_SCORE_KEYS)
  const actualScores = new Set<string>()
  const manifestIdentities = new Set<string>()
  const manifestLineages = new Set<string>()
  const manifestImplementationIds = new Set<string>()
  const manifestEntryByLineage = new Map<string, TimingLineageManifestEntry>()
  const implementationIds = new Set<string>()

  if (manifest.length > 0 && expectedManifestVersion === 'unavailable') errors.push('version-sentinel-populated')

  for (const entry of manifest) {
    errors.push(...validateManifestEntry(entry, expectedManifestVersion))
    actualScores.add(entry.scoreKey)
    const key = identity(entry)
    if (manifestIdentities.has(key)) errors.push(`duplicate:${entry.scoreKey}:${entry.factLineageId}:${entry.polarity}`)
    manifestIdentities.add(key)
    if (manifestLineages.has(entry.factLineageId)) errors.push(`lineage-reused:${entry.factLineageId}`)
    manifestLineages.add(entry.factLineageId)
    manifestImplementationIds.add(entry.implementationId)
    manifestEntryByLineage.set(entry.factLineageId, entry)
    if (entry.expectedStatus === 'upstream_missing') errors.push(`production-status:${entry.factLineageId}:upstream_missing`)
  }

  for (const score of expectedScores) if (!actualScores.has(score)) errors.push(`score-missing:${score}`)
  for (const score of actualScores) if (!expectedScores.has(score)) errors.push(`score-extra:${score}`)
  for (const score of TIMING_SCORE_KEYS) {
    const connected = manifest.filter(entry => entry.scoreKey === score && entry.expectedStatus === 'connected')
    if (connected.length === 0) errors.push(`score-connected-missing:${score}`)
    const positive = connected.filter(entry => entry.polarity > 0)
    const actualFamilies = [...new Set(positive.map(entry => entry.sourceFamily))].sort()
    const expectedFamilies = [...TIMING_SCORE_DESIGN_CONTRACT[score].sourceFamilies].sort()
    if (actualFamilies.join('\u0000') !== expectedFamilies.join('\u0000')) errors.push(`score-families:${score}`)
    const familyPotential = (family: SourceFamily) => Math.min(
      SOURCE_FAMILY_WEIGHTS[family],
      positive.filter(entry => entry.sourceFamily === family).reduce((sum, entry) => sum + entry.maximumContribution, 0),
    )
    const western = familyPotential('western')
    const vedic = familyPotential('vedic')
    const fullMax = Math.max(western, vedic) + 0.6 * Math.min(western, vedic)
      + familyPotential('stem_branch') + familyPotential('ziwei') + familyPotential('auxiliary')
    if (Math.abs(fullMax - TIMING_SCORE_DESIGN_CONTRACT[score].fullMax) > 1e-9) errors.push(`score-fullMax:${score}:${fullMax}`)
  }

  const registeredLineages = new Set<string>()
  const registeredPairs = new Set<string>()
  for (const registration of registry) {
    if (typeof registration.implementationId !== 'string' || !registration.implementationId.trim()) errors.push('builder-id-empty')
    if (typeof registration.buildSmokeEvidence !== 'function') errors.push(`builder-executor-missing:${registration.implementationId}`)
    if (implementationIds.has(registration.implementationId)) errors.push(`builder-duplicate:${registration.implementationId}`)
    implementationIds.add(registration.implementationId)
    if (!manifestImplementationIds.has(registration.implementationId)) errors.push(`builder-extra-implementation:${registration.implementationId}`)
    for (const lineage of registration.factLineageIds) {
      const pair = `${registration.implementationId}\u0000${lineage}`
      if (registeredPairs.has(pair)) errors.push(`builder-pair-duplicate:${registration.implementationId}:${lineage}`)
      registeredPairs.add(pair)
      if (registeredLineages.has(lineage)) errors.push(`builder-lineage-duplicate:${lineage}`)
      registeredLineages.add(lineage)
      if (!manifestLineages.has(lineage)) errors.push(`builder-extra:${lineage}`)
      else if (manifestEntryByLineage.get(lineage)?.expectedStatus !== 'connected') errors.push(`builder-nonconnected:${registration.implementationId}:${lineage}`)
    }
  }
  for (const entry of manifest) {
    if (entry.expectedStatus === 'connected') {
      if (!implementationIds.has(entry.implementationId)) errors.push(`builder-missing:${entry.implementationId}`)
      if (!registeredLineages.has(entry.factLineageId)) errors.push(`lineage-missing:${entry.factLineageId}`)
      if (!registeredPairs.has(`${entry.implementationId}\u0000${entry.factLineageId}`)) errors.push(`builder-pair-mismatch:${entry.implementationId}:${entry.factLineageId}`)
    }
  }

  const expectedConnected = new Map(manifest.filter(entry => entry.expectedStatus === 'connected').map(entry => [identity(entry), entry]))
  const executedSmoke: TimingSmokeEvidenceProof[] = []
  for (const registration of registry) {
    if (typeof registration.buildSmokeEvidence !== 'function') continue
    let output: readonly TimingEvidenceDefinition[]
    try {
      output = registration.buildSmokeEvidence()
    } catch {
      errors.push(`builder-execution-failed:${registration.implementationId}`)
      continue
    }
    if (!Array.isArray(output)) {
      errors.push(`builder-output-invalid:${registration.implementationId}`)
      continue
    }
    for (const evidence of output) executedSmoke.push({
      implementationId: registration.implementationId,
      factLineageId: evidence.factLineageId,
      scoreKey: evidence.scoreKey,
      sourceFamily: evidence.sourceFamily,
      correlationGroup: evidence.correlationGroup,
      technique: evidence.technique,
      maximumContribution: evidence.maximumContribution,
      polarity: evidence.polarity ?? 1,
      available: evidence.available,
    })
  }
  const proofKey = (proof: TimingSmokeEvidenceProof) => JSON.stringify({
    implementationId: proof.implementationId, factLineageId: proof.factLineageId, scoreKey: proof.scoreKey,
    sourceFamily: proof.sourceFamily, correlationGroup: proof.correlationGroup, technique: proof.technique,
    maximumContribution: proof.maximumContribution, polarity: proof.polarity, available: proof.available,
  })
  const declaredProofs = [...smokeProof].map(proofKey).sort()
  const actualProofs = executedSmoke.map(proofKey).sort()
  if (declaredProofs.join('\u0000') !== actualProofs.join('\u0000')) errors.push('smoke-not-executed-output')
  const smokeIdentities = new Set<string>()
  for (const proof of smokeProof) {
    const key = identity(proof)
    if (smokeIdentities.has(key)) errors.push(`smoke-duplicate:${proof.factLineageId}:${proof.polarity}`)
    smokeIdentities.add(key)
    const expected = expectedConnected.get(key)
    if (!expected) {
      errors.push(`smoke-extra:${proof.factLineageId}`)
      continue
    }
    if (proof.available !== true) errors.push(`smoke-unavailable:${proof.factLineageId}`)
    if (proof.implementationId !== expected.implementationId
      || proof.scoreKey !== expected.scoreKey
      || proof.sourceFamily !== expected.sourceFamily
      || proof.correlationGroup !== expected.correlationGroup
      || proof.technique !== expected.technique
      || proof.maximumContribution !== expected.maximumContribution
      || proof.polarity !== expected.polarity) errors.push(`smoke-metadata:${proof.factLineageId}`)
  }
  for (const [key, entry] of expectedConnected) if (!smokeIdentities.has(key)) errors.push(`smoke-missing:${entry.factLineageId}`)

  const manifestHash = hashTimingLineageManifest(manifest)
  if (manifestHash !== expectedManifestHash) errors.push(`hash:${manifestHash}`)
  return { manifestHash, errors, ready: errors.length === 0 }
}

/** production pipelineが出した全Evidenceを、監査済みconnected manifestへ完全照合する。 */
export function assertTimingEvidenceMatchesManifest(
  definitions: readonly TimingEvidenceDefinition[],
  manifest: readonly TimingLineageManifestEntry[] = CANONICAL_TIMING_MANIFEST,
): void {
  const connected = new Map(manifest.filter(entry => entry.expectedStatus === 'connected').map(entry => [identity(entry), entry]))
  const produced = new Set<string>()
  for (const evidence of definitions) {
    const key = identity({ scoreKey: evidence.scoreKey, factLineageId: evidence.factLineageId, polarity: evidence.polarity ?? 1 })
    if (produced.has(key)) throw new Error(`Duplicate canonical timing evidence: ${evidence.factLineageId}`)
    produced.add(key)
    const expected = connected.get(key)
    if (!expected) throw new Error(`Timing evidence is outside canonical manifest: ${evidence.factLineageId}`)
    if (evidence.sourceFamily !== expected.sourceFamily || evidence.correlationGroup !== expected.correlationGroup
      || evidence.technique !== expected.technique || evidence.maximumContribution !== expected.maximumContribution) {
      throw new Error(`Timing evidence metadata mismatch: ${evidence.factLineageId}`)
    }
  }
  for (const [key, expected] of connected) if (!produced.has(key)) {
    throw new Error(`Canonical timing evidence was not produced: ${expected.factLineageId}`)
  }
}

export function auditCanonicalTimingManifest(): TimingExactManifestAudit {
  return auditTimingExactManifest(
    CANONICAL_TIMING_MANIFEST,
    TIMING_BUILDER_REGISTRY,
    TIMING_SMOKE_PROOF,
    TIMING_EXACT_MANIFEST_VERSION,
    TIMING_EXACT_MANIFEST_HASH ?? '',
  )
}

export function assertCanonicalTimingManifestReadyForProduction(): TimingExactManifestAudit {
  const audit = auditCanonicalTimingManifest()
  if (!audit.ready) throw new Error(`Timing exact manifest is not ready: ${audit.errors.join(',') || 'unknown'}`)
  return audit
}
