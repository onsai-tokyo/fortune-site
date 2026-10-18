import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, StructuredReport } from '../reportCards.js'
import { readingSnapshot } from '../readingRevision.js'
import { previewRouter } from '../../routes/preview.js'
import { buildSelfReport, resolveSelfReportOptions, selfReportPipelineTag } from './buildSelfReport.js'
import { reportContractViolations } from './contract.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { extractReportMetadata } from './metadata.js'
import { composePersonality } from './personality/composer.js'
import { resolveSpouseTimeZone } from './personality/birthContext.js'
import {
  buildPersonalityStructuredReport, personalityCardShapeIsValid, PERSONALITY_CHAPTER_ITEMS,
  PERSONALITY_CARD_IDS, personalityFeatureTitle, PERSONALITY_LAYOUT_VERSION, PERSONALITY_VERSION, PERSONALITY_SPOUSE_VERSION, type PersonalitySection, type PersonalityReport,
} from './personalityReport.js'
import { storedReportFromCalculatedData } from './storedReport.js'

// These are editorial selectors, not claims that the optional birth fields
// below calculate to the chosen day pillar or mansion.
function selectorInput(shichuDay = '丙午', sukuyo = '亢'): ReportInput {
  return { shichuDay, sukuyo, nayin: '', sanmeiStar: '調舒星', chusatsu: '', lifePathNumber: 1, honmeiName: '' }
}
const chapterIds = PERSONALITY_CARD_IDS
const itemIds = Object.values(PERSONALITY_CHAPTER_ITEMS).flat()
const timingCard: ReportCard = {
  id: 'test-timing', kind: 'timing', scope: 'self', tab: 'timing', title: '時期', summary: '期間の読み',
  tags: ['時期'], period: null, pages: [{ role: 'core', label: '時期', text: '時期の本文。' }],
  evidence: [{ family: 'test', system: 'test', detail: 'fixture' }],
}
function withTiming(report: StructuredReport): StructuredReport { return { ...report, cards: [...report.cards, timingCard] } }

test('personality is explicitly selected and asset/layout versions separate its pipeline identity', () => {
  assert.equal(resolveSelfReportOptions({}).narrativeEngine, 'blocks')
  assert.equal(resolveSelfReportOptions({ NARRATIVE_ENGINE: 'invalid' }).narrativeEngine, 'blocks')
  const options = resolveSelfReportOptions({ NARRATIVE_ENGINE: ' personality ' })
  assert.equal(options.narrativeEngine, 'personality')
  const tag = selfReportPipelineTag(options)
  assert.ok(tag.includes(PERSONALITY_VERSION))
  assert.ok(tag.includes(PERSONALITY_LAYOUT_VERSION))
  assert.ok(tag.includes(PERSONALITY_SPOUSE_VERSION))
  assert.notEqual(tag, selfReportPipelineTag(resolveSelfReportOptions({})))
})

