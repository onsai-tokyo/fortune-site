import assert from 'node:assert/strict'
import test from 'node:test'
import { compatibilityProfileBlock } from './compatibilityNarrativeAssets.js'
import type { ReportInput } from '../deterministicReport.js'
import { buildCompatibilityTraitScoreBundle, buildDeterministicCompatibilityReport } from './deterministicCompatibility.js'

const self = { shichuDay: '癸卯', lifePathNumber: 1, sukuyo: '角宿' }
const partner = { shichuDay: '乙亥', lifePathNumber: 8, sukuyo: '翼宿' }

test('恋愛相性は決定論で8章・各10ページを返す', () => {
  const first = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い')
  const second = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い')
  assert.deepEqual(first, second)
  assert.equal(first.cards.length, 8)
  assert.ok(first.cards.every(card => card.pages.length === 10 && card.generator === 'deterministic' && card.scope === 'couple'))
  assert.ok(first.cards.every(card => card.pages.every(page => [...page.text].length <= 120)))
  assert.equal(new Set(first.cards.map(card => card.title)).size, 8)
  assert.equal(new Set(first.cards.map(card => card.summary)).size, 8)
  assert.equal(new Set(first.cards.flatMap(card => card.pages.map(page => page.text))).size, 80)
})

test('関係ラベルを本文へ固定し片思いを交際中として書かない', () => {
  const crush = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い')
  const dating = buildDeterministicCompatibilityReport(self, partner, 'romantic', 'お付き合い中')
  const crushText = crush.cards.flatMap(card => card.pages.map(page => page.text)).join('\n')
  assert.match(crushText, /片思い/)
  assert.doesNotMatch(crushText, /交際中|お付き合い中/)
  assert.notDeepEqual(crush.cards.map(card => card.pages), dating.cards.map(card => card.pages))
})

test('友人・家族は結婚章を生成せず7章を維持する', () => {
  for (const [type, label] of [['friend', '友人'], ['family', '兄弟姉妹']] as const) {
    const report = buildDeterministicCompatibilityReport(self, partner, type, label)
    assert.equal(report.cards.length, 7)
    assert.ok(!report.cards.some(card => card.id === 'compat-marriage'))
  }
})

test('占術用語は本文へ出さず根拠にだけ保持する', () => {
  const report = buildDeterministicCompatibilityReport(self, partner, 'romantic', '片思い')
  const readerText = report.cards.flatMap(card => [card.title, card.summary, ...card.pages.flatMap(page => [page.label, page.text])]).join('\n')
  assert.doesNotMatch(readerText, /天中殺|日柱|日主|干支|五行|通変星|宿曜|納音|命宮|夫妻宮|癸卯|乙亥/u)
  assert.ok(report.cards.every(card => card.evidence.some(item => item.detail.includes('癸卯'))))
})

const scoredInput = (day: string, sign: string): ReportInput => ({
  birthDate: '1995-02-20', birthTime: '03:02', birthplace: '名古屋市', gender: 'female',
  shichuDay: day, nayin: '澗下水', sanmeiStar: '鳳閣星', chusatsu: '申酉天中殺', sukuyo: '婁', lifePathNumber: 1, honmeiName: '五黄土星',
  fourPillars: [{ label: '日柱', kanshi: day, stemTenGod: '比肩', hiddenStems: [{ stem: '甲', tenGod: '比肩' }] }],
  elementBalance: { scores: { 木: 3, 火: 2, 土: 1, 金: 2, 水: 2 }, method: 'test' },
  astrology: {
    available: true, method: 'test',
    western: { ascendant: { sign, degree: 12 }, planets: [
      { name: '月', longitude: 100, sign, degree: 10, retrograde: false },
      { name: '金星', longitude: 130, sign, degree: 10, retrograde: false },
    ], aspects: ['月と金星 トライン'] },
    vedic: { ayanamsha: 24, ascendant: { sign, degree: 18 }, planets: [], moonNakshatra: 'ローヒニー', moonPada: 2 },
  },
})

