import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import { buildFixtureReportInput } from '../../lib/report/fixtures.js'
import { buildSelfReport } from '../../lib/report/buildSelfReport.js'
import { extractReportMetadata } from '../../lib/report/metadata.js'
import { evaluateLifeAxis, LIFE_AXIS_ROWS, LIFE_AXIS_VERSION, renderLifeAxis } from '../../research/lifeAxis.js'
import type { ReviewRun } from '../../research/readingReview.js'

// Read-only import of private saved reviews. Never writes to the review ledger or calls a service.
const [reviewsArg, outputArg] = process.argv.slice(2)
if (!reviewsArg || !outputArg) throw new Error('Usage: lifeAxisPreview.ts private-review-directory output-directory')
const reviewDir = resolve(reviewsArg), out = resolve(outputArg)
if (out === reviewDir || out.startsWith(reviewDir + '/')) throw new Error('Output must be outside feedback storage')
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const entries = readdirSync(reviewDir).filter(f => /^review-.*\.json$/.test(f)).sort().map(file => {
  const bytes = readFileSync(join(reviewDir, file)), run = JSON.parse(bytes.toString()) as ReviewRun
  if (run.schemaVersion !== 1 || !run.caseID || !run.birth || !Array.isArray(run.feedback.items)) throw new Error('Invalid saved review')
  return { file, sha256: sha(bytes), run }
})
if (!entries.length) throw new Error('No saved review files found')
const groups = new Map<string, typeof entries>()
for (const entry of entries) groups.set(entry.run.caseID, [...(groups.get(entry.run.caseID) ?? []), entry])
const fixedDate = new Date('2026-09-12T00:00:00Z')
const people = [...groups.values()].map(runs => {
  runs.sort((a, b) => b.run.createdAt.localeCompare(a.run.createdAt) || a.run.id.localeCompare(b.run.id))
  const latest = runs[0].run, birth = latest.birth
  // The candidate receives date/time only. Older outcomes and FB are display-only context below.
  const candidate = evaluateLifeAxis({ birthDate: birth.birthDate, birthTime: birth.birthTime })
  const input = buildFixtureReportInput({ id: latest.caseID, birthDate: birth.birthDate, birthTime: birth.birthTime ?? null,
    birthplace: birth.birthplace, gender: birth.gender, group: birth.birthTime ? 'baseline' : 'no-time' }, fixedDate)
  const generated = buildSelfReport(input, extractReportMetadata(input))
  const current = generated.report.cards.find(c => c.id === 'life-mission')
  if (!current) throw new Error('Current life-mission chapter missing')
  const feedback = runs.flatMap(({ run }) => run.feedback.items.filter(f => f.targetID.startsWith('life-mission/') && f.verdict !== 'unreviewed').map(item => ({
    runID: run.id, revision: run.revision, createdAt: run.createdAt, sourceHash: run.sourceHash,
    target: run.targets.find(t => t.id === item.targetID), item,
  })))
  return { caseID: latest.caseID, birth, candidate, current, currentPipeline: generated.pipelineTag,
    savedLatest: { runID: latest.id, createdAt: latest.createdAt, card: latest.cards.find(c => c.id === 'life-mission') }, feedback }
}).sort((a, b) => a.birth.nickname.localeCompare(b.birth.nickname, 'ja'))

const all = LIFE_AXIS_ROWS.map(renderLifeAxis)
const metrics = { patterns: all.length, titles: new Set(all.map(r => r.title)).size, bodies: new Set(all.map(r => r.body)).size,
  advice: new Set(all.map(r => r.advice)).size, people: people.length,
  savedRuns: entries.length, savedFeedbackItems: entries.reduce((n, e) => n + e.run.feedback.items.filter(f => f.verdict !== 'unreviewed').length, 0),
  lifeAxisFeedbackItems: people.reduce((n, p) => n + p.feedback.length, 0),
  accuracyMeasured: false, productionEnabled: false, dictionaryVersion: LIFE_AXIS_VERSION }
