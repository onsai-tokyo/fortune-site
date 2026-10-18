import { digest, latest, type BirthRevision, type Dataset, type Observation, type Subject } from './ledger.js'
export type FeatureValue = { status: 'known'; value: boolean; evidenceIds: string[] }
  | { status: 'unknown' | 'unsupported'; reason: string }
export interface FeatureDefinition {
  featureId: string; domain: 'synthetic'; subjectScope: 'individual'; inputDependencies: string[]
  canonRef: string; engineVersion: string; calendarSystem: string; timeAggregation: string
  lineageIds: string[]; correlationGroups: string[]; availabilityContract: string; tests: string[]
}
export const SYNTHETIC_FEATURES: readonly FeatureDefinition[] = [
  { featureId: 'toy.early_month', domain: 'synthetic', subjectScope: 'individual', inputDependencies: ['birth.date'],
    canonRef: 'synthetic-software-test', engineVersion: 'toy-v1', calendarSystem: 'gregorian', timeAggregation: 'natal',
    lineageIds: ['toy.month-bin'], correlationGroups: ['toy.calendar'], availabilityContract: 'known date only', tests: ['research.test.ts'] },
  { featureId: 'toy.morning', domain: 'synthetic', subjectScope: 'individual', inputDependencies: ['birth.time'],
    canonRef: 'synthetic-software-test', engineVersion: 'toy-v1', calendarSystem: 'local-input', timeAggregation: 'natal',
    lineageIds: ['toy.hour-bin'], correlationGroups: ['toy.clock'], availabilityContract: 'exact time only', tests: ['research.test.ts'] },
]
// This interface has no outcome, observed context, person name or expected score.
export function calculateFeatures(birth: Pick<BirthRevision, 'date' | 'datePrecision' | 'time' | 'timePrecision'> | undefined,
  purpose: Dataset['purpose']): Record<string, FeatureValue> {
  if (purpose !== 'synthetic_software_test') return Object.fromEntries(SYNTHETIC_FEATURES.map(f => [f.featureId,
    { status: 'unsupported', reason: 'CANON_NOT_APPROVED: toy feature cannot evaluate human data' }]))
  return {
    'toy.early_month': birth?.date && birth.datePrecision === 'day'
      ? { status: 'known', value: Number(birth.date.slice(5, 7)) <= 6, evidenceIds: ['toy.month-bin'] }
      : { status: 'unknown', reason: 'birth date unavailable' },
    'toy.morning': birth?.time && birth.timePrecision === 'exact'
      ? { status: 'known', value: Number(birth.time.slice(0, 2)) < 12, evidenceIds: ['toy.hour-bin'] }
      : { status: 'unknown', reason: 'exact birth time unavailable' },
  }
}
export function andFeature(a: FeatureValue, b: FeatureValue): FeatureValue {
  if ((a.status === 'known' && !a.value) || (b.status === 'known' && !b.value)) return { status: 'known', value: false, evidenceIds: [] }
  if (a.status === 'known' && b.status === 'known') return { status: 'known', value: true, evidenceIds: [...new Set([...a.evidenceIds, ...b.evidenceIds])] }
  return { status: 'unknown', reason: 'conjunction has unavailable input' }
}
export interface FeatureRow {
  observationId: string; subjectIds: string[]; clusterIds: string[]; discoveryOnly: boolean
  inputHash: string; features: Record<string, FeatureValue>; eligible: boolean; excludedReasons: string[]
}
export interface FeatureSnapshot {
  schemaVersion: 1; datasetHash: string; featureHash: string; catalogHash: string
  purpose: Dataset['purpose']; qualityEligible: false; rows: FeatureRow[]
}
export function buildFeatureSnapshot(dataset: Dataset): FeatureSnapshot {
  const records = latest(dataset)
  const subjects = records.filter((r): r is Subject => r.kind === 'subject')
  const births = records.filter((r): r is BirthRevision => r.kind === 'birth')
  const rows = records.filter((r): r is Observation => r.kind === 'observation').map(o => {
    const members = o.subjectIds.map(id => subjects.find(s => s.id === id)!)
    const candidates = births.filter(b => b.subjectId === o.subjectIds[0])
    const birth = candidates.length === 1 ? candidates[0] : undefined
    const excludedReasons = members.flatMap(s => s.dataUse.status === 'granted' && s.dataUse.purposes.includes('research') ? [] : ['DATA_USE_NOT_GRANTED'])
    if (o.status !== 'confirmed' || o.observer === 'inference') excludedReasons.push('LABEL_NOT_CONFIRMED')
    if (o.subjectIds.length !== 1) excludedReasons.push('PAIR_FEATURE_ADAPTER_NOT_APPROVED')
    if (dataset.purpose !== 'synthetic_software_test') excludedReasons.push('CANON_NOT_APPROVED')
    return { observationId: o.id, subjectIds: [...o.subjectIds], clusterIds: [...new Set(members.flatMap(s => s.clusterIds))],
      discoveryOnly: members.some(s => s.discoveryOnly), inputHash: digest({ birth: birth ?? null, interval: o.interval }),
      features: calculateFeatures(birth, dataset.purpose), eligible: excludedReasons.length === 0, excludedReasons }
  })
  return { schemaVersion: 1, datasetHash: digest(dataset),
    featureHash: digest(rows.map(r => ({ inputHash: r.inputHash, features: r.features }))),
    catalogHash: digest(SYNTHETIC_FEATURES), purpose: dataset.purpose, qualityEligible: false, rows }
}
