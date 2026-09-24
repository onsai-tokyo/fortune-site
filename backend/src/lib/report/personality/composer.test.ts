import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { composePersonality } from './composer.js'
import { PERSONALITY_CATALOG } from './catalogData.js'
import type { PersonalityCatalog, PersonalityInput, PersonalityParagraph, PersonalityReading, PersonalitySource } from './types.js'

const SECTION = '01_人生の軸'
const SPOUSE = '15_配偶者の人物像'
const INPUT: PersonalityInput = { dayPillar: '丙午', mansion: '亢宿' }
const source = (id: string, changes: Partial<PersonalitySource> = {}): PersonalitySource => ({
  id, family: 'day_pillar', key: '丙午', scope: 'common', scopeBasis: 'test-explicit',
  exclusionReasons: [], text: '出典の要旨', urls: [], ...changes,
})
const paragraph = (id: string, changes: Partial<PersonalityParagraph> = {}): PersonalityParagraph => ({
  id, text: `${id}の独立した本文です。`, refs: ['D1'], kind: 'astrological_interpretation',
  scope: 'common', owner: { family: 'day_pillar', key: '丙午' }, reviewStatus: 'material_revised', ...changes,
})
function catalog(paragraphs: PersonalityParagraph[], sources: PersonalitySource[] = [source('D1')]): PersonalityCatalog {
  return {
    version: 'test', chapters: [{ id: 'core', title: '内面', items: [SECTION, SPOUSE] }],
    dayPillars: ['丙午', '壬午'], mansions: ['亢宿', '心宿'],
    sources: Object.fromEntries(sources.map(s => [s.id, s])),
    paragraphs: Object.fromEntries(paragraphs.map(p => [p.id, p])),
    cells: [{ family: 'day_pillar', key: '丙午', sectionId: SECTION, paragraphIds: paragraphs.map(p => p.id) }],
    recipes: [], provenance: { inputs: [], notes: [] },
  }
}
const sections = (reading: PersonalityReading) => reading.chapters.flatMap(c => c.sections)
const texts = (reading: PersonalityReading) => sections(reading).flatMap(s => s.paragraphs.filter(p => p.kind !== 'pending_input').map(p => p.text))
const ids = (reading: PersonalityReading) => sections(reading).flatMap(s => s.paragraphs.filter(p => p.kind !== 'pending_input').map(p => p.id))
const compose = (c: PersonalityCatalog, input: PersonalityInput = INPUT) => composePersonality(input, c)

test('source gate rejects held, missing, unknown-scope, and mixed valid/invalid evidence', () => {
  const ps = [paragraph('good'), paragraph('held', { refs: ['H'] }), paragraph('absent', { refs: ['NO_SUCH_ID'] }),
    paragraph('null-scope', { refs: ['N'] }), paragraph('unknown-scope', { refs: ['U'] }),
    paragraph('mixed', { refs: ['D1', 'H'] }), paragraph('no-evidence', { refs: [] })]
  const c = catalog(ps, [source('D1'), source('H', { exclusionReasons: ['applicability_unconfirmed_T'] }),
    source('N', { scope: null }), source('U', { scope: 'unspecified' })])
  const result = compose(c)
  assert.deepEqual(ids(result), ['good'])
  for (const p of ps.slice(1)) assert.ok(result.audit.some(a => a.paragraphId === p.id && a.disposition === 'withheld'), p.id)
})

test('paragraph-specific holds cannot be cleared by otherwise eligible sources', () => {
  const c = catalog([paragraph('context-expansion', { withheldReasons: ['context_extension_unreviewed'] }), paragraph('good')])
  assert.deepEqual(ids(compose(c)), ['good'])
})

test('source identity and paragraph ownership must match the requested selectors', () => {
  const c = catalog([paragraph('wrong-day', { refs: ['D2'] }), paragraph('wrong-mansion', { refs: ['S2'] }),
    paragraph('wrong-owner', { owner: { family: 'day_pillar', key: '壬午' } }), paragraph('good')],
  [source('D1'), source('D2', { key: '壬午' }), source('S2', { family: 'shukuyo', key: '心宿' })])
  assert.deepEqual(ids(compose(c)), ['good'])
})