const sourceRoot = resolve(new URL('../../', import.meta.url).pathname)
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.(ts|json)$/.test(e.name) ? [join(dir, e.name)] : [])
}
const sourceHashes = Object.fromEntries(sourceFiles(sourceRoot).sort().map(f => [relative(sourceRoot, f), sha(readFileSync(f))]))
const manifest = { generatedAt: new Date().toISOString(), referenceDate: fixedDate.toISOString(), metrics,
  feedbackFiles: Object.fromEntries(entries.map(e => [e.file, e.sha256])), sourceHashes,
  sourceHash: sha(JSON.stringify(sourceHashes)),
  calculationPolicy: 'Current calcShichu/calcSanmei, JST civil minute; unknown time scans 00:00–23:59 inclusive. No true-solar-time correction, probabilities or FB-based overrides.',
  limitation: 'Known development cases; this comparison is neither an independent outcome test nor proof of the interpretation.' }
mkdirSync(out, { recursive: true, mode: 0o700 }); mkdirSync(join(out, 'view'), { recursive: true, mode: 0o700 })
writeFileSync(join(out, 'comparison.json'), JSON.stringify({ manifest, people }, null, 2), { mode: 0o600 })
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 })

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const paragraphs = (v: string) => v.split('\n').map(p => `<p>${esc(p)}</p>`).join('')
const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const cardHTML = (card: typeof people[number]['current']) => `${paragraphs(card.summary ?? '')}${(card.sections ?? []).map(s => `<h4>${esc(s.heading)}</h4>${paragraphs(s.body)}`).join('')}`
const summaryRows = people.map(p => `<tr><th><a href="#case-${esc(p.caseID)}">${esc(p.birth.nickname)}</a></th><td>${esc(p.birth.birthDate)}<br>${esc(p.birth.birthTime || '出生時刻不明')}</td><td>${p.candidate.candidates.map(c => `${esc(c.reading.conditions.dayPillar)} × ${esc(c.reading.conditions.centerStar)}`).join('<br>') || '計算保留'}</td><td>${p.candidate.candidates.map(c => esc(c.reading.title)).join('<hr>')}</td><td>${p.candidate.status === 'multiple' ? '時刻により複数候補' : p.candidate.status === 'unavailable' ? '計算未完了' : p.birth.birthTime ? '指定時刻で計算' : '全1,440分で同じ文章'}</td></tr>`).join('')
const columns = people.map(p => `<article id="case-${esc(p.caseID)}"><header><p class="eyebrow">人生の軸</p><h2>${esc(p.birth.nickname)}</h2><p>${esc(p.birth.birthDate)} ${esc(p.birth.birthTime || '時刻不明')}<br>${esc(p.birth.birthplace)}</p></header>
  <details class="prior"><summary>現行コードの鑑定文と比べる</summary><p class="note">この生成時点のローカルコードによる結果です。配信済みアプリの結果を取得したものではありません。</p>${cardHTML(p.current)}</details>
  <details class="prior"><summary>保存済みFBを見る（${p.feedback.length}件）</summary><p class="note">旧文章に対する評価です。新候補へ評価を移したり、FBに合わせて出生条件を変えたりしていません。要約と本文に同じFBがある場合も、元の記録のまま載せています。</p>${p.feedback.length ? p.feedback.map(f => `<section class="feedback"><h4>${esc(f.target?.heading ?? f.item.targetID)}</h4><p class="note">旧文：${esc(f.target?.body ?? '')}</p><strong>${esc(({ close: '合っている', partial: '一部合っている', wrong: '違う', unknown: '判断できない', unreviewed: '未評価' })[f.item.verdict])}</strong>${paragraphs(f.item.actual)}<small>${esc(f.item.targetID)} · 元データ revision ${f.revision}</small></section>`).join('') : '<p>この人物の保存済みFBはありません。</p>'}</details>
  ${p.candidate.status === 'unavailable' ? '<p class="notice">一部の時刻を計算できなかったため、鑑定候補を出していません。</p>' : p.candidate.status === 'multiple' ? '<p class="notice">出生時刻によって候補が変わります。以下を本人の性格として一つに断定しません。時間帯の長さは確率ではありません。</p>' : ''}
  ${p.candidate.candidates.map(c => {
    const sections = c.reading.body.split(/\n\n\*\*(.*?)\*\*\n/)
    const sectionHTML = c.selectors.map((s, i) => `<section class="reading-section"><span class="number">${String(i + 1).padStart(2, '0')}</span><h4>${esc(s.heading)}</h4>${paragraphs(sections[2 + i * 2])}<details class="evidence"><summary>この段落を選んだ条件</summary><ul>${s.selectors.map(v => `<li>${esc(v)}</li>`).join('')}</ul><p>${esc(s.note)}</p><small>辞書の参照先：${s.dictionaryKeys.map(esc).join(' / ')}</small></details></section>`)
    return `<div class="candidate"><p class="eyebrow">新しい候補 · ${esc(c.reading.conditions.dayPillar)} × ${esc(c.reading.conditions.centerStar)}</p><h3>${esc(c.reading.title)}</h3><p class="note">${esc(sections[0])}</p>
    <details class="calculation"><summary>出生条件からここまでの計算を見る</summary><p>対象時刻：${c.intervals.map(i => `${time(i.from)}〜${time(i.to)}`).join(' / ')}（日本標準時）</p>${c.evidenceVariants.map(e => `<ol><li>日柱 ${esc(e.dayPillar)} → 日干 ${esc(e.dayStem)}・日支 ${esc(e.dayBranch)}</li><li>月支 ${esc(e.monthBranch)}・節入り経過 ${e.jieDays}日 → 算命学の採用蔵干 ${esc(e.centerStem)} → ${esc(e.centerTenGod)}に対応する中心星 ${esc(e.centerStar)}</li><li>日支 ${esc(e.dayBranch)} → 四柱推命の固定蔵干の本気 ${esc(e.seatPrimaryStem)} → ${esc(e.seatPrimaryTenGod)}</li><li>中心 ${esc(e.centerStem)} と座下 ${esc(e.seatPrimaryStem)} → ${esc(e.relation)}・陰陽${esc(e.polarity)}</li><li>日干 ${esc(e.dayStem)} と日支 ${esc(e.dayBranch)} → 十二運 ${esc(e.twelveStage)}</li></ol><p class="note">算命学の西の星は${esc(e.sanmeiWestStar)}。座下の${esc(e.seatPrimaryTenGod)}とは別の計算で、今回の文章選択には使用しません。</p>`).join('')}<p class="note">出生地・性別・時柱・四柱全体の旺衰・他の人体星図・他占術は、この候補の選択に使用していません。出生地による真太陽時補正も行いません。</p><small>文章識別子：${esc(c.reading.stableKey)}<br>辞書：${esc(c.reading.dictVersion)}</small></details>
    ${sectionHTML.slice(0, 6).join('')}<details class="prior"><summary>成立する月支・日数帯の一覧</summary>${sectionHTML[6]}</details><section class="advice"><h4>確かめるための問い</h4>${paragraphs(c.reading.advice)}<p class="note">合わない箇所は「外れ」として残します。別の根拠で後付けの説明はしません。</p></section></div>`
  }).join('')}</article>`).join('')
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>人生の軸 · 出生条件と文章の比較</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f4f2ec;color:#272b28;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;line-height:1.85}main{max-width:1720px;margin:auto;padding:40px 24px}h1{font-size:clamp(28px,4vw,42px);line-height:1.4}h2{font-size:26px;margin:0}h3{font-size:22px;line-height:1.6}h4{font-size:16px;line-height:1.6;margin:8px 0}p{margin:10px 0}a{color:#335a47}.intro,.overview{background:#fff;border-radius:18px;padding:24px;margin-bottom:24px}.eyebrow{font-size:12px;font-weight:600;color:#577060;letter-spacing:.12em}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;align-items:start}article{background:#fff;border-radius:18px;padding:22px;min-width:0}header{border-bottom:1px solid #e1e5dc;padding-bottom:16px}header p,.note{font-size:13px;color:#656c63}.prior,.calculation{border-radius:10px;background:#f2f3ed;padding:12px;margin:16px 0;font-size:13px}.candidate{border-top:2px solid #b4c3ac;padding-top:16px;margin-top:24px}.reading-section{border-top:1px solid #e8e9e2;padding-top:22px;margin-top:26px;font-size:15px}.number{font-size:13px;color:#90998c}.evidence{font-size:12px;background:#f6f6f2;padding:10px;border-radius:8px;margin-top:14px}details{overflow-wrap:anywhere}summary{cursor:pointer;font-weight:600}small{font-size:11px;color:#6b7268}ul,ol{padding-left:20px}li{margin:8px 0}.feedback{border-top:1px solid #d5dcd1;padding-top:16px;margin-top:20px}.feedback strong{color:#46624b}.advice{background:#f0f3eb;padding:16px;border-radius:12px;margin-top:26px;font-size:14px}.notice{background:#fff1dc;padding:12px;border-radius:8px;font-size:13px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #e2e5dd;padding:12px;text-align:left;vertical-align:top}.table-scroll{overflow:auto}.overview h2{font-size:20px}.footer{margin-top:32px;font-size:13px;color:#596252}@media(max-width:1200px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){main{padding:20px 12px}.grid{grid-template-columns:1fr}.intro,.overview,article{padding:18px}th,td{padding:10px;min-width:110px}}
</style></head><body><main><p class="eyebrow">FATE LAB / 開発者向け比較版 / アプリ未反映</p><h1>「人生の軸」を、<br>条件と文章を並べて確かめる。</h1><div class="intro"><p>日柱と算命学の中心星から選ぶ新候補を、現行コードの文章・保存済みFBと並べました。各段落の「この段落を選んだ条件」から、文章を選ぶきっかけを確認できます。</p><p><strong>保存済みFB ${metrics.savedFeedbackItems}件を保持。「人生の軸」は${metrics.lifeAxisFeedbackItems}件。</strong>ここは閲覧専用です。元の保存履歴を書き換えず、新しい文章にはまだ評価を付けていません。</p><p>600通りは文章の組み合わせです。見出し${metrics.titles}種類・本文${metrics.bodies}種類・助言${metrics.advice}種類で、段落によって共通部分があります。占術の解釈は提出辞書の未検証の仮説で、本人に当たることはまだ確認できていません。</p><p class="note">A〜Dは開発で既に参照した事例です。この比較で的中率を算出しません。今回の対象は「人生の軸」1章だけです。</p></div><section class="overview"><h2>まず4人を並べて見る</h2><div class="table-scroll"><table><thead><tr><th>人物</th><th>出生条件</th><th>選ばれた組み合わせ</th><th>候補の見出し</th><th>時刻の確認</th></tr></thead><tbody>${summaryRows}</tbody></table></div></section><div class="grid">${columns}</div><div class="footer"><p>確認する順番：①合う／違う主張を読む → ②その段落の条件を開く → ③同じ条件の他の人でも成立するかを検証する。文言の好みと本人への適合は分けて記録します。</p><p>日柱・中心星の計算は現行実装と照合済みですが、流派としての妥当性と性格解釈の妥当性は別の検証事項です。時刻不明時の走査は分単位（00:00〜23:59）で、秒境界までの連続時間検証ではありません。</p><p>作成：${esc(manifest.generatedAt)} / 辞書：${esc(LIFE_AXIS_VERSION)}</p></div></main></body></html>`
writeFileSync(join(out, 'view/index.html'), html, { mode: 0o600 })
for (const entry of entries) if (sha(readFileSync(join(reviewDir, entry.file))) !== entry.sha256) throw new Error('Feedback changed during read-only generation; re-run comparison')
console.log(JSON.stringify({ metrics, cases: people.map(p => ({ nickname: p.birth.nickname, status: p.candidate.status,
  patterns: p.candidate.candidates.map(c => c.reading.stableKey) })), preview: join(out, 'view/index.html') }, null, 2))
