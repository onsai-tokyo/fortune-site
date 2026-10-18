/** Offline editorial integration audit; no user data, network, or model calls. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { composePersonality, PERSONALITY_CATALOG as catalog, PERSONALITY_VERSION } from '../../lib/report/personality/composer.js'
import { buildPersonalityStructuredReport, personalityCardShapeIsValid } from '../../lib/report/personalityReport.js'
import type { PersonalityInput } from '../../lib/report/personality/types.js'

const out = resolve(process.argv[2] ?? '../../outputs/fatelab_personality_polish_20260924/personality')
mkdirSync(out, { recursive: true })
const save = (name: string, value: unknown) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n')
const counts = { combinations: 0, genderVariants: 0, sections: 0, emittedParagraphs: 0,
  pendingPersonalityItems: 0, pendingSpouseItems: 0, sourceReferences: 0, appShapesChecked: 0 }
const dispositions: Record<string, Set<string>> = {}
const dispositionOccurrences: Record<string, number> = {}
const pendingItems: Array<{ dayPillar: string; mansion: string; sectionId: string }> = []
const reviews: Record<string, number> = {}
for (const dayPillar of catalog.dayPillars) for (const mansion of catalog.mansions) {
  counts.combinations++
  for (const genderSupplement of [null, 'female', 'male'] as const) {
    const input = { dayPillar, mansion, genderSupplement }
    const reading = composePersonality(input)
    counts.genderVariants++
    assert.equal(reading.chapters.length, 5)
    const sections = reading.chapters.flatMap(c => c.sections)
    assert.equal(sections.length, 15)
    assert.deepEqual(sections.map(s => s.id), catalog.chapters.flatMap(c => c.items))
    counts.sections += sections.length
    for (const section of sections) {
      if (genderSupplement === null) reviews[section.reviewStatus] = (reviews[section.reviewStatus] ?? 0) + 1
      if (section.status === 'pending') {
        assert.equal(section.paragraphs.length, 1)
        assert.deepEqual(section.paragraphs[0].refs, [])
        if (section.id.startsWith('15_')) counts.pendingSpouseItems++
        else {
          counts.pendingPersonalityItems++
          if (genderSupplement === null) pendingItems.push({ dayPillar, mansion, sectionId: section.id })
        }
        continue
      }
      const retained = new Set(section.paragraphs.map(p => p.id))
      for (const p of section.paragraphs) {
        counts.emittedParagraphs++
        assert.ok(p.text.trim() && p.refs.length)
        const material = catalog.paragraphs[p.id]
        assert.ok(material)
        assert.ok(!material.withheldReasons?.length)
        assert.deepEqual(p.refs, material.refs)
        for (const id of p.refs) {
          counts.sourceReferences++
          const s = catalog.sources[id]
          assert.ok(s && s.id === id)
          assert.equal(s.exclusionReasons.length, 0)
          assert.ok(s.scope === 'common' || (s.scope === genderSupplement && material.scope === genderSupplement))
          assert.ok((s.family === 'day_pillar' && s.key === dayPillar) || (s.family === 'shukuyo' && s.key === mansion))
        }
        if (p.kind === 'editorial_advice') {
          assert.notEqual(material.reviewStatus, 'legacy_unreviewed')
          assert.ok(p.derivedFrom?.length && p.derivationNote)
          for (const dep of p.derivedFrom!) assert.ok(dep.startsWith('source:')
            ? material.reviewStatus === 'representative_reviewed' && p.refs.includes(dep.slice(7)) : retained.has(dep))
        }
      }
    }
    if (genderSupplement === null) {
      for (const a of reading.audit) for (const reason of a.reasons) {
        const category = reason.split(':')[0]
        ;(dispositions[category] ??= new Set()).add(a.paragraphId)
        dispositionOccurrences[category] = (dispositionOccurrences[category] ?? 0) + 1
      }
      const report = buildPersonalityStructuredReport({ shichuDay: dayPillar, sukuyo: mansion,
        sanmeiStar: '', chusatsu: '', nayin: '', lifePathNumber: 1, honmeiName: '' })
      assert.ok(report.cards.every(personalityCardShapeIsValid), `${dayPillar} ${mansion}`)
      counts.appShapesChecked += report.cards.length
    }
  }
}
const selectors: Array<{ id: string; label: string; input: PersonalityInput }> = [
  { id: 'H', label: '今回の素材確認：甲子 × 角宿', input: { dayPillar: '甲子', mansion: '角宿' } },
  { id: 'I', label: '今回の素材確認：甲子 × 房宿', input: { dayPillar: '甲子', mansion: '房宿' } },
  { id: 'J', label: '今回の素材確認：丁卯 × 角宿', input: { dayPillar: '丁卯', mansion: '角宿' } },
  { id: 'K', label: '今回の素材確認：丁卯 × 房宿', input: { dayPillar: '丁卯', mansion: '房宿' } },
  { id: 'A', label: '丙午 × 亢宿', input: { dayPillar: '丙午', mansion: '亢宿', spouse: { star: '傷官', branch: '午' } } },
  { id: 'B', label: '壬午 × 心宿', input: { dayPillar: '壬午', mansion: '心宿', spouse: { star: '正官', branch: '午' } } },
  { id: 'C', label: '丙申 × 箕宿', input: { dayPillar: '丙申', mansion: '箕宿' } },
  { id: 'D', label: '壬午 × 箕宿', input: { dayPillar: '壬午', mansion: '箕宿' } },
  { id: 'E', label: '甲寅 × 心宿', input: { dayPillar: '甲寅', mansion: '心宿' } },
  { id: 'F', label: '壬申 × 亢宿', input: { dayPillar: '壬申', mansion: '亢宿' } },
  { id: 'G', label: '戊辰 × 箕宿', input: { dayPillar: '戊辰', mansion: '箕宿' } },
]
const samples = selectors.map(c => {
  const composition = composePersonality(c.input)
  const app = buildPersonalityStructuredReport({ shichuDay: c.input.dayPillar, sukuyo: c.input.mansion,
    sanmeiStar: '', chusatsu: '', nayin: '', lifePathNumber: 1, honmeiName: '' })
  save(`generated_${c.id}.json`, { selector: c.input, composition, app })
  return { ...c, composition, app }
})
const summary = { version: PERSONALITY_VERSION, status: 'passed', counts,
  commonSectionReviewCounts: reviews, pendingItems,
  withheld: Object.fromEntries(Object.entries(dispositions).map(([k, ids]) => [k, {
    distinctParagraphs: ids.size, commonCombinationOccurrences: dispositionOccurrences[k], paragraphIds: [...ids],
  }])),
  limitations: ['Mechanical source and schema checks do not certify every combination’s meaning or readability.',
    'A/B/C retain approved representative recipes. Bounded common-material reviews for 甲子/丁卯/角宿/房宿 are material_reviewed, not approval of every combined reading. Five pair-specific items for 丁卯×角宿/房宿 carry composition_revised, not final approval. Other unread outputs retain their prior status.',
    'These app samples omit birth inputs, so the spouse item remains pending. Editorial A/B show precomputed selectors; the dedicated spouse audit checks the calculation bridge.',
    'This audit makes no predictive accuracy claim, and does not activate or deploy the production engine.'],
}
save('combination_audit.json', summary)
const esc = (x: string) => x.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const pages = samples.map((s, i) => `<section class="reading" id="case-${s.id}"${i ? ' hidden' : ''}><h2>${esc(s.label)}</h2>
  <p class="note">${'ABC'.includes(s.id) ? '承認済みの代表稿を新しい生成処理で再現した結果です。' : 'HIJK'.includes(s.id) ? '今回、出典要旨と意味を照合した素材を組み合わせた見本です。素材の確認と、完成稿としての承認は区別しています。' : '素材修正の反映を確かめる別の組み合わせです。全文の編集確認は未完了です。'}${'AB'.includes(s.id) ? '配偶者像は以前の計算済み条件を指定しています。このアプリ見本は出生情報を渡していないため保留です。出生情報からの計算は別の配偶者検証に収録しています。' : ''}</p>
  <nav>${s.composition.chapters.map(c => `<a href="#${s.id}-${c.id}">${esc(c.title)}</a>`).join('')}</nav>
  ${s.composition.chapters.map(c => `<article id="${s.id}-${c.id}"><h2>${esc(c.title)}</h2>${c.sections.map(section => `<div class="item"><h3>${esc(section.title)}</h3>${section.paragraphs.map(p => `<p${p.kind === 'pending_input' ? ' class="pending"' : ''}>${esc(p.text)}</p>`).join('')}<details><summary>この項目の確認状況と出典</summary><p class="note">${section.reviewStatus === 'representative_reviewed' ? '代表稿として本文確認済み' : section.reviewStatus === 'pending' ? '保留' : section.reviewStatus === 'composition_revised' ? 'この組み合わせの当該項目を修正済み・完成稿の承認とは別' : section.reviewStatus === 'material_reviewed' ? '採用素材の意味を出典要旨と照合済み・組み合わせ全文の承認とは別' : section.reviewStatus === 'material_revised' ? '個別素材を修正済み' : '出典の適用条件を機械確認・組み合わせ後の文章確認は未完了'}</p>${section.paragraphs.filter(p => p.refs.length).map((p, n) => `<p class="refs">段落${n + 1}：${p.refs.map(ref => catalog.sources[ref].urls[0] ? `<a href="${esc(catalog.sources[ref].urls[0])}" target="_blank" rel="noreferrer">${esc(ref)}</a>` : `<span>${esc(ref)}</span>`).join(' / ')}</p>`).join('')}</details></div>`).join('')}</article>`).join('')}
  <details><summary>アプリで表示する配偶者像の項目</summary><p>${esc(s.app.cards.flatMap(c => c.sections!).find(x => x.heading === '配偶者の人物像')!.body)}</p></details></section>`).join('')
writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FATELAB｜生成処理の確認</title><style>
body{margin:0;background:#f7f4ee;color:#272624;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN",sans-serif}main{max-width:800px;margin:auto;padding:42px 24px 80px}h1{font-weight:500;font-size:29px}h2{font-size:23px;font-weight:500;line-height:1.6}article h2{margin:50px 0 28px;border-bottom:1px solid #d7cfc0;padding-bottom:16px}h3{font-size:19px;font-weight:600;margin:35px 0 20px}p{font-size:16px;line-height:2.05;margin:0 0 20px}.eyebrow{font-size:12px;letter-spacing:.2em;color:#756551}.note{font-size:13px;color:#756b60;line-height:1.9}select{width:100%;font:inherit;padding:13px;border:1px solid #d7cfc0;border-radius:8px;background:#fffdf8;margin:9px 0 30px}nav{display:flex;gap:10px;flex-wrap:wrap}nav a{border:1px solid #ded6c7;border-radius:22px;padding:8px 12px;font-size:12px;text-decoration:none}a{color:#6b5137}details{background:#eeeae2;padding:14px 18px;border-radius:8px;margin:20px 0}summary{cursor:pointer;font-size:13px;color:#756551}.refs{font-size:12px;line-height:1.9;margin-top:15px}footer{margin-top:40px;border-top:1px solid #d7cfc0;padding-top:20px}.pending{border-left:3px solid #b7a38a;padding-left:15px}@media(max-width:600px){main{padding:25px 20px 60px}h1{font-size:25px}p{font-size:15px}}[hidden]{display:none!important}</style></head><body><main>
<header><div class="eyebrow">FATELAB · IMPLEMENTATION REVIEW</div><h1>素材と生成処理の反映確認</h1><p class="note">新しいコードが生成した文章です。今回確認した素材の4組み合わせ、承認済み代表3本、別の比較4組を読めます。本番の切り替え・公開はしていません。</p><label for="case">読む組み合わせ</label><select id="case">${samples.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></header>${pages}<footer><p class="note">機械検査：60日柱 × 27宿 × 共通・女性補足・男性補足＝4,860条件。意味と読みやすさの全件確認とは別です。</p><a href="../実装結果.md">変更内容と残る作業</a></footer></main><script>document.getElementById('case').addEventListener('change',function(){document.querySelectorAll('.reading').forEach(el=>el.hidden=el.id!=='case-'+this.value);history.replaceState(null,'',location.pathname);});</script></body></html>`)
console.log(JSON.stringify({ version: summary.version, status: summary.status, counts, commonSectionReviewCounts: reviews, pendingItems: pendingItems.length }, null, 2))