test('the three reviewed selectors retain every paragraph, source and 15 category / feature-title cards', () => {
  for (const [dayPillar, mansion] of [['丙午', '亢宿'], ['壬午', '心宿'], ['丙申', '箕宿']]) {
    const input = selectorInput(dayPillar, mansion.replace(/宿$/, ''))
    const report = buildPersonalityStructuredReport(input)
    const composition = composePersonality({ dayPillar, mansion, genderSupplement: null })
    assert.deepEqual(report.cards.map(card => card.id), chapterIds)
    assert.deepEqual(report.cards.flatMap(card => (card.sections as PersonalitySection[]).map(s => s.personality.itemId)), itemIds)
    assert.deepEqual(buildPersonalityStructuredReport({ ...input, sukuyo: mansion }), report)
    assert.equal(report.personality.genderSupplement, null)
    assert.equal(report.personality.spouseCalculationConnected, true)
    assert.equal(report.personality.spouseCalculation.status, 'pending')
    assert.ok(report.generatorVersion?.includes(PERSONALITY_VERSION))
    for (const [chapterIndex, card] of report.cards.entries()) {
      assert.equal(card.tab, 'essence')
      assert.equal(card.scope, 'self')
      assert.equal(card.generator, 'deterministic')
      assert.ok(personalityCardShapeIsValid(card))
      for (const [index, section] of (card.sections as PersonalitySection[]).entries()) {
        const original = composition.chapters.flatMap(chapter => chapter.sections)[chapterIndex]
        assert.equal(section.body, original.paragraphs.map(p => p.text).join('\n\n'))
        assert.equal(card.pages[index].text, section.body)
        assert.deepEqual(section.personality.paragraphs.map(p => p.refs), original.paragraphs.map(p => p.refs))
        assert.deepEqual(section.personality.paragraphs.map(p => p.derivedFrom), original.paragraphs.map(p => p.derivedFrom))
        assert.ok(report.reportText.includes(section.body))
        assert.equal(card.tags[0], original.title)
        assert.notEqual(card.title, original.title)
        const premise = original.paragraphs.find(p => p.kind === 'astrological_interpretation') ?? original.paragraphs[0]
        assert.equal(card.title, personalityFeatureTitle(premise.text))
        assert.equal(section.personality.headline.paragraphId, premise.id)
        assert.deepEqual(section.personality.headline.refs, premise.refs)
        assert.ok(card.evidence.every(e => !/^(DP|SY|SB)\d/.test(e.detail)))
        if (section.personality.status === 'ready') assert.equal(section.personality.reviewStatus, 'representative_reviewed')
      }
    }
    assert.deepEqual(reportContractViolations(withTiming(report)), [])
  }
})

test('card titles retain qualifiers and quoted sentences, and mismatched title or source trace fails validation', () => {
  assert.equal(personalityFeatureTitle('あなたは、頼まれた時には「今すぐ決めない。」と伝えてから考えます。続きです。'),
    '頼まれた時には「今すぐ決めない。」と伝えてから考えます')
  assert.equal(personalityFeatureTitle('大切な相手に限って、時間をかけることがあります。'), '大切な相手に限って、時間をかけることがあります')
  const original = buildPersonalityStructuredReport(selectorInput()).cards[0]
  for (const change of ['title', 'trace', 'category'] as const) {
    const card = structuredClone(original)
    if (change === 'title') card.title = '会議で誰も手を挙げないと、内容を確かめず引き受ける'
    if (change === 'trace') (card.sections![0] as PersonalitySection).personality.headline.refs = ['unrelated-source']
    if (change === 'category') card.tags = ['違う項目']
    assert.equal(personalityCardShapeIsValid(card), false)
  }
  const pending = buildPersonalityStructuredReport(selectorInput()).cards.find(c => c.id === 'personality-15')!
  assert.equal(pending.evidence.length, 0)
  assert.ok(personalityCardShapeIsValid(pending))
  const fake = structuredClone(pending)
  ;(fake.sections![0] as PersonalitySection).personality.status = 'ready'
  assert.ok(reportContractViolations({ version: 3, cards: [fake, timingCard], reportText: '' }).some(v => v.code === 'EMPTY_EVIDENCE'))
})

test('birth-chart gender and either sanmei star cannot silently select prose or spouse material', () => {
  const input = { ...selectorInput(), birthDate: '2000-01-01', birthTime: '12:00', gender: 'female' }
  const first = buildPersonalityStructuredReport(input)
  const second = buildPersonalityStructuredReport({ ...input, gender: 'male', sanmeiStar: '司禄星',
    sanmeiChart: { bodyChart: { west: { label: '西', star: '禄存星' } }, subordinateStars: {} } })
  assert.deepEqual(second, first)
  const spouse = first.cards.flatMap(card => card.sections as PersonalitySection[]).find(s => s.personality.itemId === '15_配偶者の人物像')!
  assert.equal(spouse.personality.status, 'pending')
  assert.deepEqual(spouse.personality.paragraphs[0].refs, [])
  assert.match(spouse.body, /出生地の標準時を確認できない/)
  assert.doesNotMatch(spouse.body, /出生情報が未指定/)
  const missing = buildPersonalityStructuredReport(selectorInput()).cards.flatMap(card => card.sections as PersonalitySection[])
    .find(s => s.personality.itemId === '15_配偶者の人物像')!
  assert.match(missing.body, /出生情報が未指定/)
  const fallback = buildPersonalityStructuredReport(selectorInput('乙丑', '氐'))
  assert.ok(fallback.cards.flatMap(card => card.sections as PersonalitySection[]).some(s => s.personality.reviewStatus === 'legacy_unreviewed'))
})

