import { buildNatalDiagnostic } from '../../research/natalDiagnostic.js'
import { auditSectionCoverage, type SectionLocatorIndex } from '../../research/coverageAudit.js'
import { readFileSync, writeFileSync } from 'node:fs'
import { PrivateLedger, canonical, digest, validateDataset, type Dataset } from '../../research/ledger.js'
import { buildFeatureSnapshot, SYNTHETIC_FEATURES } from '../../research/features.js'
import { evaluate, validatePlan, type EvaluationPlan, type EvaluationRun } from '../../research/evaluation.js'
import { propose, researchSourceLockHash } from '../../research/artifact.js'
import { loadStagingArtifact, stagingPrediction, type SignedStagingArtifact, type StagingArtifact } from '../../lib/researchStagingModel.js'
const [command, ...args] = process.argv.slice(2)
function arg(name: string) { const i = args.indexOf(`--${name}`); if (i < 0 || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing ${name}`); return args[i + 1] }
function json(path: string): unknown { return JSON.parse(readFileSync(path, 'utf8')) }
function hashArg(name: string) { const value = arg(name); if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid hash'); return value }
try {
  const store = new PrivateLedger(process.env.FATELAB_RESEARCH_DATA_DIR ?? '')
  const policy = () => ({ ownerPublicKey: readFileSync(process.env.FATELAB_RESEARCH_OWNER_PUBLIC_KEY_FILE ?? '', 'utf8'),
    sourceLockHash: researchSourceLockHash(), catalogHash: digest(SYNTHETIC_FEATURES),
    revokedDatasetHashes: store.read<string[]>('revoked-datasets.json') ?? [], stage: 'synthetic_staging' as const })
  switch (command) {
    case 'import': {
      if (args.includes('--commit') === args.includes('--dry-run')) throw new Error('Choose exactly one import mode')
      console.log(JSON.stringify(store.import(validateDataset(json(arg('input'))), args.includes('--commit')))); break
    }
    case 'coverage': {
      const dataset = store.read<Dataset>(`${arg('dataset')}.json`)
      if (!dataset) throw new Error('Missing dataset')
      const index = JSON.parse(readFileSync(new URL('../../research/sectionLocatorIndex.json', import.meta.url), 'utf8')) as SectionLocatorIndex
      console.log(JSON.stringify(auditSectionCoverage(validateDataset(dataset), index))); break
    }
    case 'snapshot': console.log(JSON.stringify(store.snapshot(arg('dataset')))); break
    case 'natal-diagnostic': {
      const snapshotHash = hashArg('snapshot')
      if ((store.read<string[]>('revoked-datasets.json') ?? []).includes(snapshotHash)) throw new Error('Snapshot revoked')
      const dataset = store.read<Dataset>(`snapshot-${snapshotHash}.json`)
      if (!dataset || digest(dataset) !== snapshotHash) throw new Error('Snapshot missing or hash mismatch')
      const diagnostic = buildNatalDiagnostic(validateDataset(dataset)); const hash = digest(diagnostic)
      store.write(`natal-diagnostic-${hash}.json`, diagnostic)
      console.log(JSON.stringify({ diagnosticId: hash, rows: diagnostic.rows.length, trainingEligible: false, productionEligible: false })); break
    }
    case 'features': {
      const dataset = store.read<Dataset>(`snapshot-${hashArg('snapshot')}.json`)
      if (!dataset) throw new Error('Missing snapshot')
      if (arg('canon') !== 'synthetic-software-test' || dataset.purpose !== 'synthetic_software_test') throw new Error('Canon not approved')
      const features = buildFeatureSnapshot(validateDataset(dataset)); const hash = digest(features)
      store.write(`features-${hash}.json`, features); console.log(JSON.stringify({ featureSnapshotId: hash, qualityEligible: false })); break
    }
    case 'evaluate': {
      const features = store.read<ReturnType<typeof buildFeatureSnapshot>>(`features-${hashArg('features')}.json`)
      if (!features) throw new Error('Missing features')
      const dataset = store.read<Dataset>(`snapshot-${features.datasetHash}.json`)
      if (!dataset || digest(buildFeatureSnapshot(validateDataset(dataset))) !== digest(features)) throw new Error('Feature lineage mismatch')
      const plan = json(arg('plan')) as EvaluationPlan; validatePlan(plan)
      const run = evaluate(validateDataset(dataset), plan, process.env.FATELAB_RESEARCH_PYTHON ?? 'python3')
      const hash = digest(run); store.write(`run-${hash}.json`, run)
      console.log(JSON.stringify({ runId: hash, status: run.status, reason: run.reason })); break
    }
    case 'propose': {
      const run = store.read<EvaluationRun>(`run-${hashArg('run')}.json`)
      if (!run) throw new Error('Missing run')
      const candidate = propose(run)
      if ('status' in candidate) { console.log(JSON.stringify(candidate)); break }
      const hash = digest(candidate); store.write(`candidate-${hash}.json`, candidate)
      console.log(JSON.stringify({ candidateId: hash, stage: candidate.stage })); break
    }
    case 'approve': {
      const hash = hashArg('candidate'), artifact = store.read<StagingArtifact>(`candidate-${hash}.json`)
      if (!artifact || digest(artifact) !== hash) throw new Error('Candidate hash mismatch')
      const approval = json(arg('approval-file')) as SignedStagingArtifact['approval']
      const signed = { artifact, checksum: hash, approval }; loadStagingArtifact(signed, policy())
      store.write(`approved-${hash}.json`, signed); console.log(JSON.stringify({ approvedId: hash, stage: artifact.stage })); break
    }
    case 'export': {
      const hash = hashArg('approved'), signed = store.read<SignedStagingArtifact>(`approved-${hash}.json`)
      if (!signed) throw new Error('Missing approved artifact')
      loadStagingArtifact(signed, policy()); store.write(`artifact-${hash}.json`, signed)
      if (args.includes('--output')) writeFileSync(arg('output'), canonical(signed) + '\n', { flag: 'wx', mode: 0o600 })
      console.log(JSON.stringify({ artifactId: hash, path: `${store.root}/artifact-${hash}.json`, productionConnected: false })); break
    }
    case 'activate': case 'rollback': {
      const hash = hashArg('artifact'), signed = store.read<SignedStagingArtifact>(`artifact-${hash}.json`)
      if (!signed) throw new Error('Missing artifact')
      loadStagingArtifact(signed, policy()); store.write('active-staging.json', { artifactHash: hash })
      console.log(JSON.stringify({ activeStagingArtifact: hash, productionConnected: false })); break
    }
    case 'diff': {
      const load = (name: string) => {
        const signed = store.read<SignedStagingArtifact>(`artifact-${hashArg(name)}.json`)
        if (!signed) throw new Error('Missing artifact')
        return loadStagingArtifact(signed, policy())
      }
      const old = load('old'), next = load('new')
      console.log(JSON.stringify([false, true].flatMap(a => [false, true].map(b => {
        const input = { 'toy.early_month': a, 'toy.morning': b }
        return { syntheticInput: input, old: stagingPrediction(old, input), new: stagingPrediction(next, input) }
      })))); break
    }
    default: throw new Error('Unsupported research command')
  }
} catch {
  // Do not serialize data, labels, paths, tokens or raw exceptions to normal CI logs.
  console.error(JSON.stringify({ status: 'blocked', reason: 'research_validation_or_execution_failed' })); process.exitCode = 1
}