test('a female source cannot enter a common paragraph even when female supplements are requested', () => {
  const c = catalog([paragraph('common'), paragraph('leak', { refs: ['F'] }),
    paragraph('female', { refs: ['F'], scope: 'female' }), paragraph('male', { refs: ['M'], scope: 'male' })],
  [source('D1'), source('F', { scope: 'female' }), source('M', { scope: 'male' })])
  assert.deepEqual(ids(compose(c)), ['common'])
  assert.deepEqual(ids(compose(c, { ...INPUT, genderSupplement: 'female' })), ['common', 'female'])
  assert.deepEqual(ids(compose(c, { ...INPUT, genderSupplement: 'male' })), ['common', 'male'])
})

test('gender supplements are explicit and do not infer profile gender or timing direction', () => {
  const c = catalog([paragraph('common'), paragraph('female', { refs: ['F'], scope: 'female' })],
    [source('D1'), source('F', { scope: 'female' })])
  const contaminated = { ...INPUT, gender: 'female', profile: { gender: 'female' }, timingDirection: 'reverse' } as PersonalityInput
  assert.deepEqual(compose(c, contaminated), compose(c))
})

test('advice must have eligible retained dependencies and a recorded derivation', () => {
  const c = catalog([
    paragraph('base'), paragraph('held-base', { refs: ['H'] }),
    paragraph('valid-advice', { kind: 'editorial_advice', derivedFrom: ['base'], derivationNote: 'この特徴への任意の工夫。' }),
    paragraph('held-advice', { kind: 'editorial_advice', derivedFrom: ['held-base'], derivationNote: '保留された特徴から導いた。' }),
    paragraph('missing-advice', { kind: 'editorial_advice', derivedFrom: ['absent'], derivationNote: '欠損した特徴から導いた。' }),
    paragraph('unlinked-advice', { kind: 'editorial_advice', derivationNote: '根拠段落を指定していない。' }),
    paragraph('unreviewed-advice', { kind: 'editorial_advice', derivedFrom: ['base'], derivationNote: '旧稿由来。', reviewStatus: 'legacy_unreviewed' }),
  ], [source('D1'), source('H', { exclusionReasons: ['hold'] })])
  const result = compose(c)
  assert.deepEqual(ids(result), ['base', 'valid-advice'])
  const advice = sections(result).flatMap(s => s.paragraphs).find(p => p.id === 'valid-advice')!
  assert.deepEqual(advice.derivedFrom, ['base'])
  assert.equal(advice.derivationNote, 'この特徴への任意の工夫。')
})

test('empty advice and a tension paragraph are not mandatory to emit supported material', () => {
  const result = compose(catalog([paragraph('only-supported')]))
  assert.deepEqual(ids(result), ['only-supported'])
  assert.ok(!texts(result).some(t => /特に強く|ただし|同時に/.test(t)))
})

test('a reviewed interpretation limit remains visible without inventing a positive personality claim', () => {
  const c = catalog([
    paragraph('limit', { text: '資料の方向が異なるため、貯蓄の傾向は一つに決められません。', kind: 'interpretation_limit' }),
    paragraph('check', { text: '得た額と残る額を分けて確かめてみてください。', kind: 'editorial_advice',
      derivedFrom: ['limit'], derivationNote: '効果を保証せず、解釈の限界に対する任意の確認。' }),
  ])
  const result = compose(c)
  assert.deepEqual(ids(result), ['limit', 'check'])
  assert.equal(sections(result)[0].paragraphs[0].kind, 'interpretation_limit')
  c.paragraphs.limit.refs = ['HELD']
  c.sources.HELD = source('HELD', { exclusionReasons: ['unconfirmed'] })
  assert.deepEqual(ids(compose(c)), [])
})

