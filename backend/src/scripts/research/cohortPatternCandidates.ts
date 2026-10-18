import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { buildEventPatternStudy } from '../../research/eventPatternStudy.js'
import { occurrenceWindow, mineCohortCandidates, type CohortObservation } from '../../research/cohortPatternCandidates.js'
import { assertTimingEvidenceBirthInput, type TimingEvidenceBirthInput } from '../../lib/report/timingEvidencePipeline.js'

interface Row {
  id: string; personID: string; independenceUnit?: string; name: string; birth: TimingEvidenceBirthInput
  year: string; date: string; category: string; note: string; sourceURL: string
  exclusionReasons: string[]; birthVerified: false
}
const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) throw new Error('Expected private normalized JSON and new output directory')
const repo = realpathSync(fileURLToPath(new URL('../../../..', import.meta.url)))
const outside = (path: string) => {
  const rel = relative(repo, path)
  if (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../')) throw new Error('Cohort data must remain outside source repository')
}
outside(realpathSync(inputPath))
const output = resolve(outputPath)
outside(resolve(realpathSync(dirname(output)), basename(output)))
const bytes = readFileSync(inputPath), input = JSON.parse(bytes.toString()) as { rows: Row[] }
if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 5000) throw new Error('Expected 1–5000 rows')
const ids = new Set<string>()
for (const row of input.rows) {
  if (!row.id || ids.has(row.id) || !row.personID || !Array.isArray(row.exclusionReasons)) throw new Error('Invalid row')
  ids.add(row.id)
  if (row.exclusionReasons.length) continue
  assertTimingEvidenceBirthInput(row.birth)
  occurrenceWindow(row.year, row.date)
  // Explicit scope of this adapter: prefecture approximation + JST, never foreign local time.
  if (!/^(北海道|東京都|京都府|大阪府|.{2,3}県)(?:\s|$)/u.test(row.birth.birthplace)) throw new Error('Unreviewed timezone or place')
}
mkdirSync(output, { mode: 0o700 })
const save = (name: string, data: unknown) => writeFileSync(resolve(output, name), JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' })
const observations: CohortObservation[] = []
const cache = new Map<string, ReturnType<typeof buildEventPatternStudy>>()
const results: unknown[] = []
for (const row of input.rows) {
  if (row.exclusionReasons.length) { results.push({ observation: row, status: 'excluded' }); continue }
  const { window, precision } = occurrenceWindow(row.year, row.date)
  const key = JSON.stringify([row.birth, window])
  let result = cache.get(key)
  if (!result) { result = buildEventPatternStudy(row.birth, window); cache.set(key, result) }
  // Label join occurs AFTER independent birth/window calculation.
  observations.push({ id: row.id, personID: row.personID, independenceUnit: row.independenceUnit, category: row.category, precision, window, facts: result.facts })
  results.push({ observation: row, status: 'calculated', precision, result })
  if (observations.length % 10 === 0) console.log(`Calculated ${observations.length} event windows`)
}
save('events.json', { inputSHA256: createHash('sha256').update(bytes).digest('hex'), results })
console.log('Mining single and simultaneous pair candidates')
const patterns = mineCohortCandidates(observations)
save('candidates.json', patterns)
const files = ['../../research/cohortPatternCandidates.ts', './cohortPatternCandidates.ts', '../../research/eventPatternStudy.ts', '../../research/eventPatternRules.ts', '../../research/vimshottariDiagnostic.ts', '../../lib/astrology.ts', '../../lib/ziwei.ts', '../../lib/report/timingWesternEvidence.ts', '../../../package-lock.json']
save('manifest.json', { generatedAt: new Date().toISOString(), inputSHA256: createHash('sha256').update(bytes).digest('hex'),
  sourceHashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(new URL(file, import.meta.url))).digest('hex')])),
  rows: input.rows.length, calculated: observations.length, excluded: input.rows.length - observations.length,
  calculatedPeople: new Set(observations.map(o => o.personID)).size, cachedWindows: cache.size,
  candidateCount: patterns.candidates.length, enumeratedPatterns: patterns.enumeratedPatterns,
  productionEligible: false, birthSourcesVerified: false, eventSourcesFullyVerified: false })
console.log(JSON.stringify({ output, calculated: observations.length, candidates: patterns.candidates.length }))
