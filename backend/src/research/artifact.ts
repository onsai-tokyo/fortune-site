import { researchSourceLockHash } from './version.js'
export { researchSourceLockHash } from './version.js'
import { digest } from './ledger.js'
import { SYNTHETIC_FEATURES } from './features.js'
import type { EvaluationRun } from './evaluation.js'
import type { StagingArtifact } from '../lib/researchStagingModel.js'
export function propose(run: EvaluationRun, parentVersion: string | null = null): StagingArtifact | { status: 'no_change'; reason: string } {
  if (run.codeAndLockHash !== researchSourceLockHash()) return { status: 'no_change', reason: 'source_or_lock_changed_rerun_required' }
  if (run.status !== 'candidate' || !run.model) return { status: 'no_change', reason: run.reason }
  const runHash = digest(run)
  return { schemaVersion: 1, kind: 'empirical_target_model', stage: 'synthetic_staging',
    modelVersion: `toy-${runHash.slice(0, 20)}`, parentVersion, runHash,
    datasetHash: run.datasetHash, featureHash: run.featureHash, planHash: run.planHash,
    catalogHash: digest(SYNTHETIC_FEATURES), sourceLockHash: researchSourceLockHash(),
    canonVersion: 'synthetic-software-test', engineVersion: 'toy-v1', selectorVersion: 'toy-v1', assetVersion: 'toy-v1',
    binding: { mode: 'shadow_only', targetId: 'toy-target', requiredCapabilities: ['synthetic_inputs'] },
    model: { columns: run.model.columns, coefficients: run.model.coefficients, intercept: run.model.intercept } }
}