test('similarity does not erase negation, another actor, or a condition', () => {
  const ps = [
    paragraph('positive', { text: '新しい仕事へ挑戦することを好みます。' }),
    paragraph('negative', { text: '新しい仕事へ挑戦することを好みません。納得してから慎重に動きます。' }),
    paragraph('subject', { text: '相手が新しい仕事へ挑戦することを好みます。' }),
    paragraph('condition', { text: '目標が定まると、新しい仕事へ挑戦することを好みます。' }),
  ]
  assert.deepEqual(texts(compose(catalog(ps))), ps.map(p => p.text))
})

test('only exact text with the same evidence is deduplicated; sources never intensify a claim', () => {
  const text = '人と交流することを好みます。'
  const c = catalog([paragraph('first', { text }), paragraph('same', { text }), paragraph('different-source', { text, refs: ['D2'] })],
    [source('D1'), source('D2')])
  const result = compose(c)
  assert.deepEqual(ids(result), ['first', 'different-source'])
  assert.ok(result.audit.some(a => a.paragraphId === 'same' && a.disposition === 'duplicate'))
  assert.ok(texts(result).every(t => !t.includes('特に強く')))
})

test('evidence order does not turn the same supported sentence into two different claims', () => {
  const text = '自分の考えを丁寧に伝えます。'
  const result = compose(catalog([paragraph('one', { text, refs: ['D1', 'D2'] }), paragraph('two', { text, refs: ['D2', 'D1'] })],
    [source('D1'), source('D2')]))
  assert.equal(texts(result).length, 1)
})

test('recipes use the same evidence gate and cannot authorize excluded material', () => {
  const c = catalog([paragraph('held', { refs: ['H'], reviewStatus: 'representative_reviewed' })],
    [source('H', { exclusionReasons: ['hold'] })])
  c.recipes.push({ id: 'reviewed-pair', sectionId: SECTION, conditions: { dayPillar: '丙午', mansion: '亢宿' }, paragraphIds: ['held'] })
  assert.deepEqual(ids(compose(c)), [])
})

test('a recipe for another pair cannot leak into this pair', () => {
  const c = catalog([paragraph('ordinary'), paragraph('other-pair')])
  c.cells[0].paragraphIds = ['ordinary']
  c.recipes.push({ id: 'different-pair', sectionId: SECTION, conditions: { dayPillar: '壬午', mansion: '心宿' }, paragraphIds: ['other-pair'] })
  assert.deepEqual(ids(compose(c)), ['ordinary'])
})

test('empty, blank, and unknown recipe conditions never act as a universal default', () => {
  const invalidConditions = [{}, { dayPillar: '' }, { mansion: '' }, { nickname: 'unused' }, { dayPillar: '丙午', nickname: 'unused' }]
  for (const conditions of invalidConditions) {
    const c = catalog([paragraph('ordinary'), paragraph('unintended-recipe')])
    c.cells[0].paragraphIds = ['ordinary']
    c.recipes = [{ id: 'malformed-recipe', sectionId: SECTION,
      conditions: conditions as PersonalityCatalog['recipes'][number]['conditions'], paragraphIds: ['unintended-recipe'] }]
    assert.deepEqual(ids(compose(c)), ['ordinary'], JSON.stringify(conditions))
  }
})

test('a recipe cannot promote unreviewed material to representative-reviewed status', () => {
  const c = catalog([paragraph('legacy', { reviewStatus: 'legacy_unreviewed' })])
  c.recipes = [{ id: 'not-an-approval', sectionId: SECTION, conditions: { dayPillar: '丙午' }, paragraphIds: ['legacy'] }]
  const section = sections(compose(c)).find(s => s.id === SECTION)!
  assert.equal(section.paragraphs[0].reviewStatus, 'legacy_unreviewed')
  assert.equal(section.reviewStatus, 'legacy_unreviewed')
})

