import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { BIRTH_FIXTURES, buildFixtureReportInput, type BirthFixture } from '../../lib/report/fixtures.js'
import { buildReportFactsV2 } from '../../lib/report/factsV2.js'
import { extractReportMetadata } from '../../lib/report/metadata.js'
import type { StructuredReport } from '../../lib/reportCards.js'
import { evaluateGroundedPersonality, GROUNDED_PERSONALITY_RULES } from '../../research/personalityGrounding.js'

// Explicit artifact paths only. No environment credentials, API calls or feedback store.
const [comparisonArg, outputArg, viewArg] = process.argv.slice(2)
if (!comparisonArg || !outputArg || !viewArg) throw new Error('Usage: script comparison-directory output-directory preview-directory')
const comparisonDir = resolve(comparisonArg), outputDir = resolve(outputArg), viewDir = resolve(viewArg)
const priorBytes = readFileSync(join(comparisonDir, 'after.json'))
const prior = JSON.parse(priorBytes.toString()) as Array<{ profile: BirthFixture; report: StructuredReport }>
const fixedDay = new Date('2026-09-11T00:00:00Z')
function evaluate(profile: BirthFixture) {
  const input = buildFixtureReportInput(profile, fixedDay)
  return evaluateGroundedPersonality(buildReportFactsV2(input, extractReportMetadata(input)), Boolean(profile.birthTime))
}
const people = prior.map(({ profile, report }) => ({
  profile, current: report.cards.filter(c => c.id === 'core-mind-3' || c.id === 'love-pattern'),
  proposed: evaluate(profile),
}))
const fixtures = BIRTH_FIXTURES.map(profile => ({ profile, proposed: evaluate(profile) }))
const ruleCounts = GROUNDED_PERSONALITY_RULES.map(rule => ({
  id: rule.id, title: rule.title,
  matchedAD: people.filter(p => p.proposed.candidates.some(c => c.id === rule.id)).map(p => p.profile.id),
  matchedFixtureIds: fixtures.filter(p => p.proposed.candidates.some(c => c.id === rule.id)).map(p => p.profile.id),
}))
const metrics = {
  ruleCount: GROUNDED_PERSONALITY_RULES.length, fixtureCount: fixtures.length,
  fixturesWithCandidates: fixtures.filter(p => p.proposed.candidates.length).length,
  fixturesWithoutCandidates: fixtures.filter(p => !p.proposed.candidates.length).length,
  outcomeAccuracy: null, interpretationValidation: 'not-validated',
  cohortNote: '40件は既存の合成出生fixtureで、実人生の正解なし。A〜Dは開発に既知の事例で、未見の的中試験ではない。',
  ruleCounts,
}
const payload = { generatedAt: new Date().toISOString(), sourceAfterSHA256: createHash('sha256').update(priorBytes).digest('hex'), people, metrics }
mkdirSync(outputDir, { recursive: true }); mkdirSync(viewDir, { recursive: true })
writeFileSync(join(outputDir, 'candidate-readings.json'), JSON.stringify(payload, null, 2))
writeFileSync(join(outputDir, 'fixture-audit.json'), JSON.stringify(fixtures, null, 2))
writeFileSync(join(outputDir, 'metrics.json'), JSON.stringify(metrics, null, 2))
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const chapters = [{ id: 'core-mind-3', title: '消耗と回復' }, { id: 'love-pattern', title: '関係の続き方' }]
const sections = chapters.map(chapter => `<section><h2>${chapter.title}</h2><div class="grid">${people.map(person => {
  const candidates = person.proposed.candidates.filter(c => c.chapter === chapter.id)
  const current = person.current.find(c => c.id === chapter.id)
  return `<article><header><h3>${esc(person.profile.id)}</h3><p>${esc(person.profile.birthDate)} ${esc(person.profile.birthTime ?? '時刻不明')} · ${esc(person.profile.birthplace)}</p></header>
  <details class="old"><summary>現在の文章を見る（変更前の参照）</summary>${(current?.sections ?? []).map(s => `<h4>${esc(s.heading)}</h4><p>${esc(s.body)}</p>`).join('')}</details>
  ${candidates.length ? candidates.map(c => `<div class="candidate"><small>新しい判定候補 · ${esc(c.id)}</small><h4>${esc(c.title)}</h4><p>${esc(c.body)}</p><details><summary>この文章が出た条件</summary>
    ${c.conditions.map(condition => `<p><strong>${esc(condition.label)}</strong></p><ul>${condition.evidence.map(f => `<li>${esc(f.factor)}</li>`).join('')}</ul>`).join('')}
    <p>${esc(c.interpretationNote)}</p><p>${esc(c.dataNote)}</p><p>解釈元：${c.sources.map(s => s.startsWith('https://') ? `<a href="${esc(s)}">${esc(s)}</a>` : esc(s)).join(' / ')}</p></details>
    <details><summary>当てはまらない例</summary><p>${esc(c.counterexample)}</p><p>この側に近ければ、この候補を的中とは数えません。</p></details></div>`).join('') : '<p class="empty">今回の8ルールでは該当なし。性質がないという意味ではありません。別の文章で埋めず、判定を保留しています。</p>'}
  </article>`
}).join('')}</div></section>`).join('')
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FATE LAB · 条件から読む比較版</title>
<style>*{box-sizing:border-box}body{background:#f3f1ec;color:#242621;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;margin:0;line-height:1.85}main{max-width:1600px;margin:auto;padding:32px 20px}h1{font-size:clamp(25px,3vw,36px);line-height:1.4}h2{margin-top:40px}h3{margin:0;font-size:26px}h4{font-size:18px;line-height:1.65;margin:10px 0}.intro,.audit{background:white;padding:24px;border-radius:18px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}article{min-width:0;background:#fff;border-radius:18px;padding:20px}article header p,small{font-size:12px;color:#5c6257}.candidate{border-top:2px solid #d4ddd0;margin-top:24px;padding-top:16px}.candidate>p{font-size:15px}details{font-size:13px;margin:14px 0;overflow-wrap:anywhere}summary{cursor:pointer;font-weight:600}.old{background:#f5f4f0;padding:12px;border-radius:10px}.old h4{font-size:15px}.empty{color:#64675f;font-size:14px;padding-top:20px}li{margin:8px 0}a{color:#315342}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #ddd;text-align:left;padding:12px;vertical-align:top}.tablewrap{overflow:auto}code{overflow-wrap:anywhere}.pill{display:inline-block;padding:5px 12px;background:#e7ecdf;border-radius:20px;font-size:13px}@media(max-width:1100px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){main{padding:20px 12px}.grid{grid-template-columns:1fr}.intro,.audit{padding:18px}}
</style><main><p class="pill">ローカルの検証版 · アプリ未反映</p><h1>同じ分類にまとめず、<br>発動した条件から読む。</h1>
<div class="intro"><p>今回は<strong>性格・恋愛の2章／8つの判定候補</strong>を試しています。鑑定全文の完成版ではありません。配置が共通する人には同じ候補が出ます。違う文章にするためだけの振り分けはしていません。</p><p>「金不足だから半年遅れる」「金星×土星なら次の予定で安心」は、この比較版では採用していません。角度や複数条件を区別し、各文章の下に実際の発動条件を示します。</p><p><strong>配置に合うことと、本人に当たることは別です。</strong>解釈は未検証の仮説です。A〜Dの出来事やFB本文をこの判定器へ入力していません。「当てはまらない例」も含めて比較してください。</p><p>閲覧専用です。元の保存済みFBには触れていません。<a href="./">従来の全文比較へ戻る</a></p></div>
${sections}<section class="audit"><h2>どのくらいの人に出るか</h2><p>既存の合成出生データ40件で、${metrics.fixturesWithCandidates}件に1つ以上が該当、${metrics.fixturesWithoutCandidates}件は該当なしでした。これは発動範囲の確認で、的中率ではありません。</p><div class="tablewrap"><table><thead><tr><th>判定候補</th><th>A〜Dの該当</th><th>合成40件の該当数</th></tr></thead><tbody>${ruleCounts.map(r => `<tr><td>${esc(r.title)}</td><td>${r.matchedAD.join('・') || 'なし'}</td><td>${r.matchedFixtureIds.length} / 40</td></tr>`).join('')}</tbody></table></div><p>同一の西洋出生図内で条件が2つ成立しても、独立した2占術の一致とは数えません。四柱推命・算命学などの全判定の改修、時系列、実際の的中試験は今後の範囲です。</p></section></main></html>`
writeFileSync(join(outputDir, 'preview.html'), html)
writeFileSync(join(viewDir, 'grounded.html'), html)
console.log(JSON.stringify(metrics, null, 2))
