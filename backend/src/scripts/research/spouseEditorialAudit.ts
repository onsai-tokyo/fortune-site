/** Offline spouse-material audit. Selectors are synthetic, never birth records. */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { composePersonality, PERSONALITY_CATALOG as catalog, PERSONALITY_VERSION } from '../../lib/report/personality/composer.js'
import type { PersonalitySection } from '../../lib/report/personality/types.js'

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const out = resolve(process.argv[2] ?? join(workspace, 'outputs/fatelab_personality_expansion_20260924/spouse'))
const stars = ['比肩', '劫財', '食神', '傷官', '偏財', '正財', '偏官', '正官', '偏印', '印綬']
const branches = [...'子丑寅卯辰巳午未申酉戌亥']
const spouseId = '15_配偶者の人物像'
const commonLimitId = 'spouse-revised:spouse_star:（全体）:limit'
const spouseSources = Object.values(catalog.sources).filter(source => source.family.startsWith('spouse_'))

assert.equal(spouseSources.length, 125)
assert.equal(new Set(spouseSources.map(source => source.id)).size, 125)
for (const source of spouseSources) {
  assert.equal(source.scopeBasis, 'spouse_source_review_20260924', source.id)
  assert.ok(source.reviewedUsage?.trim(), source.id)
  assert.ok(source.scope === 'common' || source.scope === null, source.id)
  if (source.scope === null) assert.ok(source.exclusionReasons.length, source.id)
  else assert.equal(source.exclusionReasons.length, 0, source.id)
}

const oldParagraphs = Object.values(catalog.paragraphs).filter(p => p.id.startsWith('material:spouse_'))
assert.equal(oldParagraphs.length, 52)
assert.ok(oldParagraphs.every(p => p.withheldReasons?.includes('legacy_spouse_interpretation_requires_semantic_review')))
assert.ok(catalog.cells.filter(cell => cell.family.startsWith('spouse_'))
  .every(cell => cell.paragraphIds.every(id => id.startsWith('spouse-revised:'))))

type ApprovedDraft = { sections: Array<{ id: string; paragraphs: Array<{ text: string; refs: string[]; kind?: string }> }> }
const approved = Object.fromEntries(['A', 'B'].map(key => {
  const draft = JSON.parse(readFileSync(join(workspace, `outputs/fatelab_personality_BC_revision_20260924/${key}/draft.json`), 'utf8')) as ApprovedDraft
  const section = draft.sections.find(section => section.id === spouseId)
  assert.ok(section)
  return [key, section]
}))

const sourceUsage: Record<string, number> = {}
const reviewCounts: Record<string, number> = {}
let selectorsChecked = 0
let paragraphsChecked = 0
let referencesChecked = 0
let representativeOriginalsChecked = 0
let genericLimitOrderChecked = 0
const sectionFor = (dayPillar: string, star: string): PersonalitySection => {
  const branch = dayPillar.slice(1)
  const reading = composePersonality({ dayPillar, mansion: '角宿', genderSupplement: null, spouse: { star, branch } })
  const section = reading.chapters.flatMap(chapter => chapter.sections).find(section => section.id === spouseId)
  assert.ok(section)
  assert.equal(section.status, 'ready', `${dayPillar}/${star}`)
  assert.ok(!reading.audit.some(entry => entry.sectionId === spouseId), `${dayPillar}/${star}`)
  return section
}