test('direct source advice is only permitted for reviewed prose with its own eligible references', () => {
  const c = catalog([
    paragraph('base'),
    paragraph('direct', { kind: 'editorial_advice', reviewStatus: 'representative_reviewed', derivedFrom: ['source:D1'], derivationNote: '原記事にある直接助言。' }),
    paragraph('unreviewed-direct', { kind: 'editorial_advice', derivedFrom: ['source:D1'], derivationNote: 'この形式だけで審査を迂回しない。' }),
    paragraph('not-own-source', { kind: 'editorial_advice', reviewStatus: 'representative_reviewed', derivedFrom: ['source:D2'], derivationNote: 'refsにない。' }),
    paragraph('absent-direct', { kind: 'editorial_advice', reviewStatus: 'representative_reviewed', refs: ['ABSENT'], derivedFrom: ['source:ABSENT'], derivationNote: '存在しない出典。' }),
    paragraph('held-direct', { kind: 'editorial_advice', reviewStatus: 'representative_reviewed', refs: ['H'], derivedFrom: ['source:H'], derivationNote: '保留された出典。' }),
  ], [source('D1'), source('D2'), source('H', { exclusionReasons: ['hold'] })])
  assert.deepEqual(ids(compose(c)), ['base', 'direct'])
})

test('spouse sources cannot leak into personal traits or acquire an inferred spouse input', () => {
  const star = source('SP', { family: 'spouse_star', key: '傷官' })
  const c = catalog([paragraph('spouse-leak', { refs: ['SP'], owner: { family: 'spouse_star', key: '傷官' } })], [star])
  assert.deepEqual(ids(compose(c, { ...INPUT, spouse: { star: '傷官', branch: '午' } })), [])
  c.cells = [{ family: 'spouse_star', key: '傷官', sectionId: SPOUSE, paragraphIds: ['spouse-leak'] }]
  c.recipes = [{ id: 'spouse', sectionId: SPOUSE, conditions: { spouseStar: '傷官', spouseBranch: '午' }, paragraphIds: ['spouse-leak'] }]
  const missing = compose(c, { ...INPUT, pendingSpouseReason: 'missing_birth_input' })
  assert.deepEqual(ids(missing), [])
  assert.equal(sections(missing).find(s => s.id === SPOUSE)?.status, 'pending')
})

test('unknown spouse scope remains withheld even with matching selectors and a recipe', () => {
  const c = catalog([paragraph('unknown-spouse', { refs: ['SP'], owner: { family: 'spouse_star', key: '傷官' }, reviewStatus: 'representative_reviewed' })],
    [source('SP', { family: 'spouse_star', key: '傷官', scope: null })])
  c.cells = []
  c.recipes = [{ id: 'spouse', sectionId: SPOUSE, conditions: { spouseStar: '傷官', spouseBranch: '午' }, paragraphIds: ['unknown-spouse'] }]
  assert.deepEqual(ids(compose(c, { ...INPUT, spouse: { star: '傷官', branch: '午' } })), [])
})

test('invalid spouse stars or a branch different from the day pillar remain pending', () => {
  for (const spouse of [{ star: '不明', branch: '午' }, { star: '傷官', branch: '申' }]) {
    const result = compose(catalog([paragraph('base')]), { ...INPUT, spouse })
    assert.equal(sections(result).find(s => s.id === SPOUSE)?.status, 'pending')
    assert.ok(result.audit.some(a => a.sectionId === SPOUSE && a.disposition === 'withheld'))
  }
})

test('invalid selectors cannot silently produce an ordinary reading', () => {
  for (const input of [{ ...INPUT, dayPillar: 'INVALID' }, { ...INPUT, mansion: 'INVALID' }]) {
    assert.throws(() => compose(catalog([paragraph('base')]), input))
  }
})