test('個人情報を渡さず集計済みの二人比較スコアだけを根拠へ接続する', () => {
  const selfInput = scoredInput('甲子', '蟹座')
  const partnerInput = scoredInput('辛酉', '山羊座')
  const bundle = buildCompatibilityTraitScoreBundle(selfInput, partnerInput)
  assert.deepEqual(bundle.pair.map(score => score.key), [
    'compatibility_transparency', 'compatibility_independence', 'compatibility_lifestyle', 'compatibility_value_match',
  ])
  assert.equal(bundle.profile[0].key, 'conversational_flow')
  assert.deepEqual(Object.keys(bundle.mutualUnderstanding.components), ['cognitive', 'emotional', 'deep'])
  const report = buildDeterministicCompatibilityReport(selfInput, partnerInput, 'romantic', '片思い', bundle)
  const serialized = JSON.stringify(report)
  assert.doesNotMatch(serialized, /1995-02-20|03:02|名古屋市/)
  assert.ok(report.cards.every(card => !card.metadataRefs?.includes('pairTraitScore.compatibility_transparency')))
  assert.ok(report.cards.every(card => !card.evidence.some(e => e.detail.startsWith('compatibility_transparency='))))
  assert.ok(report.cards.every(card => card.evidence.filter(item => item.system === '決定論スコア').every(item => !/confidence=0(?:$|;)/.test(item.detail))))
  assert.deepEqual(report.cards.find(card => card.id === 'compat-beginning')?.metadataRefs?.filter(ref => ref.startsWith('pairTraitScore.')), [])
  assert.ok(bundle.pair.every(score => score.confidence === 0))
  assert.deepEqual(report.cards.find(card => card.id === 'compat-marriage')?.metadataRefs?.filter(ref => ref.startsWith('pairTraitScore.')), [])
  assert.deepEqual(report.cards.find(card => card.id === 'compat-caution')?.metadataRefs?.filter(ref => ref.startsWith('mutualUnderstanding.')), [
    ...Object.values(bundle.mutualUnderstanding.components).filter(c => c.confidence > 0).map(c => `mutualUnderstanding.${c.key}`),
  ])
})

test('birth-only pipeline does not invent unresolved power struggle for long-term binding', () => {
  const bundle = buildCompatibilityTraitScoreBundle(scoredInput('癸卯', '牡羊座'), scoredInput('乙亥', '獅子座'))
  const longTerm = bundle.profile.find(score => score.key === 'long_term_binding')!
  assert.equal(longTerm.confidence, 0)
  assert.deepEqual(longTerm.contributingFacts, [])
})


test('birth-only profiles retain disclosure and dependent predictions as unknown', () => {
  const bundle = buildCompatibilityTraitScoreBundle(scoredInput('癸卯', '牡羊座'), scoredInput('乙亥', '獅子座'))
  for (const key of ['transparency', 'predictability', 'betrayal_risk_pattern']) {
    const score = bundle.profile.find(score => score.key === key)!
    assert.equal(score.confidence, 0, key)
    assert.deepEqual(score.contributingFacts, [], key)
    assert.equal(score.directions, undefined, key)
    assert.equal(compatibilityProfileBlock(score, '会話'), null, key)
  }
})


test('only available pair scores appear as report evidence', () => {
  const left = scoredInput('癸卯', '牡羊座'), right = scoredInput('乙亥', '獅子座')
  const bundle = buildCompatibilityTraitScoreBundle(left, right)
  bundle.pair = bundle.pair.map(score => score.key === 'compatibility_independence' ? { ...score, value: .8, confidence: .7 } : score)
  const report = buildDeterministicCompatibilityReport(left, right, 'romantic', '片思い', bundle)
  const card = report.cards.find(card => card.id === 'compat-marriage')!
  assert.deepEqual(card.metadataRefs!.filter(ref => ref.startsWith('pairTraitScore.')), ['pairTraitScore.compatibility_independence'])
  assert.ok(card.evidence.some(e => e.detail === 'compatibility_independence=0.8; confidence=0.7'))
  assert.ok(!report.cards.some(c => c.evidence.some(e => e.detail.startsWith('compatibility_transparency='))))
})