for (const dayPillar of catalog.dayPillars) for (const star of stars) {
  const branch = dayPillar.slice(1)
  assert.ok(branches.includes(branch))
  const section = sectionFor(dayPillar, star)
  selectorsChecked++
  reviewCounts[section.reviewStatus] = (reviewCounts[section.reviewStatus] ?? 0) + 1
  const representative = branch === '午' && ['傷官', '正官'].includes(star)
  if (representative) {
    const original = approved[star === '傷官' ? 'A' : 'B']
    assert.equal(section.reviewStatus, 'representative_reviewed')
    assert.deepEqual(section.paragraphs.map(p => ({ text: p.text, refs: p.refs, kind: p.kind })),
      original.paragraphs.map(p => ({ text: p.text, refs: p.refs, kind: p.kind ?? 'astrological_interpretation' })))
    assert.ok(section.paragraphs.every(p => p.id.startsWith('reviewed:')))
    representativeOriginalsChecked++
  } else {
    assert.equal(section.reviewStatus, 'material_revised')
    assert.equal(section.paragraphs[0].id, commonLimitId)
    assert.equal(section.paragraphs[0].kind, 'interpretation_limit')
    assert.equal(section.paragraphs.filter(p => p.id === commonLimitId).length, 1)
    assert.equal(catalog.paragraphs[section.paragraphs.at(-1)!.id].owner?.family, 'spouse_branch')
    genericLimitOrderChecked++
  }
  const retained = new Set(section.paragraphs.map(p => p.id))
  for (const p of section.paragraphs) {
    paragraphsChecked++
    const stored = catalog.paragraphs[p.id]
    assert.ok(stored && !stored.withheldReasons?.length && p.refs.length)
    assert.ok(!p.id.startsWith('material:spouse_'))
    assert.equal(p.text, stored.text)
    assert.deepEqual(p.refs, stored.refs)
    assert.equal(p.reviewStatus, representative ? 'representative_reviewed' : 'material_revised')
    for (const ref of p.refs) {
      referencesChecked++
      sourceUsage[ref] = (sourceUsage[ref] ?? 0) + 1
      const source = catalog.sources[ref]
      assert.ok(source && source.id === ref && source.reviewedUsage?.trim(), ref)
      assert.equal(source.scope, 'common', ref)
      assert.equal(source.exclusionReasons.length, 0, ref)
      assert.ok((source.family === 'spouse_star' && [star, '（全体）'].includes(source.key))
        || (source.family === 'spouse_branch' && [branch, '（全体）'].includes(source.key)), ref)
    }
    if (p.kind === 'editorial_advice') {
      assert.equal(p.reviewStatus, 'representative_reviewed')
      assert.ok(p.derivedFrom?.length && p.derivationNote?.trim())
      assert.ok(p.derivedFrom.every(dep => dep.startsWith('source:') ? p.refs.includes(dep.slice(7)) : retained.has(dep)))
    }
  }
}
assert.equal(selectorsChecked, 600)
assert.equal(representativeOriginalsChecked, 10)
assert.equal(genericLimitOrderChecked, 590)

const samples = stars.flatMap((star, starIndex) => branches.map((branch, branchIndex) => {
  const selector = catalog.dayPillars.find(day => day.slice(1) === branch)
  assert.ok(selector)
  return { id: `${starIndex}-${branchIndex}`, star, branch, section: sectionFor(selector, star) }
}))
assert.equal(samples.length, 120)
assert.equal(samples.filter(sample => sample.section.reviewStatus === 'representative_reviewed').length, 2)