test('composition preserves source links and is deterministic without DOB, identity, or outcomes', () => {
  const c = catalog([paragraph('base')])
  const before = JSON.stringify(c)
  const first = compose(c)
  const extra = { ...INPUT, birthDate: '2000-01-01', birthTime: '01:23', birthPlace: '入力対象外', nickname: '別人', knownEvents: ['ignored'] } as PersonalityInput
  assert.deepEqual(compose(c, extra), first)
  assert.deepEqual(compose(c), first)
  assert.equal(JSON.stringify(c), before)
  assert.deepEqual(sections(first)[0].paragraphs[0].refs, ['D1'])
})

test('normalized catalogue preserves corrected scope and unresolved exclusions from received sources', () => {
  assert.equal(PERSONALITY_CATALOG.sources['DP38-015'].scope, 'male')
  assert.equal(PERSONALITY_CATALOG.sources['DP38-016'].scope, 'male')
  assert.ok(PERSONALITY_CATALOG.sources['DP01-028'].exclusionReasons.includes('applicability_unconfirmed_T'))
  assert.ok(PERSONALITY_CATALOG.sources['DP05-056'].exclusionReasons.includes('predictive_claim_on_hold_in_source_note'))
  const output = composePersonality({ dayPillar: '辛丑', mansion: '亢宿' })
  const used = sections(output).flatMap(s => s.paragraphs.flatMap(p => p.refs))
  assert.ok(!used.includes('DP38-015') && !used.includes('DP38-016'))
  assert.ok(!used.some(id => PERSONALITY_CATALOG.sources[id]?.exclusionReasons.length))
})

test('all 60 by 27 common readings emit only matching common evidence and keep absent spouses pending', () => {
  assert.equal(PERSONALITY_CATALOG.dayPillars.length, 60)
  assert.equal(PERSONALITY_CATALOG.mansions.length, 27)
  for (const dayPillar of PERSONALITY_CATALOG.dayPillars) for (const mansion of PERSONALITY_CATALOG.mansions) {
    const result = composePersonality({ dayPillar, mansion })
    assert.equal(sections(result).find(s => s.id === SPOUSE)?.status, 'pending', `${dayPillar}/${mansion}`)
    for (const section of sections(result)) for (const p of section.paragraphs) {
      if (p.kind === 'pending_input') continue
      assert.ok(p.refs.length, p.id)
      if (p.kind === 'editorial_advice') assert.notEqual(p.reviewStatus, 'legacy_unreviewed', p.id)
      for (const ref of p.refs) {
        const s = PERSONALITY_CATALOG.sources[ref]
        assert.ok(s, ref)
        assert.equal(s.scope, 'common', `${p.id}/${ref}`)
        assert.deepEqual(s.exclusionReasons, [], `${p.id}/${ref}`)
        assert.ok((s.family === 'day_pillar' && s.key === dayPillar) || (s.family === 'shukuyo' && s.key === mansion), `${p.id}/${ref}`)
      }
    }
  }
})

test('reviewing individual materials never promotes an unreviewed combination to an approved recipe', () => {
  const c = catalog([paragraph('checked', { reviewStatus: 'material_reviewed', reviewId: 'bounded:test' })])
  const reading = compose(c)
  assert.equal(sections(reading)[0].reviewStatus, 'material_reviewed')
  assert.equal(sections(reading)[0].paragraphs[0].reviewId, 'bounded:test')
  c.recipes = [{ id: 'not-approval', sectionId: SECTION, conditions: { dayPillar: INPUT.dayPillar }, paragraphIds: ['checked'] }]
  assert.equal(sections(compose(c))[0].reviewStatus, 'material_reviewed')
  c.recipes = []
  c.paragraphs.unchecked = paragraph('unchecked', { reviewStatus: 'legacy_unreviewed' })
  c.cells[0].paragraphIds.push('unchecked')
  assert.equal(sections(compose(c))[0].reviewStatus, 'legacy_unreviewed')
})

