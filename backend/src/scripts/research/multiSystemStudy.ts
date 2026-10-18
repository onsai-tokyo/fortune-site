import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { buildMultiSystemStudy, compareStudyObservations, type StudyObservation } from '../../research/multiSystemStudy.js'
import { MULTI_SYSTEM_PATTERNS, SINGLE_THEME_COPY } from '../../research/multiSystemPatterns.js'
import { TIMING_SCORE_KEYS } from '../../lib/report/timingClaim.js'
import type { TimingEvidenceBirthInput } from '../../lib/report/timingEvidencePipeline.js'

interface CaseInput { id: string; birth: TimingEvidenceBirthInput; observations: StudyObservation[] }
const [inputArg, outputArg] = process.argv.slice(2)
if (!inputArg || !outputArg) throw new Error('Usage: node --import tsx src/scripts/research/multiSystemStudy.ts PRIVATE_INPUT_JSON NEW_PRIVATE_OUTPUT_DIRECTORY')
const repo = realpathSync(fileURLToPath(new URL('../../../..', import.meta.url)))
const outsideRepo = (path: string) => {
  const value = relative(repo, path)
  if (!value.startsWith('..')) throw new Error('Personal research files must be outside the repository')
}
outsideRepo(realpathSync(inputArg))
const output = resolve(outputArg)
outsideRepo(resolve(realpathSync(dirname(output)), output.split('/').at(-1)!))
const parsed = JSON.parse(readFileSync(inputArg, 'utf8')) as { cases: CaseInput[] }
if (!Array.isArray(parsed.cases) || parsed.cases.length === 0 || parsed.cases.length > 20) throw new Error('Expected 1–20 private cases')
const ids = new Set<string>()
for (const item of parsed.cases) {
  if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id) || !Array.isArray(item.observations)) throw new Error('Invalid case ID/observations')
  ids.add(item.id)
  const events = new Set<string>()
  for (const event of item.observations) {
    if (!event || typeof event.id !== 'string' || events.has(event.id) || !Number.isInteger(event.year)
      || typeof event.note !== 'string' || !Array.isArray(event.themes) || event.themes.length === 0
      || event.themes.some(key => !TIMING_SCORE_KEYS.includes(key))
      || (event.months !== undefined && (!Array.isArray(event.months) || event.months.some(m => !Number.isInteger(m) || m < 1 || m > 12)))) throw new Error('Invalid observation')
    events.add(event.id)
  }
}
const cases = parsed.cases.map(item => {
  const study = buildMultiSystemStudy(item.birth, Math.max(2013, item.birth.birthYear + 18), 2026)
  return { id: item.id, study, comparison: compareStudyObservations(study, item.observations) }
})
const files = [
  './multiSystemStudy.ts',
  '../../research/multiSystemStudy.ts', '../../research/multiSystemPatterns.ts', '../../research/vimshottariDiagnostic.ts',
  '../../lib/astrology.ts', '../../lib/astronomyEngineAdapter.ts', '../../lib/divination/index.ts', '../../lib/ziwei.ts',
  '../../lib/report/timingEvidencePipeline.ts', '../../lib/report/timingStemBranchEvidence.ts',
  '../../lib/report/timingAdditionalStemBranchEvidence.ts', '../../lib/report/timingVedicEvidence.ts',
  '../../lib/report/timingWesternEvidence.ts', '../../lib/report/timingZiweiEvidence.ts', '../../../package-lock.json',
]
const sourceHashes = Object.fromEntries(files.map(path => [path, createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex')]))
const outputData = { generatedAt: new Date().toISOString(),
  inputDigest: createHash('sha256').update(readFileSync(inputArg)).digest('hex'), sourceHashes, cases }
mkdirSync(output, { mode: 0o700 }) // Exclusive new directory; no prior study is overwritten.
writeFileSync(resolve(output, 'study.json'), JSON.stringify(outputData, null, 2), { mode: 0o600, flag: 'wx' })
const h = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const labels: Record<string, string> = {
  relationship_activation: '関係の接点', relationship_binding: '関係の継続', relationship_disruption: '関係の調整',
  relationship_secrecy: '関係の不透明さ', relationship_idealization: '関係への期待', marriage_legalization: '関係の正式化',
  career_activation: '仕事への参加', career_change: '働き方の変化', career_expansion: '仕事の拡大', money_status: '金銭・待遇',
  home_family: '住まい・家族', relocation: '場所の変化', education_activation: '学び', education_disruption: '学びの調整',
  identity_reset: '立ち位置の見直し', social_network_change: '人間関係の変化', responsibility: '責任', emotional_stress: '気持ちの負担',
}
const theme = (key: string) => h(labels[key] ?? key)
const body = cases.map(({ id, study, comparison }) => `<section id="${h(id)}"><h2>${h(id)}さん</h2>
  <p>${h([study.input.birthYear, study.input.birthMonth, study.input.birthDay].join('/'))} ${h(study.input.birthHour === undefined ? '時刻不明' : `${study.input.birthHour}:${String(study.input.birthMinute ?? 0).padStart(2, '0')}`)} ${h(study.input.birthplace || '出生地不明')}</p>
  <details><summary>計算条件と未対応事項</summary><ul>${study.limitations.map(l => `<li>${h(l)}</li>`).join('')}</ul></details>
  ${study.years.map(year => `<details class="year"><summary>${year.year}年 — テーマ ${year.singleReadings.length}件・算命学 ${year.sanmeiReadings.length}件</summary>
    <p class="muted">${h(year.temporalClaim)}</p>
    ${year.singleReadings.map(reading => `<article><h3>${h(reading.title)}</h3><p>${h(reading.body)}</p>
      <p class="sources">${h(reading.systems.join('・'))}の示唆</p>
      ${reading.qualification ? `<aside>${h(reading.qualification)}</aside>` : ''}
      <details><summary>どの占術の、どの要素か</summary><ul>${reading.evidence.map(e => `<li>${h(e.sourceFamily)} / ${h(e.detail ?? e.factLineageId)}<br><small>${h(e.factLineageId)}<br>${h(e.timeBasis)}</small></li>`).join('')}</ul>
      ${reading.counterEvidence.length ? `<p>相反する根拠</p><ul>${reading.counterEvidence.map(e => `<li>${h(e.sourceFamily)} / ${h(e.detail ?? e.factLineageId)}<br><small>${h(e.factLineageId)}<br>${h(e.timeBasis)}</small></li>`).join('')}</ul>` : ''}</details></article>`).join('') || '<p>テーマ別の示唆は成立していません。</p>'}
    ${year.sanmeiReadings.map(reading => `<article><h3>算命学：${h(reading.factor)}</h3><p>${h(reading.body)}</p><small>根拠: ${h(reading.id)}。四柱推命と共通の干支に由来する示唆です。</small></article>`).join('')}
    <details><summary>テーマを組み合わせて読む（${year.cards.length}件）</summary>
    ${year.cards.map(card => `<article><h3>${h(card.title)}</h3><p>${h(card.body)}</p>
      <p class="sources">${h(card.systems.join(' × '))} ／ 同じテーマの対応: ${card.agreementThemes.length ? card.agreementThemes.map(theme).join('・') : 'なし（異なる領域の組み合わせ）'}</p>
      
      <details><summary>どの占術の、どの要素か</summary><ul>${card.evidence.map(e => `<li><b>${h(e.sourceFamily)} / ${theme(e.scoreKey)}</b>: ${h(e.detail ?? e.factLineageId)}<br><small>${h(e.factLineageId)}<br>${h(e.timeBasis)}</small></li>`).join('')}</ul></details></article>`).join('') || '<p>組み合わせに必要なテーマが揃っていません。</p>'}</details>
    <details><summary>成立したテーマの根拠区分</summary><ul>${year.themes.map(t => `<li>${theme(t.key)}: ${h(t.status)} (${h(t.families.join(', '))})</li>`).join('')}</ul><p>算出不可 ${year.unavailableEvidenceCount}件。未成立と算出不可はstudy.jsonで区別しています。</p></details>
  </details>`).join('')}
  <h3>申告事例との照合（文章の選択には使っていません）</h3><table><tr><th>時期・申告</th><th>示唆があるテーマ（単独を含む）</th><th>うち複数根拠群の対応</th><th>対応を確認できないテーマ</th><th>申告期間に重なるダシャー区間（計算のみ）</th></tr>${comparison.map(c => `<tr><td>${c.observation.year}${c.observation.months ? '/' + h(c.observation.months.join(',')) : ''}<br>${h(c.observation.note)}</td><td>${c.supportedThemes.map(theme).join('・') || 'なし'}</td><td>${c.correspondence.map(theme).join('・') || 'なし'}</td><td>${c.noSupportedThemes.map(theme).join('・') || 'なし'}<br><small>出来事・月の的中判定は未実施</small></td><td>${c.dashaAvailable ? c.dashaPeriods.map(p => h(`${p.major} / ${p.minor}: ${new Date(p.start).toLocaleDateString("ja-JP", {timeZone:"Asia/Tokyo"})}〜${new Date(p.end).toLocaleDateString("ja-JP", {timeZone:"Asia/Tokyo"})}`)).join("<br>") : "時刻不明につき未判定"}</td></tr>`).join('')}</table></section>`).join('')
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FATE LAB 多占術研究プレビュー</title><style>body{margin:0;background:#f8f8f5;color:#242424;font:16px/1.8 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:30px 20px}h1{font-size:28px}h2{margin-top:60px}h3{font-size:20px}a{color:#514e6e}nav{display:flex;gap:24px}.year{margin:14px 0;border:1px solid #ddd;border-radius:14px;padding:18px}summary{cursor:pointer;font-weight:600}article{background:white;padding:24px;margin:20px 0;border-radius:14px}aside{padding:12px;background:#f1ede7}.muted,small{color:#666}.sources{font-size:14px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}li{margin:10px 0;overflow-wrap:anywhere}</style><main><h1>FATE LAB 多占術の組み合わせ</h1><p>開発者専用・未配信の研究プレビュー。${Object.keys(SINGLE_THEME_COPY).length}種類のテーマ別文章と、20種類の組み合わせ文章。単独の占術に計算上の根拠があれば表示します。算命学の示唆も独立して表示します。数値の閾値・本番接続は変更していません。</p><p>「一致」は年内の占術ルール上のテーマ対応です。実体験の予測成功や特定月の同時成立とは区別します。</p><nav>${cases.map(c => `<a href="#${h(c.id)}">${h(c.id)}さん</a>`).join('')}</nav>${body}</main></html>`
writeFileSync(resolve(output, 'preview.html'), html, { mode: 0o600, flag: 'wx' })
const reached = new Set(cases.flatMap(c => c.study.years.flatMap(y => y.cards.map(card => card.patternId))))
console.log(JSON.stringify({ output, caseCount: cases.length, observationCount: cases.reduce((n, c) => n + c.comparison.length, 0),
  singleThemeCount: Object.keys(SINGLE_THEME_COPY).length, patternCount: MULTI_SYSTEM_PATTERNS.length, reachedPatterns: reached.size,
  unreachedPatterns: MULTI_SYSTEM_PATTERNS.filter(p => !reached.has(p.id)).map(p => p.id),
  yearCounts: cases.map(c => ({ id: c.id, years: c.study.years.length, singleReadings: c.study.years.reduce((n, y) => n + y.singleReadings.length, 0), sanmeiReadings: c.study.years.reduce((n, y) => n + y.sanmeiReadings.length, 0), candidates: c.study.years.reduce((n, y) => n + y.cards.length, 0) })),
  productionEligible: false, qualityEligible: false }, null, 2))
