import { researchSourceLockHash } from './version.js'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { digest, latest, type Dataset, type Observation } from './ledger.js'
import { andFeature, buildFeatureSnapshot, SYNTHETIC_FEATURES, type FeatureSnapshot } from './features.js'
export interface EvaluationPlan {
  planId: string; version: 1; purpose: 'synthetic_software_test'; domain: 'event' | 'personality' | 'relationship'
  targetId: string; targetDefinitionVersion: string; windowPolicy: 'recorded_half_open'; observationEndPolicy: 'confirmed_only'
  splitStrategy: 'connected_subject_cluster'; seed: string
  candidateCatalog: string[]; maxInteractionOrder: 2; maxCandidateCount: 3
  preprocessing: 'none'; solver: 'sklearn.LogisticRegression'; solverVersion: '1.6.1'
  regularizationCandidates: number[]; tolerance: number; maxIterations: number
  baselineDefinitions: ['train_prevalence']; primaryMetric: 'log_loss'; secondaryMetrics: ['brier']
  minimumGroupsPerSplit: number; minimumClassCount: number; minimumImprovement: number
  uncertaintyMethod: 'not_estimated_synthetic_only'; multipleComparisonPolicy: 'all_candidates_reported'
  nonInferiorityChecks: ['brier']; approvedBy: 'synthetic_test_authority'
}
export function syntheticPlan(): EvaluationPlan {
  return { planId: 'toy-v1', version: 1, purpose: 'synthetic_software_test', domain: 'personality', targetId: 'toy-target',
    targetDefinitionVersion: 'toy-v1', windowPolicy: 'recorded_half_open', observationEndPolicy: 'confirmed_only',
    splitStrategy: 'connected_subject_cluster', seed: 'toy-plan-v1', candidateCatalog: SYNTHETIC_FEATURES.map(f => f.featureId),
    maxInteractionOrder: 2, maxCandidateCount: 3, preprocessing: 'none', solver: 'sklearn.LogisticRegression', solverVersion: '1.6.1',
    regularizationCandidates: [1, 10], tolerance: 1e-8, maxIterations: 2000,
    baselineDefinitions: ['train_prevalence'], primaryMetric: 'log_loss', secondaryMetrics: ['brier'],
    minimumGroupsPerSplit: 3, minimumClassCount: 2, minimumImprovement: .001,
    uncertaintyMethod: 'not_estimated_synthetic_only', multipleComparisonPolicy: 'all_candidates_reported',
    nonInferiorityChecks: ['brier'], approvedBy: 'synthetic_test_authority' }
}
export function validatePlan(plan: EvaluationPlan) {
  // Only this explicitly synthetic protocol is implemented. Human-data acceptance remains EVAL-01 blocked.
  const expected = syntheticPlan()
  if (digest(plan) !== digest(expected)) throw new Error('Unsupported or unapproved evaluation plan')
}
export interface FittedModel { name: string; columns: string[]; intercept: number; coefficients: number[]; lambda: number; iterations: number }
export interface EvaluationRun {
  schemaVersion: 1; codeAndLockHash: string; purpose: 'synthetic_software_test'; datasetHash: string; featureHash: string; planHash: string
  status: 'candidate' | 'no_change'; reason: string; model?: FittedModel
  diagnostics: Record<string, unknown>; solverResult?: Record<string, any>
}
export function evaluate(dataset: Dataset, plan: EvaluationPlan, python = 'python3'): EvaluationRun {
  validatePlan(plan)
  if (dataset.purpose !== plan.purpose) throw new Error('Synthetic plan cannot train on human data')
  const features = buildFeatureSnapshot(dataset)
  const records = latest(dataset).filter((r): r is Observation => r.kind === 'observation')
  const counters: Record<string, number> = {}
  const fourGroups = Object.fromEntries(['00', '01', '10', '11'].map(k => [k, { positive: 0, negative: 0, subjects: new Set<string>() }]))
  const observations = features.rows.flatMap(row => {
    const observation = records.find(o => o.id === row.observationId)!
    let reason = row.excludedReasons[0]
    if (observation.domain !== plan.domain) reason = 'wrong_domain'
    if (!['positive', 'confirmed_negative'].includes(observation.outcome.kind)) reason = observation.outcome.kind
    else if ('targetId' in observation.outcome && observation.outcome.targetId !== plan.targetId) reason = 'wrong_target'
    const [a, b] = plan.candidateCatalog.map(id => row.features[id])
    const and = andFeature(a, b)
    if (a.status !== 'known' || b.status !== 'known' || and.status !== 'known') reason = 'unknown_features'
    if (reason) { counters[reason] = (counters[reason] ?? 0) + 1; return [] }
    if (a.status !== 'known' || b.status !== 'known' || and.status !== 'known') return []
    const y = observation.outcome.kind === 'positive' ? 1 : 0
    const group = fourGroups[`${+a.value}${+b.value}`]; group[y ? 'positive' : 'negative']++
    row.subjectIds.forEach(s => group.subjects.add(s))
    return [{ ...row, x: [+a.value, +b.value, +and.value], y }]
  })
  // Connected components prevent indirect shared partner/family leakage across splits.
  const parent = new Map<string, string>()
  function find(x: string): string { const p = parent.get(x); if (!p) { parent.set(x, x); return x }; if (p === x) return x; const root = find(p); parent.set(x, root); return root }
  for (const row of observations) {
    const keys = [...row.subjectIds.map(x => `subject:${x}`), ...row.clusterIds.map(x => `cluster:${x}`)]
    const root = find(keys[0]); keys.slice(1).forEach(key => parent.set(find(key), root))
  }
  const groups = new Map<string, typeof observations>()
  for (const row of observations) { const key = find(`subject:${row.subjectIds[0]}`); groups.set(key, [...(groups.get(key) ?? []), row]) }
  const ordered = [...groups.keys()].sort((a, b) => digest([plan.seed, a]).localeCompare(digest([plan.seed, b])))
  const split = { train: [] as typeof observations, validation: [] as typeof observations, test: [] as typeof observations }
  ordered.forEach((id, index) => {
    const rows = groups.get(id)!
    const name = rows.some(r => r.discoveryOnly) ? 'train' : index % 5 === 0 ? 'test' : index % 5 === 1 ? 'validation' : 'train'
    split[name].push(...rows)
  })
  const diagnostics = { excluded: counters, eligibleRows: observations.length,
    uniqueSubjects: new Set(observations.flatMap(r => r.subjectIds)).size, independentGroups: groups.size,
    fourGroups: Object.fromEntries(Object.entries(fourGroups).map(([k, v]) => [k, { positive: v.positive, negative: v.negative, subjects: v.subjects.size }])),
    split: Object.fromEntries(Object.entries(split).map(([name, rows]) => [name, { rows: rows.length, groups: new Set(rows.map(r => find(`subject:${r.subjectIds[0]}`))).size }])) }
  const base = { schemaVersion: 1 as const, codeAndLockHash: researchSourceLockHash(), purpose: plan.purpose, datasetHash: digest(dataset), featureHash: features.featureHash, planHash: digest(plan), diagnostics }
  for (const rows of Object.values(split)) {
    if (new Set(rows.map(r => find(`subject:${r.subjectIds[0]}`))).size < plan.minimumGroupsPerSplit || [0, 1].some(y => rows.filter(r => r.y === y).length < plan.minimumClassCount)) {
      return { ...base, status: 'no_change', reason: 'insufficient_independent_groups_or_classes' }
    }
  }
  const input = { plan, split: Object.fromEntries(Object.entries(split).map(([name, rows]) => [name, { x: rows.map(r => r.x), y: rows.map(r => r.y) }])) }
  const run = spawnSync(python, [fileURLToPath(new URL('./solver.py', import.meta.url))], { input: JSON.stringify(input), encoding: 'utf8', timeout: 60_000, maxBuffer: 2_000_000 })
  if (run.status !== 0) return { ...base, status: 'no_change', reason: 'solver_failed_or_version_unavailable' }
  let fitted: Record<string, any>
  try { fitted = JSON.parse(run.stdout) } catch { return { ...base, status: 'no_change', reason: 'invalid_solver_response' } }
  if (!fitted.selected) return { ...base, status: 'no_change', reason: 'no_validated_improvement', solverResult: fitted }
  return { ...base, status: 'candidate', reason: 'synthetic_software_test_only', model: fitted.selected as FittedModel, solverResult: fitted }
}