test('approved A/B/C paragraph texts reproduce exactly from selectors rather than birth data', () => {
  // SHA256 of ordered [{id, paragraphs: text[]}], computed independently from approved drafts.
  const cases: Array<{ name: string; input: PersonalityInput; count: number; digest: string }> = [
    { name: 'A', input: { dayPillar: '丙午', mansion: '亢宿', spouse: { star: '傷官', branch: '午' } }, count: 47,
      digest: 'dc9728cdc2e59b0b7420be3d67e57a0d80257d3763dfd0f8b5c51aa0b46c5653' },
    { name: 'B', input: { dayPillar: '壬午', mansion: '心宿', spouse: { star: '正官', branch: '午' } }, count: 48,
      digest: 'c6c97d6ab380fe28c4089872a80c6516e5d3ebb7b719babb3ddc08585ceb26ad' },
    { name: 'C', input: { dayPillar: '丙申', mansion: '箕宿', pendingSpouseReason: 'missing_birth_input' }, count: 44,
      digest: '53664bd769b96b7df822f76edc676769d2e01dce03a49811055dbfd7c983f905' },
  ]
  for (const c of cases) {
    const result = sections(composePersonality(c.input))
    assert.equal(result.reduce((n, s) => n + s.paragraphs.length, 0), c.count, c.name)
    const text = JSON.stringify(result.map(s => ({ id: s.id, paragraphs: s.paragraphs.map(p => p.text) })))
    assert.equal(createHash('sha256').update(text).digest('hex'), c.digest, c.name)
  }
})


test('pair-specific revisions change exactly five common items and preserve other combinations', () => {
  const before: PersonalityCatalog = { ...PERSONALITY_CATALOG,
    recipes: PERSONALITY_CATALOG.recipes.filter(r => !r.id.startsWith('composition-20260924:')) }
  const changed: string[] = []
  for (const dayPillar of PERSONALITY_CATALOG.dayPillars) for (const mansion of PERSONALITY_CATALOG.mansions) {
    const input = { dayPillar, mansion }
    const old = sections(composePersonality(input, before))
    const now = sections(composePersonality(input))
    now.forEach((section, index) => {
      if (JSON.stringify(section) !== JSON.stringify(old[index])) changed.push(`${dayPillar}/${mansion}/${section.id.slice(0, 2)}`)
    })
  }
  assert.deepEqual(changed.sort(), ['丁卯/角宿/02', '丁卯/角宿/05', '丁卯/角宿/09', '丁卯/房宿/05', '丁卯/房宿/09'].sort())
})

test('conflicting readings stay in explicit limits, while duplicate work-absorption is stated once', () => {
  for (const mansion of ['角宿', '房宿']) {
    const output = sections(composePersonality({ dayPillar: '丁卯', mansion }))
    const relationship = output.find(s => s.id.startsWith('09_'))!
    assert.equal(relationship.reviewStatus, 'composition_revised')
    const conflict = relationship.paragraphs.find(p => p.kind === 'interpretation_limit')!
    assert.ok(conflict.refs.includes('DP04-030'))
    assert.ok(conflict.refs.includes(mansion === '角宿' ? 'SY12-054' : 'SY15-005'))
    assert.match(conflict.text, /決められません/)
    assert.ok(relationship.paragraphs.filter(p => p.kind === 'astrological_interpretation').every(p => !/相手任せ|献身|尽くす/.test(p.text)))
    const recovery = output.find(s => s.id.startsWith('05_'))!
    const work = recovery.paragraphs.filter(p => /仕事/.test(p.text))
    assert.equal(work.length, 1)
    assert.ok(work[0].refs.includes('DP04-046'))
    assert.ok(work[0].refs.includes(mansion === '角宿' ? 'SY12-060' : 'SY15-059'))
    if (mansion === '角宿') {
      const thinking = output.find(s => s.id.startsWith('02_'))!
      const limit = thinking.paragraphs.find(p => p.kind === 'interpretation_limit')!
      assert.deepEqual(limit.refs, ['DP04-021', 'SY12-038'])
      assert.match(limit.text, /どの場面でどちらが表れるかまではわかりません/)
    }
  }
})
