import { readFileSync } from 'node:fs'
import { calcAstrology } from '../lib/astrology.js'
import { extractAstrologyFacts } from '../lib/report/astrologyFacts.js'
import { digest, latest, validateDataset, type BirthRevision, type Dataset } from './ledger.js'

// Calculation diagnostics only. No trait meanings, labels, training or production claims.
export const NATAL_DIAGNOSTIC_CATALOG = [
  { featureId: 'natal.western.sun.aries', sign: '牡羊座', interval: [0, 30] },
  { featureId: 'natal.western.sun.libra', sign: '天秤座', interval: [180, 210] },
] as const
export type NatalInput = Pick<BirthRevision, 'date' | 'datePrecision' | 'time' | 'timePrecision' | 'timezone'>

export function calculateNatalDiagnostic(birth: NatalInput) {
  // Explicit projection: labels, names, observations and context cannot enter the hash/calculation.
  const input = { date: birth.date, datePrecision: birth.datePrecision, time: birth.time,
    timePrecision: birth.timePrecision, timezone: birth.timezone }
  const inputHash = digest(input)
  const unavailable = (reason: string) => ({ inputHash, facts: [], features: NATAL_DIAGNOSTIC_CATALOG.map(f =>
    ({ featureId: f.featureId, status: 'unsupported' as const, reason, value: null, evidenceIds: [] as string[] })) })
  if (input.datePrecision !== 'day' || input.timePrecision !== 'exact' || !input.date || !input.time) return unavailable('EXACT_DATE_AND_TIME_REQUIRED')
  if (input.timezone !== 'Asia/Tokyo') return unavailable('ONLY_EXPLICIT_MODERN_JST_SUPPORTED')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return unavailable('INVALID_BIRTH_INPUT')
  const day = new Date(input.date + 'T00:00:00Z')
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== input.date) return unavailable('INVALID_BIRTH_INPUT')
  const [year, month, date] = input.date.split('-').map(Number)
  // Initial diagnostic adapter envelope, not a claim of validated historical timezone support.
  if (year < 1970 || year > 2099) return unavailable('OUTSIDE_INITIAL_DIAGNOSTIC_ENVELOPE')
  const [hour, minute] = input.time.split(':').map(Number)
  const astrology = calcAstrology(year, month, date, hour, minute)
  const sun = astrology.western?.planets.find(p => p.name === '太陽')
  if (!sun || !Number.isFinite(sun.longitude) || sun.longitude < 0 || sun.longitude >= 360) return unavailable('SUN_FACT_UNAVAILABLE')
  const extracted = extractAstrologyFacts({ birthDate: input.date, birthTime: input.time, astrology })
    .filter(f => f.system === '西洋占星術' && f.canonicalSourceId === 'planet:太陽' && f.factor === `planet:太陽:${sun.sign}`)
  if (extracted.length !== 1) return unavailable('SUN_FACT_UNAVAILABLE')
  // Snapshot evidence is input-scoped; not the production ReportFactV2 identity.
  const facts = extracted.map(f => ({ id: digest({ inputHash, fact: f }), factor: f.factor,
    canonicalSourceId: f.canonicalSourceId, longitude: sun.longitude }))
  return { inputHash, facts, features: NATAL_DIAGNOSTIC_CATALOG.map(f => ({ featureId: f.featureId,
    status: 'known' as const, reason: null, value: sun.sign === f.sign, evidenceIds: facts.map(fact => fact.id) })) }
}

export function buildNatalDiagnostic(dataset: Dataset) {
  validateDataset(dataset)
  const records = latest(dataset)
  const subjects = records.filter(r => r.kind === 'subject')
  const births = records.filter((r): r is BirthRevision => r.kind === 'birth')
  for (const birth of births) {
    const subject = subjects.find(s => s.id === birth.subjectId)
    if (!subject || subject.dataUse.status === 'withdrawn' || subject.dataUse.status === 'restricted') {
      throw new Error('Natal diagnostic requires a linked subject with draft or granted data use')
    }
  }
  const calculationSourceHash = digest(['natalDiagnostic.ts', '../lib/astrology.ts', '../lib/astronomyEngineAdapter.ts',
    '../lib/report/astrologyFacts.ts', '../../package-lock.json'].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')))
  const rows = births.map(b => ({ birthRevisionId: b.id, birthRevision: b.revision, subjectId: b.subjectId,
    ...calculateNatalDiagnostic(b) }))
  return { schemaVersion: 1, kind: 'natal_calculation_diagnostic', adapterVersion: 'natal-sun-jst-v1',
    calculationSourceHash, datasetHash: digest(dataset), catalogHash: digest(NATAL_DIAGNOSTIC_CATALOG),
    featureHash: digest(rows), qualityEligible: false, trainingEligible: false, productionEligible: false, rows }
}