test('unknown profile and understanding values do not appear as report evidence', () => {
  const left = scoredInput('癸卯', '牡羊座'), right = scoredInput('乙亥', '獅子座')
  const bundle = buildCompatibilityTraitScoreBundle(left, right)
  bundle.profile = [
    { key: 'emotional_safety', value: .5, confidence: 0, contributingFacts: [] },
    { key: 'transparency', value: NaN, confidence: .8, contributingFacts: ['invalid'] },
    { key: 'conversational_depth', value: .8, confidence: .7, contributingFacts: ['depth'] },
  ]
  bundle.mutualUnderstanding.components.cognitive = { key: 'cognitive', value: .5, confidence: 0, contributingFacts: [] }
  bundle.mutualUnderstanding.components.emotional = { key: 'emotional', value: NaN, confidence: .8, contributingFacts: ['invalid'] }
  bundle.mutualUnderstanding.components.deep = { key: 'deep', value: .8, confidence: .7, contributingFacts: ['deep'] }
  const card = buildDeterministicCompatibilityReport(left, right, 'romantic', '片思い', bundle).cards.find(c => c.id === 'compat-caution')!
  assert.deepEqual(card.metadataRefs!.filter(ref => ref.startsWith('compatibilityProfile.')), ['compatibilityProfile.conversational_depth'])
  assert.deepEqual(card.metadataRefs!.filter(ref => ref.startsWith('mutualUnderstanding.')), ['mutualUnderstanding.deep'])
  assert.ok(!card.evidence.some(e => /NaN|confidence=0(?:$|;)/.test(e.detail)))
})

test('report keeps strong conversation and weak depth in separate chapters', () => {
  const left = scoredInput('癸卯', '牡羊座'), right = scoredInput('乙亥', '獅子座')
  const bundle = buildCompatibilityTraitScoreBundle(left, right)
  bundle.profile = [
    { key: 'conversational_flow', value: .9, confidence: .8, contributingFacts: ['conversation'] },
    { key: 'conversational_depth', value: .1, confidence: .8, contributingFacts: ['depth'] },
  ]
  const report = buildDeterministicCompatibilityReport(left, right, 'romantic', '片思い', bundle)
  for (const [chapter, key] of [['compat-beginning', 'conversational_flow'], ['compat-caution', 'conversational_depth']] as const) {
    const profile = bundle.profile.find(p => p.key === key)!
    const card = report.cards.find(c => c.id === chapter)!
    const expected = compatibilityProfileBlock(profile, '')!
    assert.ok(card.pages.some(p => p.text.endsWith(expected.text)))
  }
})

test('friction chapter retains high conflict and high repair even when power balance is available', () => {
  const left = scoredInput('癸卯', '牡羊座'), right = scoredInput('乙亥', '獅子座')
  const bundle = buildCompatibilityTraitScoreBundle(left, right)
  bundle.profile = [
    { key: 'conflict_intensity', value: .9, confidence: .8, contributingFacts: ['conflict'] },
    { key: 'repair_capacity', value: .9, confidence: .8, contributingFacts: ['repair'] },
    { key: 'power_balance', value: .9, confidence: .8, contributingFacts: ['balance'] },
  ]
  const report = buildDeterministicCompatibilityReport(left, right, 'romantic', '片思い', bundle)
  const text = report.cards.find(c => c.id === 'compat-friction')!.pages.map(p => p.text).join('\n')
  assert.match(text, /反応が強くぶつかっても、関係へ戻る手がかり/)
})

test('invalid profiles cannot alter chapter axes or report text before narrative filtering', () => {
  const left = scoredInput('癸卯', '牡羊座'), right = scoredInput('乙亥', '獅子座')
  const bundle = buildCompatibilityTraitScoreBundle(left, right)
  bundle.profile = []
  const expected = buildDeterministicCompatibilityReport(left, right, 'romantic', '片思い', bundle)
  for (const key of ['conversational_flow', 'conversational_depth', 'conflict_intensity', 'repair_capacity'] as const) {
    for (const field of ['value', 'confidence'] as const) {
      for (const bad of [null, NaN, Infinity, -1, 1.1]) {
        const profile = { key, value: .9, confidence: 1, contributingFacts: ['invalid'], [field]: bad as number }
        const actual = buildDeterministicCompatibilityReport(left, right, 'romantic', '片思い', { ...bundle, profile: [profile] })
        assert.deepEqual(actual, expected, `${key}:${field}:${bad}`)
      }
    }
  }
})
