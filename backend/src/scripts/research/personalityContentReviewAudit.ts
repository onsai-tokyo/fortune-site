import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { allReviewedParts, buildReviewedCandidate, REVIEW_CHAPTERS, REVIEW_ROWS, PERSONALITY_REVIEW_VERSION, ORIGINAL_DICTIONARY_SHA256 } from '../../research/personalityContentReview.js'

const [outputArg, comparisonArg] = process.argv.slice(2)
if (!outputArg || !comparisonArg) throw new Error('Usage: output-directory previous-comparison.json')
const output = resolve(outputArg)
mkdirSync(output, { recursive: true, mode: 0o700 })
const parts = allReviewedParts()
const results = REVIEW_ROWS.flatMap(row => REVIEW_CHAPTERS.map(ch => buildReviewedCandidate(row, ch.id)))
const compact = results.map(r => ({ ...r, sections: r.sections.map(({ parts: p, ...s }) => ({ ...s, claimIDs: p.map(v => v.claimID) })) }))
const metrics = {
  version: PERSONALITY_REVIEW_VERSION, originalDictionarySHA256: ORIGINAL_DICTIONARY_SHA256,
  parts: parts.length, withheldParts: parts.filter(p => p.status === 'withheld').length,
  unreviewedParts: parts.filter(p => p.status === 'unreviewed').length,
  approvedParts: 0, chapters: results.length, chaptersAffected: results.filter(r => r.sections.some(s => s.status === 'withheld')).length,
  productionEligibleChapters: results.filter(r => r.productionEligible).length,
  newMeaningsWritten: 0, fullTextMeaningReviewCompleted: false,
  perField: results[0].sections.map(s => ({ field: s.field, withheld: results.filter(r => r.sections.find(v => v.field === s.field)?.status === 'withheld').length })),
  note: 'Broad part-level quarantine, not a reproduction of the external 295-case union. Untouched parts remain unreviewed, never approved.',
}
const originalComparisonBytes = readFileSync(resolve(comparisonArg))
const comparison = JSON.parse(originalComparisonBytes.toString()) as { people: Array<{ birth: { nickname: string }; candidate: { candidates: Array<{ reading: { stableKey: string } }> } }> }
const people = comparison.people.map(p => ({ nickname: p.birth.nickname, candidates: p.candidate.candidates.map(c => results.find(r => r.stableKey === c.reading.stableKey)).filter(r => r !== undefined) }))
function save(name: string, value: unknown) { writeFileSync(join(output, name), JSON.stringify(value, null, 2), { mode: 0o600 }) }
save('CLAIM_DISPOSITIONS.json', parts)
save('METRICS.json', metrics)
save('PREVIEW_INPUT.json', { originalComparisonSHA256: createHash('sha256').update(originalComparisonBytes).digest('hex'), people: people.map(p => ({ nickname: p.nickname, stableKeys: p.candidates.map(c => c.stableKey) })) })
writeFileSync(join(output, 'CANDIDATE_DISPOSITIONS_4800.jsonl'), compact.map(r => JSON.stringify(r)).join('\n') + '\n', { mode: 0o600 })

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const fieldNames: Record<string, string> = { title: 'タイトル', opening: '冒頭', section1: '中心星の説明', section2: '生剋からの心理・成果', section3: '具体的な場面', section4: '日干と座下の説明', section5: '十二運の説明', section6: '周囲からの見え方', advice: '助言' }
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>鑑定文の監査反映 · P0保留一覧</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f2ec;color:#292c28;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;line-height:1.8}main{max-width:1300px;margin:auto;padding:32px 20px}h1{font-size:30px;line-height:1.5}h2{font-size:22px}h3{font-size:16px}.notice,article,.overview{background:white;border-radius:16px;padding:22px;margin-bottom:22px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article{min-width:0}summary{cursor:pointer;font-weight:600}details{margin:16px 0;border-top:1px solid #e2e5dc;padding-top:14px;font-size:13px;overflow-wrap:anywhere}.tag{display:inline-block;border-radius:16px;padding:2px 9px;background:#f4ead4;color:#69512c;font-size:12px}.held{background:#f6f3ec;padding:12px;margin:10px 0;border-radius:8px}.held h4{margin:0;font-size:13px}small,.note{font-size:12px;color:#626c60}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:9px;border-bottom:1px solid #e1e3dc}code{word-break:break-all}ul{padding-left:20px}@media(max-width:650px){.grid{grid-template-columns:1fr}main{padding:20px 12px}}
</style><main><p class="note">FATE LAB / ローカル研究 / ${esc(PERSONALITY_REVIEW_VERSION)}</p><h1>意味が確認できていない文を、<br>鑑定の主張から切り離す。</h1><div class="notice"><p>これは修正版の鑑定書ではなく、レビューを受けた<strong>保留箇所の一覧</strong>です。「返りが遅れて来る」を別の言葉で残すことはしていません。</p><p>計算された日柱・中心星・蔵干・十二運は保持しています。既存の原文とFBも保持しています。新しい意味を承認した部分はまだありません。</p><p>外部レビュー：全文を読んだとの報告96章、未確認4,704章。こちらで確認したのは引用原文85件の一致と、期限の衝突60章・助言の重複60章の再現です。全4,800章を意味まで通読したとは扱いません。</p></div><div class="overview"><h2>全8章への反映範囲</h2><p>文言${metrics.parts}部品のうち、${metrics.withheldParts}部品を保留。残る${metrics.unreviewedParts}部品は未確認で、承認済みではありません。全${metrics.chapters}章に保留箇所があります。</p><table><tr><th>文章の層</th><th>保留を含む章</th></tr>${metrics.perField.map(m => `<tr><td>${esc(fieldNames[m.field])}</td><td>${m.withheld} / 4,800</td></tr>`).join('')}</table><p class="note">保留は文言部品単位の暫定措置です。部品中の全単語を誤りと判定した件数ではありません。残りの未確認文も本番向けには出しません。</p></div><div class="grid">${people.map(p => `<article><h2>${esc(p.nickname)}</h2>${p.candidates.map(c => `<h3>${esc(c.displayLabel)}</h3><p class="note">これは構造を識別するラベルです。性格を説明する新しいタイトルは作っていません。</p><p>中心星：${esc(c.conditions.centerStar)}／日干：${esc(c.conditions.dayStem)}／日支本気：${esc(c.conditions.seatPrimaryStem)}＝${esc(c.conditions.seatPrimaryTenGod)}／十二運：${esc(c.conditions.twelveStage)}</p><details><summary>使っている条件・使っていない要素</summary><p>生剋・陰陽：${esc(c.conditions.relation.elementRelation)}・${esc(c.conditions.relation.polarity)}。これは構造情報として保持し、成果や性格へ変換しません。</p><p>保存される日支蔵干は原構造表にすべて残しています。中気・余気、月令、時柱、周囲4位置を足して性格を修正する規則は今回追加していません。</p><p>${esc(c.conditionDescription)}</p></details>${c.sections.map(s => `<details><summary>${esc(fieldNames[s.field])} <span class="tag">${s.status === 'withheld' ? '保留を含む' : '未確認'}</span></summary><p class="note">元の文章が参照した条件：${esc(JSON.stringify(s.calculationSelectors))}</p>${s.parts.map(part => `<div class="held"><h4>${esc(part.dictionaryKey)}</h4><p>${part.status === 'withheld' ? '保留：' + esc(part.reason.join(' ')) : 'この文はまだ意味を確認できていません。承認済みの鑑定には使いません。'}</p><p class="note">関連する指摘：${esc(part.relatedIssueIds.join(' / ') || '個別確認待ち')}</p><details><summary>監査用に旧文を確認</summary><p>${esc(part.originalText)}</p><small>旧文は比較資料であり、新しい鑑定結果ではありません。</small></details></div>`).join('')}</details>`).join('')}`).join('')}</article>`).join('')}</div><p class="note">次の工程：各日柱・中心星について、採用する流派・出典・言ってよい意味・言い過ぎになる拡張を主張ごとに確認し、その後に文章を組み立てます。本人の実話に合わせて空欄を埋めません。</p></main></html>`
writeFileSync(join(output, 'preview.html'), html, { mode: 0o600 })
console.log(JSON.stringify(metrics, null, 2))
