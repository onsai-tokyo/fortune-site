import { verify } from 'node:crypto'
import { canonical, digest } from './artifactIdentity.js'
// Intentionally not referenced by production composition roots. Synthetic contract
// tests do not authorize a target binding in the live report engine (D01/D03 pending).
export interface StagingArtifact {
  schemaVersion: 1; kind: 'empirical_target_model'; stage: 'synthetic_staging'
  modelVersion: string; parentVersion: string | null; runHash: string; datasetHash: string
  featureHash: string; planHash: string; catalogHash: string; sourceLockHash: string
  canonVersion: 'synthetic-software-test'; engineVersion: 'toy-v1'; selectorVersion: 'toy-v1'; assetVersion: 'toy-v1'
  binding: { mode: 'shadow_only'; targetId: 'toy-target'; requiredCapabilities: ['synthetic_inputs'] }
  model: { columns: string[]; intercept: number; coefficients: number[] }
}
export interface SignedStagingArtifact { artifact: StagingArtifact; checksum: string; approval: { owner: string; stage: 'synthetic_staging'; signature: string } }
const columns = ['toy.early_month', 'toy.morning', 'and:toy.early_month&toy.morning']
function keys(value: object, expected: string[]) {
  if (!value || Array.isArray(value) || Object.keys(value).sort().join('|') !== expected.sort().join('|')) throw new Error('Unexpected artifact fields')
}
export function loadStagingArtifact(value: SignedStagingArtifact, policy: {
  ownerPublicKey: string; sourceLockHash: string; catalogHash: string; revokedDatasetHashes: readonly string[]
  stage: 'synthetic_staging'
}): Readonly<StagingArtifact> {
  keys(value, ['artifact', 'checksum', 'approval'])
  const a = value.artifact
  keys(a, ['schemaVersion', 'kind', 'stage', 'modelVersion', 'parentVersion', 'runHash', 'datasetHash', 'featureHash', 'planHash', 'catalogHash', 'sourceLockHash', 'canonVersion', 'engineVersion', 'selectorVersion', 'assetVersion', 'binding', 'model'])
  keys(a.model, ['columns', 'intercept', 'coefficients']); keys(a.binding, ['mode', 'targetId', 'requiredCapabilities']); keys(value.approval, ['owner', 'stage', 'signature'])
  if (a.schemaVersion !== 1 || a.kind !== 'empirical_target_model' || a.stage !== 'synthetic_staging' || policy.stage !== a.stage || value.approval.stage !== a.stage || !value.approval.owner) throw new Error('Unapproved stage')
  for (const hash of [a.runHash, a.datasetHash, a.featureHash, a.planHash, a.catalogHash, a.sourceLockHash]) if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid identity')
  if (typeof a.modelVersion !== 'string' || !a.modelVersion || (a.parentVersion !== null && typeof a.parentVersion !== 'string')) throw new Error('Invalid model version')
  if (a.sourceLockHash !== policy.sourceLockHash || a.catalogHash !== policy.catalogHash || a.canonVersion !== 'synthetic-software-test' || [a.engineVersion, a.selectorVersion, a.assetVersion].some(v => v !== 'toy-v1')) throw new Error('Incompatible version')
  if (a.binding.mode !== 'shadow_only' || a.binding.targetId !== 'toy-target' || canonical(a.binding.requiredCapabilities) !== canonical(['synthetic_inputs'])) throw new Error('Unapproved binding')
  if (policy.revokedDatasetHashes.includes(a.datasetHash)) throw new Error('Withdrawn/corrected dataset requires reevaluation')
  if (!Array.isArray(a.model.columns) || ![2, 3].includes(a.model.columns.length) || a.model.columns.some((v, i) => v !== columns[i]) || !Array.isArray(a.model.coefficients) || a.model.coefficients.length !== a.model.columns.length || [a.model.intercept, ...a.model.coefficients].some(v => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 20)) throw new Error('Invalid model operator or parameters')
  if (digest(a) !== value.checksum || !verify(null, Buffer.from(canonical({ checksum: value.checksum, owner: value.approval.owner, stage: a.stage })), policy.ownerPublicKey, Buffer.from(value.approval.signature, 'base64'))) throw new Error('Invalid checksum or approval signature')
  // Return a private copy: callers cannot mutate the approved original after checking.
  const copy = structuredClone(a)
  Object.freeze(copy.model.columns); Object.freeze(copy.model.coefficients); Object.freeze(copy.model)
  Object.freeze(copy.binding.requiredCapabilities); Object.freeze(copy.binding)
  return Object.freeze(copy)
}
export function stagingPrediction(artifact: Readonly<StagingArtifact>, features: Readonly<Record<string, boolean | null>>) {
  const a = features['toy.early_month'], b = features['toy.morning']
  if (typeof a !== 'boolean' || typeof b !== 'boolean') return { status: 'unknown' as const, reason: 'missing_inputs' }
  const values = [+a, +b, +(a && b)]
  const z = artifact.model.intercept + artifact.model.coefficients.reduce((sum, coefficient, i) => sum + coefficient * values[i], 0)
  const rankingValue = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z))
  return { status: 'known' as const, rankingValue, modelVersion: artifact.modelVersion, cacheNamespace: digest(artifact) }
}