const summary = {
  version: PERSONALITY_VERSION,
  status: 'passed',
  inputKind: 'synthetic_material_selectors_no_birth_records',
  counts: {
    sourceReviews: spouseSources.length,
    commonSources: spouseSources.filter(s => s.scope === 'common').length,
    excludedSources: spouseSources.filter(s => s.scope === null).length,
    starMaterials: stars.length, branchMaterials: branches.length,
    distinctMaterialCombinations: samples.length, dayPillarStarSelectors: selectorsChecked,
    paragraphsChecked, referencesChecked, representativeOriginalsChecked, genericLimitOrderChecked,
    legacySpouseParagraphsHeld: oldParagraphs.length,
  },
  selectorReviewCounts: reviewCounts,
  sources: spouseSources.map(source => ({
    id: source.id, family: source.family, key: source.key, scope: source.scope,
    exclusionReasons: source.exclusionReasons, reviewedUsage: source.reviewedUsage,
    emittedReferenceOccurrences: sourceUsage[source.id] ?? 0,
  })),
  limitations: [
    'The 120 star/branch pairs are material combinations; this audit does not assert that all are produced by real birth calculations.',
    'The 600 day-pillar/star selectors check source key compatibility, exclusions, order, provenance and review labels, not astronomical calculation accuracy.',
    'All 125 received source summaries and the new material were semantically reviewed. This is distinct from reading all 120 combined texts or validating the actual spouse prediction.',
    'A/B spouse recipes preserve their approved text and references. Other combinations remain material_revised, never representative_reviewed.',
    'No personal birth dates, times or birthplaces are read or stored by this audit. The production engine is not activated or deployed.',
  ],
}
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'spouse_combination_audit.json'), JSON.stringify(summary, null, 2) + '\n')

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const sourceLink = (ref: string) => {
  const url = catalog.sources[ref].urls.find(url => /^https?:\/\//.test(url))
  return url ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(ref)}</a>` : esc(ref)
}
const statusLabel = (section: PersonalitySection) => section.reviewStatus === 'representative_reviewed'
  ? '承認済みの代表稿を、その本文と出典のまま再現しています。'
  : '個別素材と受領した出典要旨の意味を確認済みです。組み合わせ120通りの全文精読とは異なります。'
const sampleHtml = samples.map((sample, index) => {
  const representative = sample.section.reviewStatus === 'representative_reviewed'
  return `<article id="reading-${sample.id}"${index ? ' hidden' : ''}>
<h2>${esc(sample.star)} × ${esc(sample.branch)}</h2>
<p class="status">${representative ? 'A/Bの承認済み代表稿を優先。共通の限界文を後付けせず、元の順序も保っています。' : '共通の限界文、星の読み、生まれた日の十二支の順に表示しています。'}</p>
<div class="prose">${sample.section.paragraphs.map(p => `<p${p.kind === 'interpretation_limit' ? ' class="limit"' : ''}>${esc(p.text)}</p>`).join('')}</div>
<details><summary>確認状況と出典を見る</summary>
<p>${esc(statusLabel(sample.section))} 実際の結婚相手を当てる精度の検証ではありません。</p>
<p class="technical">確認区分：${esc(sample.section.reviewStatus)}</p>
${sample.section.paragraphs.map((p, n) => `<div class="evidence"><p>段落 ${n + 1}：${p.refs.map(sourceLink).join(' / ')}</p><ul>${p.refs.map(ref => `<li><strong>${esc(ref)}</strong> ${esc(catalog.sources[ref].reviewedUsage ?? '')}</li>`).join('')}</ul>${p.derivationNote ? `<p>助言の導出：${esc(p.derivationNote)}</p>` : ''}</div>`).join('')}
</details></article>`
}).join('')

writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FATELAB｜配偶者文の読み比べ</title>
<style>
:root{color-scheme:light}body{margin:0;background:#f7f4ee;color:#292722;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN",sans-serif}main{max-width:780px;margin:auto;padding:40px 24px 72px}h1,h2{font-weight:500;line-height:1.6}h1{font-size:28px}h2{font-size:23px;margin:34px 0 15px}p{font-size:16px;line-height:2;margin:0 0 22px}.eyebrow{font-size:12px;letter-spacing:.18em;color:#74614c}.note,.status{font-size:13px;color:#716658;line-height:1.9}.selectors{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:28px 0}label{font-size:13px;color:#675d51}select{display:block;width:100%;margin-top:8px;border:1px solid #d8cdbf;border-radius:8px;padding:13px;background:#fffdf8;color:inherit;font:inherit;font-size:16px}.limit{border-left:3px solid #b7a38a;padding-left:16px;color:#655b4f}details{background:#eee9e0;padding:17px;border-radius:8px;margin-top:28px}summary{cursor:pointer;font-size:14px}details p,li{font-size:13px;line-height:1.9}.technical{color:#736a5f;font-size:12px}.evidence{border-top:1px solid #d6cbbd;padding-top:16px;margin-top:16px}.evidence p{margin-bottom:10px}ul{padding-left:20px}li{margin-bottom:10px}a{color:#6d5137}footer{border-top:1px solid #d6cbbd;margin-top:44px;padding-top:22px}footer p{font-size:12px;color:#756b60}[hidden]{display:none!important}@media(max-width:540px){main{padding:26px 20px 52px}h1{font-size:24px}.selectors{gap:12px}.prose p{font-size:15px}}
</style></head><body><main>
<header><div class="eyebrow">FATELAB · EDITORIAL REVIEW</div><h1>配偶者文の読み比べ</h1>
<p class="note">星の素材10種と、生まれた日の十二支の素材12種を組み合わせた確認用の見本です。出生情報から算出した鑑定結果ではありません。実際の相手の性格や結婚の成立を確定するものでもありません。</p>
<div class="selectors"><label for="star">星の素材<select id="star">${stars.map((star, index) => `<option value="${index}">${esc(star)}</option>`).join('')}</select></label><label for="branch">十二支の素材<select id="branch">${branches.map((branch, index) => `<option value="${index}">${esc(branch)}</option>`).join('')}</select></label></div></header>
${sampleHtml}
<footer><p>機械確認：125出典の適用条件、10星×12支の120素材組み合わせ、60日柱×10星の600選択条件。組み合わせ後の意味・読みやすさの全件確認や、配偶者予測の的中検証とは分けています。</p>
<p>本文version：${esc(PERSONALITY_VERSION)}</p><a href="spouse_combination_audit.json">機械検査の記録</a> · <a href="spouse_editorial_review.md">出典要旨の意味レビュー</a></footer>
</main><script>
const star=document.getElementById('star');const branch=document.getElementById('branch');
function selectReading(){const id='reading-'+star.value+'-'+branch.value;document.querySelectorAll('article').forEach(article=>article.hidden=article.id!==id);}
star.addEventListener('change',selectReading);branch.addEventListener('change',selectReading);
</script></body></html>\n`)
console.log(JSON.stringify({ version: summary.version, status: summary.status, counts: summary.counts, output: out }, null, 2))