test('bounded material review survives app serialization without promoting composed readings', () => {
  for (const day of ['甲子', '丁卯']) for (const mansion of ['角', '房']) {
    const report = buildPersonalityStructuredReport(selectorInput(day, mansion))
    const composition = composePersonality({ dayPillar: day, mansion, genderSupplement: null })
    const sections = report.cards.flatMap(card => card.sections as PersonalitySection[])
    const sourceSections = composition.chapters.flatMap(chapter => chapter.sections)
    assert.equal(sections.length, 15)
    for (const [index, section] of sections.entries()) {
      assert.equal(section.body, sourceSections[index].paragraphs.map(p => p.text).join('\n\n'))
      if (section.personality.status === 'pending') {
        assert.equal(section.personality.itemId, '15_配偶者の人物像')
        assert.equal(section.personality.paragraphs[0].reviewId, undefined)
        continue
      }
      const revised = day === '丁卯' && (['05_消耗と回復', '09_関係の築き方'].includes(section.personality.itemId)
        || (mansion === '角' && section.personality.itemId === '02_考え方のくせ'))
      assert.equal(section.personality.reviewStatus, revised ? 'composition_revised' : 'material_reviewed')
      for (const [paragraphIndex, paragraph] of section.personality.paragraphs.entries()) {
        assert.equal(paragraph.reviewStatus, revised ? 'composition_revised' : 'material_reviewed')
        assert.match(paragraph.reviewId!, revised ? /^composition-polish-20260924$/ : /^personal-material-20260924:(day|mansion)$/)
        assert.equal(paragraph.reviewId, sourceSections[index].paragraphs[paragraphIndex].reviewId)
      }
    }
    assert.deepEqual(reportContractViolations(withTiming(report)), [])
    const saved = readingSnapshot({ birthData: {}, calculatedData: {}, reportText: report.reportText, structuredReport: report })
    assert.deepEqual(storedReportFromCalculatedData(JSON.parse(JSON.stringify(saved.calculatedData))), report)
  }
})

test('birthplace resolution accepts app selections and refuses unknown or contradictory free text', () => {
  for (const birthplace of ['東京都', '愛知県名古屋市', ' 名古屋 ', '北海道札幌市', '東京都新宿区']) {
    assert.equal(resolveSpouseTimeZone({ birthplace }), 'Asia/Tokyo', birthplace)
  }
  for (const birthplace of ['', '不明', 'Paris', 'ロンドン', '東京都ではない', '東京都新宿区ではない', '東京都, Paris', '東京都付近']) {
    assert.equal(resolveSpouseTimeZone({ birthplace }), undefined, birthplace)
  }
  assert.equal(resolveSpouseTimeZone({ birthplace: '東京都', birthTimeZone: 'Europe/London' }), 'Europe/London')
  assert.equal(resolveSpouseTimeZone({ birthplace: '東京都', birthTimeZone: '' }), '')
})

