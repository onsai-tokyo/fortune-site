import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, basename, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { buildEventPatternStudy } from '../../research/eventPatternStudy.js'
import type { TimingEvidenceBirthInput } from '../../lib/report/timingEvidencePipeline.js'

interface Observation { id: string; year: number; months?: number[]; note: string }
interface CaseInput { id: string; birth: TimingEvidenceBirthInput; observations: Observation[] }
const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) throw new Error('Expected PRIVATE_INPUT_JSON NEW_PRIVATE_OUTPUT_DIRECTORY')
const repo = realpathSync(fileURLToPath(new URL('../../../..', import.meta.url)))
const outside = (path: string) => {
  const value = relative(repo, path)
  if (!isAbsolute(value) && value !== '..' && !value.startsWith('../')) throw new Error('Private research data must be outside repository')
}
outside(realpathSync(inputPath))
const output = resolve(outputPath)
outside(resolve(realpathSync(dirname(output)), basename(output)))
const bytes = readFileSync(inputPath)
const input = JSON.parse(bytes.toString('utf8')) as { cases: CaseInput[] }
if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 20) throw new Error('Expected 1–20 cases')
const ids = new Set<string>()
// Validate the entire request before doing calculations or creating output files.
for (const c of input.cases) {
  if (!c || typeof c.id !== 'string' || !c.id.trim() || ids.has(c.id) || !Array.isArray(c.observations) || c.observations.length > 100) throw new Error('Invalid case')
  ids.add(c.id)
  const events = new Set<string>()
  for (const e of c.observations) {
    if (!e || typeof e.id !== 'string' || !e.id.trim() || events.has(e.id) || !Number.isInteger(e.year) || typeof e.note !== 'string') throw new Error('Invalid observation')
    events.add(e.id)
    if (e.months !== undefined && (!Array.isArray(e.months) || !e.months.length || e.months.some(m => !Number.isInteger(m) || m < 1 || m > 12)
      || new Set(e.months).size !== e.months.length)) throw new Error('Invalid months')
    const months = [...(e.months ?? Array.from({ length: 12 }, (_, i) => i + 1))].sort((a, b) => a - b)
    if (months.some((m, i) => i > 0 && m !== months[i - 1] + 1)) throw new Error('Non-contiguous months: split into separate windows')
  }
}
const cases = input.cases.map(c => ({ id: c.id, events: c.observations.map(e => {
  const months = [...(e.months ?? Array.from({ length: 12 }, (_, i) => i + 1))].sort((a, b) => a - b)
  const window = { from: `${e.year}-${String(months[0]).padStart(2, '0')}-01`,
    until: new Date(Date.UTC(e.year, months.at(-1)!, 1)).toISOString().slice(0, 10) }
  // Only birth and the declared date window reach the generator. Join the event AFTER calculation.
  const result = buildEventPatternStudy(c.birth, window)
  return { observation: e, result, eventMatch: 'not_assessed' as const }
}) }))
const sources = ['../../research/eventPatternRules.ts', '../../research/eventPatternStudy.ts', './eventPatternStudy.ts',
  '../../research/vimshottariDiagnostic.ts', '../../lib/astrology.ts', '../../lib/astronomyEngineAdapter.ts',
  '../../lib/divination/index.ts', '../../lib/ziwei.ts', '../../lib/report/timingWesternEvidence.ts', '../../../package-lock.json']
const sourceHashes = Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex')]))
const data = { generatedAt: new Date().toISOString(), inputDigest: createHash('sha256').update(bytes).digest('hex'), sourceHashes, cases }
mkdirSync(output, { mode: 0o700 })
writeFileSync(resolve(output, 'study.json'), JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' })
const h = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const prose = cases.map(c => `<section><h2>${h(c.id)}さん</h2>${c.events.map(({ observation, result }) => `<details class="event"><summary>${h(result.window.from)}〜${h(result.window.until)}（終端を含まない）</summary>
  <p class="observation">申告：${h(observation.note)}<br><small>計算後に比較用として表示しています。出来事との一致判定は未実施です。</small></p>
  <details><summary>計算条件・未判定の部分</summary><ul>${result.conditions.map(s => `<li>${h(s)}</li>`).join('')}</ul></details>
  ${[...result.combinations, ...result.readings].map(r => `<article><h3>${h(r.title)}</h3><p>${h(r.body)}</p><p class="meta">${h(r.systems.join('・'))} ／ ${h(r.rules.join('・'))}<br>示唆のある日次サンプル：${r.days.length}日。複数体系が同じサンプル日に対応：${r.multiSystemDays.length}日（異なる根拠群：${r.crossGroupDays.length}日）。件数は的中率ではありません。</p>
  <details><summary>根拠と対象期間を見る</summary><ul>${r.evidence.map(f => `<li>${h(f.system)}：${h(f.detail)}${f.minimumOrb === undefined ? '' : ` ／ 最小角度差 ${f.minimumOrb.toFixed(2)}°`}<br><small>${h(f.days.join('、'))}<br>${h(f.id)}</small></li>`).join('')}</ul></details></article>`).join('') || '<p>この期間で本文の採用条件を満たす根拠はありません。</p>'}
  </details>`).join('')}</section>`).join('')
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FATE LAB 期間別の根拠と鑑定候補</title><style>body{background:#f8f8f5;color:#252525;font:16px/1.8 system-ui;margin:0}main{max-width:940px;margin:auto;padding:28px 18px}h1{font-size:27px}h2{margin-top:44px}h3{font-size:21px}.event{border:1px solid #ddd;border-radius:14px;padding:18px;margin:16px 0}summary{font-weight:600;cursor:pointer}article{background:white;border-radius:12px;padding:22px;margin:20px 0}.observation{background:#efede7;padding:14px}.meta,small{font-size:13px;color:#606060}li{margin:12px 0;overflow-wrap:anywhere}</style><main><h1>期間別の根拠と鑑定候補</h1><p>開発者用・未配信。調査したパターンを追加し、指定期間の計算結果から自動で本文を選びました。申告された出来事を本文に流し込んでいません。</p><p>単独の占術でも表示します。関係の活性化と結末を分け、初交際・再会・入籍などの事実は未判定のままです。以前の年代表値によるプレビューとは計算期間が異なります。</p>${prose}</main></html>`
writeFileSync(resolve(output, 'preview.html'), html, { mode: 0o600, flag: 'wx' })
console.log(JSON.stringify({ output, cases: cases.length, events: cases.reduce((n, c) => n + c.events.length, 0),
  readings: cases.reduce((n, c) => n + c.events.reduce((m, e) => m + e.result.readings.length + e.result.combinations.length, 0), 0), productionEligible: false }, null, 2))
