import { canonical, digest } from '../lib/artifactIdentity.js'
export { canonical, digest } from '../lib/artifactIdentity.js'
import { mkdirSync, realpathSync, statSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Permission = 'draft' | 'granted' | 'restricted' | 'withdrawn'
export type Outcome = { kind: 'positive' | 'confirmed_negative'; targetId: string }
  | { kind: 'unknown' | 'not_at_risk' | 'exposure_unknown'; reason: string }
export interface Subject {
  kind: 'subject'; id: string; revision: number; previousRevision: number | null
  clusterIds: string[]; sourceRef: string
  dataUse: { status: Permission; purposes: string[]; sourceRef: string }
  discoveryOnly: boolean
}
export interface BirthRevision {
  kind: 'birth'; id: string; subjectId: string; revision: number; previousRevision: number | null
  date: string | null; time: string | null; timezone: string | null; place: string | null
  datePrecision: 'day' | 'unknown'; timePrecision: 'exact' | 'approximate' | 'unknown'
  sourceRef: string; rawStatementRef: string
}
export interface Observation {
  kind: 'observation'; id: string; revision: number; previousRevision: number | null
  domain: 'event' | 'personality' | 'relationship'; subjectIds: string[]; episodeId: string
  sourceRef: string; rawStatementRef: string; observer: 'self' | 'other' | 'inference'
  status: 'draft' | 'confirmed' | 'disputed' | 'withdrawn'
  interval: { start: string | null; end: string | null; precision: 'day' | 'month' | 'year' | 'unknown' }
  observedThrough: string | null; phase: string; direction: string | null; context: string[]
  outcome: Outcome
}
export const coverageStatuses = ['existing_supported', 'implemented_unvalidated', 'candidate', 'missing_fact', 'unavailable_input', 'blocked_canon', 'context_only', 'duplicate', 'rejected', 'needs_review'] as const
export interface CoverageRecord {
  kind: 'coverage'; id: string; revision: number; previousRevision: number | null
  observationId: string | null; sourceDocumentId: string; sourceSection: string; predicateId: string
  semanticConcept: string; featureIds: string[]; calculationAvailability: string
  ruleId: string | null; scoreBindingId: string | null; claimId: string | null; assetId: string | null
  implementationStatus: typeof coverageStatuses[number]; runtimeEvidence: string[]; tests: string[]
  adoptionStatus: 'discovery_only' | 'implemented_unvalidated' | 'blocked'
  blockedReason: string | null; decisionOwner: string; modelVersion: string | null
}
export type RecordRevision = Subject | BirthRevision | Observation | CoverageRecord
export interface Dataset { schemaVersion: 1; datasetId: string; purpose: 'private_draft' | 'synthetic_software_test'; records: RecordRevision[] }
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value)
function object(value: unknown): asserts value is Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object') }
function fields(value: Record<string, any>, names: string[]) {
  if (Object.keys(value).some(k => !names.includes(k)) || names.some(k => !(k in value))) throw new Error('Invalid or missing fields')
}
function text(value: unknown) { if (typeof value !== 'string' || !value.trim() || value.length > 4096) throw new Error('Invalid text') }
function nullableText(value: unknown) { if (value !== null) text(value) }
function list(value: unknown): asserts value is string[] { if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !v.trim())) throw new Error('Invalid list') }
function one(value: unknown, choices: readonly string[]) { if (typeof value !== 'string' || !choices.includes(value)) throw new Error('Invalid enum') }
function date(value: unknown) {
  if (value === null) return
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Invalid date')
}
export function validateDataset(value: unknown): Dataset {
  object(value); fields(value, ['schemaVersion', 'datasetId', 'purpose', 'records'])
  if (value.schemaVersion !== 1 || !id(value.datasetId) || !Array.isArray(value.records)) throw new Error('Invalid dataset')
  one(value.purpose, ['private_draft', 'synthetic_software_test'])
  const common = ['kind', 'id', 'revision', 'previousRevision']
  for (const record of value.records) {
    object(record)
    if (!id(record.id) || !Number.isInteger(record.revision) || record.revision < 1 || record.previousRevision !== (record.revision === 1 ? null : record.revision - 1)) throw new Error('Invalid revision')
    switch (record.kind) {
      case 'subject':
        fields(record, [...common, 'clusterIds', 'sourceRef', 'dataUse', 'discoveryOnly'])
        list(record.clusterIds); if (!record.clusterIds.length || record.clusterIds.some(v => !id(v))) throw new Error('Missing cluster')
        text(record.sourceRef); object(record.dataUse); fields(record.dataUse, ['status', 'purposes', 'sourceRef'])
        one(record.dataUse.status, ['draft', 'granted', 'restricted', 'withdrawn']); list(record.dataUse.purposes); text(record.dataUse.sourceRef)
        if (typeof record.discoveryOnly !== 'boolean') throw new Error('Missing discovery history')
        break
      case 'birth':
        fields(record, [...common, 'subjectId', 'date', 'time', 'timezone', 'place', 'datePrecision', 'timePrecision', 'sourceRef', 'rawStatementRef'])
        if (!id(record.subjectId)) throw new Error('Invalid subject')
        date(record.date); nullableText(record.time); nullableText(record.timezone); nullableText(record.place)
        one(record.datePrecision, ['day', 'unknown']); one(record.timePrecision, ['exact', 'approximate', 'unknown'])
        if ((record.date === null) !== (record.datePrecision === 'unknown') || (record.time === null) !== (record.timePrecision === 'unknown')) throw new Error('Precision mismatch')
        if (record.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time)) throw new Error('Invalid time')
        text(record.sourceRef); text(record.rawStatementRef)
        break
      case 'observation':
        fields(record, [...common, 'domain', 'subjectIds', 'episodeId', 'sourceRef', 'rawStatementRef', 'observer', 'status', 'interval', 'observedThrough', 'phase', 'direction', 'context', 'outcome'])
        one(record.domain, ['event', 'personality', 'relationship']); list(record.subjectIds)
        if (!record.subjectIds.length || record.subjectIds.some(v => !id(v)) || new Set(record.subjectIds).size !== record.subjectIds.length || !id(record.episodeId)) throw new Error('Invalid subjects/episode')
        if (record.domain === 'relationship' && (record.subjectIds.length !== 2 || record.direction === null)) throw new Error('Relationship requires a directed pair')
        text(record.sourceRef); text(record.rawStatementRef); text(record.phase); nullableText(record.direction); list(record.context)
        one(record.observer, ['self', 'other', 'inference']); one(record.status, ['draft', 'confirmed', 'disputed', 'withdrawn'])
        object(record.interval); fields(record.interval, ['start', 'end', 'precision']); date(record.interval.start); date(record.interval.end)
        one(record.interval.precision, ['day', 'month', 'year', 'unknown']); date(record.observedThrough)
        if ((record.interval.start === null) !== (record.interval.end === null) || (record.interval.start === null) !== (record.interval.precision === 'unknown')) throw new Error('Unknown interval must stay unknown')
        if (record.interval.start !== null && record.interval.start >= record.interval.end) throw new Error('Invalid half-open interval')
        object(record.outcome)
        one(record.outcome.kind, ['positive', 'confirmed_negative', 'unknown', 'not_at_risk', 'exposure_unknown'])
        if (['positive', 'confirmed_negative'].includes(record.outcome.kind)) {
          fields(record.outcome, ['kind', 'targetId']); if (!id(record.outcome.targetId)) throw new Error('Invalid target')
          if (record.outcome.kind === 'confirmed_negative' && (record.observedThrough === null || record.interval.end === null || record.observedThrough < record.interval.end)) throw new Error('Unobserved future is not negative')
        } else { fields(record.outcome, ['kind', 'reason']); text(record.outcome.reason) }
        break
      case 'coverage':
        fields(record, [...common, 'observationId', 'sourceDocumentId', 'sourceSection', 'predicateId', 'semanticConcept', 'featureIds', 'calculationAvailability', 'ruleId', 'scoreBindingId', 'claimId', 'assetId', 'implementationStatus', 'runtimeEvidence', 'tests', 'adoptionStatus', 'blockedReason', 'decisionOwner', 'modelVersion'])
        for (const field of ['sourceDocumentId', 'sourceSection', 'predicateId', 'semanticConcept', 'calculationAvailability', 'decisionOwner']) text(record[field])
        for (const field of ['observationId', 'ruleId', 'scoreBindingId', 'claimId', 'assetId', 'blockedReason', 'modelVersion']) nullableText(record[field])
        for (const field of ['featureIds', 'runtimeEvidence', 'tests']) list(record[field])
        one(record.implementationStatus, coverageStatuses); one(record.adoptionStatus, ['discovery_only', 'implemented_unvalidated', 'blocked'])
        if (record.implementationStatus === 'existing_supported' && (!record.runtimeEvidence.length || !record.tests.length || !record.featureIds.length || !record.ruleId || !record.claimId || !record.assetId || !record.modelVersion)) throw new Error('Supported coverage requires runtime trace')
        if (record.implementationStatus !== 'existing_supported' && !record.blockedReason) throw new Error('Coverage needs an explicit reason')
        break
      default: throw new Error('Unknown record kind')
    }
  }
  return value as unknown as Dataset
}
export function latest(dataset: Dataset): RecordRevision[] {
  const records = new Map<string, RecordRevision>()
  for (const record of dataset.records) {
    const key = `${record.kind}:${record.id}`, old = records.get(key)
    if (!old || old.revision < record.revision) records.set(key, record)
  }
  return [...records.values()].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`, 'en'))
}
export function mergeDataset(previous: Dataset, incoming: Dataset): Dataset {
  validateDataset(previous); validateDataset(incoming)
  if (previous.datasetId !== incoming.datasetId || previous.purpose !== incoming.purpose) throw new Error('Dataset identity mismatch')
  const records = new Map(previous.records.map(r => [`${r.kind}:${r.id}:${r.revision}`, r]))
  for (const r of incoming.records) {
    const key = `${r.kind}:${r.id}:${r.revision}`, old = records.get(key)
    if (old && digest(old) !== digest(r)) throw new Error('Immutable revision conflict')
    records.set(key, r)
  }
  const all = [...records.values()].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`, 'en') || a.revision - b.revision)
  for (const r of all) if (r.previousRevision !== null && !records.has(`${r.kind}:${r.id}:${r.previousRevision}`)) throw new Error('Missing previous revision')
  const subjects = new Set(all.filter(r => r.kind === 'subject').map(r => r.id))
  const observationIds = new Set(all.filter(r => r.kind === 'observation').map(r => r.id))
  for (const r of all) {
    if (r.kind === 'coverage' && r.observationId !== null && !observationIds.has(r.observationId)) throw new Error('Missing coverage observation')
    if (r.kind === 'birth' && !subjects.has(r.subjectId)) throw new Error('Missing birth subject')
    if (r.kind === 'observation' && r.subjectIds.some(id => !subjects.has(id))) throw new Error('Missing observation subject')
    if (r.kind === 'subject' && r.previousRevision !== null) {
      const old = records.get(`subject:${r.id}:${r.previousRevision}`) as Subject
      if (old.discoveryOnly && !r.discoveryOnly) throw new Error('Discovery history cannot be erased')
    }
  }
  const merged = { ...previous, records: all }
  const episodes = new Set<string>()
  for (const r of latest(merged)) if (r.kind === 'observation') {
    const key = canonical([r.domain, [...r.subjectIds].sort(), r.episodeId, r.phase, r.sourceRef])
    if (episodes.has(key)) throw new Error('Duplicate source observation phase')
    episodes.add(key)
  }
  return merged
}
export function coverageSummary(dataset: Dataset) {
  const active = latest(dataset)
  const observations = active.filter(r => r.kind === 'observation')
  const coverage = active.filter((r): r is CoverageRecord => r.kind === 'coverage')
  return { observations: observations.length, coverageRecords: coverage.length,
    observationsWithoutCoverage: observations.filter(o => !coverage.some(c => c.observationId === o.id)).length,
    unreviewedCoverageRecords: coverage.filter(c => c.implementationStatus === 'needs_review').length,
    unclassified: observations.filter(o => {
      const linked = coverage.filter(c => c.observationId === o.id)
      return linked.length === 0 || linked.some(c => c.implementationStatus === 'needs_review')
    }).length,
    supported: coverage.filter(c => c.implementationStatus === 'existing_supported').length }
}
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
function outsideRepo(path: string) {
  const rel = relative(repoRoot, path)
  if (!rel || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))) throw new Error('Private research data must stay outside repository')
}
export class PrivateLedger {
  readonly root: string
  constructor(root: string) {
    if (!isAbsolute(root)) throw new Error('FATELAB_RESEARCH_DATA_DIR must be absolute')
    outsideRepo(resolve(root))
    mkdirSync(root, { recursive: true, mode: 0o700 })
    this.root = realpathSync(root); outsideRepo(this.root)
    const stat = statSync(this.root)
    if (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) throw new Error('Research directory must be owner-only (0700)')
  }
  private path(name: string) { if (!/^[a-zA-Z0-9_-]+\.json$/.test(name)) throw new Error('Invalid private artifact name'); return join(this.root, name) }
  read<T>(name: string): T | undefined {
    const file = this.path(name)
    if (!existsSync(file)) return undefined
    if (realpathSync(file) !== file || (statSync(file).mode & 0o077) !== 0) throw new Error('Unsafe private file')
    return JSON.parse(readFileSync(file, 'utf8')) as T
  }
  write(name: string, value: unknown) {
    const file = this.path(name), temporary = `${file}.${process.pid}.tmp`
    const fd = openSync(temporary, 'wx', 0o600)
    try { writeFileSync(fd, canonical(value) + '\n'); closeSync(fd); renameSync(temporary, file) }
    catch (error) { try { closeSync(fd) } catch {}; try { unlinkSync(temporary) } catch {}; throw error }
  }
  import(incoming: Dataset, commit: boolean) {
    validateDataset(incoming)
    const lock = join(this.root, 'import.lock'), fd = openSync(lock, 'wx', 0o600)
    try {
      const filename = `${incoming.datasetId}.json`
      const current = this.read<Dataset>(filename) ?? { ...incoming, records: [] }
      const merged = mergeDataset(current, incoming)
      const result = { datasetHash: digest(merged), addedRevisions: merged.records.length - current.records.length, ...coverageSummary(merged) }
      if (commit) {
        if (incoming.records.some(record => record.previousRevision !== null) && result.datasetHash !== digest(current)) {
          const revoked = new Set(this.read<string[]>('revoked-datasets.json') ?? [])
          revoked.add(digest(current))
          for (const name of readdirSync(this.root).filter(name => /^snapshot-[a-f0-9]{64}\.json$/.test(name))) {
            const snapshot = this.read<Dataset>(name)
            if (snapshot?.datasetId === current.datasetId) revoked.add(digest(snapshot))
          }
          // Invalidate first: interruption can postpone a valid release, never permit
          // stale consent. A later import can safely be retried under the same lock.
          this.write('revoked-datasets.json', [...revoked].sort())
        }
        this.write(filename, merged)
      }
      return result
    } finally { closeSync(fd); unlinkSync(lock) }
  }
  snapshot(datasetId: string) {
    if (!id(datasetId)) throw new Error('Invalid dataset id')
    const dataset = this.read<Dataset>(`${datasetId}.json`)
    if (!dataset) throw new Error('Missing dataset')
    validateDataset(dataset)
    const hash = digest(dataset)
    this.write(`snapshot-${hash}.json`, dataset)
    return { snapshotId: hash, ...coverageSummary(dataset) }
  }
}