test('the adopted spouse calculation selects source material and survives stored-report serialization', () => {
  const input = { ...selectorInput('庚辰', '角'), birthDate: '2026-01-06', birthTime: '00:00', birthplace: '東京都', gender: 'female' }
  const report = buildPersonalityStructuredReport(input)
  const spouse = report.cards.flatMap(c => c.sections as PersonalitySection[]).find(s => s.personality.itemId.startsWith('15_'))!
  assert.equal(spouse.personality.status, 'ready')
  assert.equal(spouse.personality.reviewStatus, 'material_revised')
  assert.match(spouse.body, /星の読みからは、誠実で家庭を大切にし/)
  assert.match(spouse.body, /生まれた日の十二支からは、おおらかで存在感/)
  assert.doesNotMatch(spouse.body, /配偶者になります|必ず結婚/)
  assert.deepEqual(report.personality.spouseCalculation, { status: 'ready', methodVersion: PERSONALITY_SPOUSE_VERSION, star: '正財', branch: '辰' })
  assert.deepEqual(buildPersonalityStructuredReport({ ...input, gender: 'male', sanmeiStar: '石門星' }), report)
  assert.deepEqual(reportContractViolations(withTiming(report)), [])
  assert.ok(!JSON.stringify(report).includes(input.birthDate))
  const saved = readingSnapshot({ birthData: {}, calculatedData: {}, reportText: report.reportText, structuredReport: report })
  assert.deepEqual(storedReportFromCalculatedData(JSON.parse(JSON.stringify(saved.calculatedData))), report)
})

test('missing, unsupported, inconsistent and boundary inputs hold only the spouse item', () => {
  const base = { ...selectorInput('庚辰', '角'), birthDate: '2026-01-06', birthTime: '00:00', birthplace: '東京都' }
  const cases: Array<[Partial<ReportInput>, string, RegExp]> = [
    [{ birthTime: '' }, 'missing_birth_time', /出生情報が未指定/],
    [{ birthplace: 'ロンドン' }, 'missing_time_zone', /出生地の標準時を確認できない/],
    [{ birthTimeZone: 'Europe/London' }, 'unsupported_time_zone', /標準時にはまだ対応/],
    [{ birthDate: '1949-07-01' }, 'unsupported_birth_date', /確認済みの年代/],
    [{ birthDate: '2026-02-30' }, 'invalid_birth_date', /形式を確認できない/],
    [{ birthTime: '24:00' }, 'invalid_birth_time', /形式を確認できない/],
    [{ birthDate: '2026-01-07' }, 'day_pillar_mismatch', /命式と出生情報/],
    [{ birthDate: '2026-02-04', birthTime: '05:01', shichuDay: '己酉' }, 'boundary_uncertain', /境界に近い/],
    [{ birthDate: '2026-01-05', birthTime: '12:00', shichuDay: '己卯' }, 'unresolved_table_convention', /計算方式の根拠を確認中/],
  ]
  for (const [patch, reason, body] of cases) {
    const input = { ...base, ...patch }
    const result = buildPersonalityStructuredReport(input)
    const sections = result.cards.flatMap(c => c.sections as PersonalitySection[])
    const spouse = sections.find(s => s.personality.itemId.startsWith('15_'))!
    assert.equal(result.personality.spouseCalculation.reason, reason)
    assert.equal(spouse.personality.status, 'pending')
    assert.deepEqual(spouse.sourceClaimIds, [])
    assert.match(spouse.body, body)
    const withoutBirth = buildPersonalityStructuredReport(selectorInput(input.shichuDay, input.sukuyo))
    assert.deepEqual(sections.filter(s => !s.personality.itemId.startsWith('15_')),
      withoutBirth.cards.flatMap(c => c.sections as PersonalitySection[]).filter(s => !s.personality.itemId.startsWith('15_')))
    assert.ok(result.cards.every(personalityCardShapeIsValid))
  }
})

test('approved spouse wording is unchanged; its explained term cannot authorize modified prose', () => {
  const report = withTiming(buildPersonalityStructuredReport({ ...selectorInput('壬午', '心'),
    birthDate: '2026-01-08', birthTime: '12:00', birthplace: '東京都' }))
  const section = report.cards.flatMap(c => c.sections ?? []).find(s => s.heading === '配偶者の人物像')!
  const original = composePersonality({ dayPillar: '壬午', mansion: '心宿', spouse: { star: '正官', branch: '午' } })
    .chapters.flatMap(c => c.sections).find(s => s.id.startsWith('15_'))!
  assert.equal(section.body, original.paragraphs.map(p => p.text).join('\n\n'))
  assert.match(section.body, /日支/)
  assert.deepEqual(section.termGloss.map(t => t.term), ['日支'])
  assert.deepEqual(reportContractViolations(report), [])
  section.body = section.body.replace('日支の午からは', '日支の午からは必ず')
  assert.ok(reportContractViolations(report).some(v => v.code === 'JARGON_IN_BODY'))
})

test('long-form allowance requires its own layout, exact item order and matching pages; old length limits remain', () => {
  const report = withTiming(buildPersonalityStructuredReport(selectorInput()))
  assert.ok(report.cards[0].sections![0].body.length > 220)
  assert.deepEqual(reportContractViolations(report), [])
  const legacy = structuredClone(report)
  legacy.cards[0].metadataRefs = legacy.cards[0].metadataRefs!.filter(ref => ref !== PERSONALITY_LAYOUT_VERSION)
  assert.ok(reportContractViolations(legacy).some(v => v.code === 'SECTION_LENGTH' && v.path.startsWith('personality-01')))
  const wrongOrder = structuredClone(report)
  wrongOrder.cards = [wrongOrder.cards[1], wrongOrder.cards[0], ...wrongOrder.cards.slice(2)]
  assert.ok(reportContractViolations(wrongOrder).some(v => v.code === 'SCHEMA' && v.path === 'report'))
  const missingTrace = structuredClone(report)
  delete (missingTrace.cards[0].sections![0] as Partial<PersonalitySection>).personality
  assert.ok(reportContractViolations(missingTrace).some(v => v.code === 'SCHEMA'))
  const differentPage = structuredClone(report)
  differentPage.cards[0].pages[0].text += '異なる本文。'
  assert.ok(reportContractViolations(differentPage).some(v => v.code === 'SCHEMA'))
  const overLimit = structuredClone(report)
  overLimit.cards[0].sections![0].body = 'あ'.repeat(4001)
  overLimit.cards[0].pages[0].text = overLimit.cards[0].sections![0].body
  assert.ok(reportContractViolations(overLimit).some(v => v.code === 'SECTION_LENGTH'))
})

test('a source-gated pending personality item is valid; empty evidence cannot pose as ready prose', () => {
  const card = structuredClone(buildPersonalityStructuredReport(selectorInput()).cards[0])
  const section = card.sections![0] as PersonalitySection
  section.body = 'この項目の文章は、根拠と適用範囲を確認中です。'
  section.evidence = []; section.sourceClaimIds = []
  section.personality.status = 'pending'; section.personality.reviewStatus = 'pending'
  section.personality.paragraphs = [{ id: 'pending:test', refs: [], kind: 'pending_input', reviewStatus: 'pending' }]
  card.pages[0].text = section.body
  card.title = personalityFeatureTitle(section.body)
  section.personality.headline = { paragraphId: 'pending:test', refs: [], method: 'first-interpretation-sentence-v1' }
  assert.ok(personalityCardShapeIsValid(card))
  section.personality.status = 'ready'
  assert.equal(personalityCardShapeIsValid(card), false)
  section.personality.status = 'pending'
  section.personality.paragraphs[0].kind = 'astrological_interpretation'
  assert.equal(personalityCardShapeIsValid(card), false)
})

test('self report swaps only personality chapters, preserves timing and round-trips the complete stored snapshot', () => {
  const input = buildFixtureReportInput(BIRTH_FIXTURES[0])
  const metadata = extractReportMetadata(input)
  const old = buildSelfReport(input, metadata)
  const next = buildSelfReport(input, metadata, { factPipeline: 'v2', narrativeEngine: 'personality' })
  assert.equal(old.report.cards.filter(card => card.kind === 'essence').length, 8)
  assert.deepEqual(next.report.cards.filter(card => card.kind === 'essence').map(card => card.id), chapterIds)
  assert.deepEqual(next.report.cards.filter(card => card.kind === 'timing'), old.report.cards.filter(card => card.kind === 'timing'))
  assert.deepEqual(reportContractViolations(next.report, input), [])
  assert.ok(next.report.generatorVersion?.includes(next.pipelineTag))
  assert.ok(next.report.reportText.length < 60000)
  const serialized = JSON.parse(JSON.stringify(next.report)) as StructuredReport
  const saved = readingSnapshot({ birthData: { birthDate: input.birthDate }, calculatedData: { shichuDay: input.shichuDay },
    reportText: serialized.reportText, structuredReport: serialized })
  assert.deepEqual(storedReportFromCalculatedData(saved.calculatedData), next.report)
  assert.equal(saved.declaredVersions?.generatorVersion, next.report.generatorVersion)
  assert.throws(() => readingSnapshot({ birthData: {}, calculatedData: {}, reportText: serialized.reportText + '改変', structuredReport: serialized }), /REPORT_TEXT_MISMATCH/)
})

class ResponseStub extends EventEmitter {
  destroyed = false; writableEnded = false; headersSent = false; statusCode = 200; text = ''; body: unknown
  status(code: number) { this.statusCode = code; return this }
  json(value: unknown) { this.body = value; return this }
  setHeader() {}
  flushHeaders() { this.headersSent = true }
  write(text: string) { this.text += text; return true }
  end(text = '') { this.text += text; this.writableEnded = true }
}

test('generate route keeps 15 item cards in order with a work concern and AI enabled, without an external call', async () => {
  const names = ['NARRATIVE_ENGINE', 'FACT_PIPELINE', 'AI_REPORT_ENABLED', 'DETERMINISTIC_SCOPE'] as const
  const saved = names.map(name => process.env[name]), oldFetch = globalThis.fetch
  process.env.NARRATIVE_ENGINE = 'personality'; process.env.FACT_PIPELINE = 'v2'; process.env.AI_REPORT_ENABLED = 'true'
  delete process.env.DETERMINISTIC_SCOPE
  let fetchCalls = 0
  globalThis.fetch = async () => { fetchCalls++; throw new Error('Unexpected external request') }
  try {
    const handler = (previewRouter as any).stack.find((entry: any) => entry.route?.path === '/generate').route.stack.at(-1).handle
    const response = new ResponseStub()
    await handler({ header: () => '22222222-2222-4222-8222-222222222222', query: { format: 'sse' },
      body: { birthDate: '2000-01-01', birthTime: '12:00', birthplace: '東京都', gender: 'female', currentConcern: 'work' }, headers: {} }, response)
    assert.equal(response.statusCode, 200)
    const complete = response.text.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)))
      .find(event => event.type === 'complete')
    assert.ok(complete, response.text)
    const report = complete.report as StructuredReport
    const spouse = report.cards.flatMap(c => c.sections ?? []).find(s => s.heading === '配偶者の人物像') as PersonalitySection
    assert.equal(spouse.personality.status, 'ready')
    assert.deepEqual((report as PersonalityReport).personality.spouseCalculation, {
      status: 'ready', methodVersion: PERSONALITY_SPOUSE_VERSION, star: '印綬', branch: '午',
    })
    assert.deepEqual(report.cards.filter(card => card.kind === 'essence').map(card => card.id), chapterIds)
    assert.equal(fetchCalls, 0)
    assert.equal(report.generator, 'deterministic')
    assert.equal(report.aiCardCount, 0)
    assert.ok(report.generatorVersion?.includes(PERSONALITY_VERSION))
    assert.ok(report.chartSections && report.chartSections.length >= 5)
    assert.match(response.text, /15項目の特徴と詳しい説明/)
    assert.doesNotMatch(response.text, /重複しない8つ/)
    assert.match(response.text, /\[DONE\]/)
  } finally {
    globalThis.fetch = oldFetch
    names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index] })
  }
})
