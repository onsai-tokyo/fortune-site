import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportInput } from '../deterministicReport.js'
import { buildReportFacts } from './facts.js'
import { buildReportFactsV2 } from './factsV2.js'
import { extractReportMetadata } from './metadata.js'

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    birthDate: '1995-02-20', birthTime: '03:02', birthplace: '愛知県名古屋市', gender: 'female',
    shichuDay: '丙午', nayin: '天河水', sanmeiStar: '調舒星', chusatsu: '申酉天中殺',
    sukuyo: '角宿', lifePathNumber: 1, honmeiName: '五黄土星',
    elementBalance: { scores: { '木': 2, '火': 3, '土': 1, '金': 0, '水': 2 }, method: 'test' },
    fourPillars: [
      { label: '年柱', kanshi: '乙亥', stemTenGod: '比肩', hiddenStems: [] },
      { label: '月柱', kanshi: '戊寅', stemTenGod: '偏印', hiddenStems: [] },
      { label: '日柱', kanshi: '丙午', stemTenGod: '正官', hiddenStems: [] },
      { label: '時柱', kanshi: '庚寅', stemTenGod: '食神', hiddenStems: [] },
    ],
    sanmeiChart: {
      bodyChart: { center: { label: '中心', star: '調舒星' } },
      subordinateStars: { first: { label: '初年期', star: '天将星', stage: '帝旺' } },
    },
    ziwei: { palaces: [{ name: '夫妻宮', majorStars: [{ name: '紫微', mutagen: '' }], minorStars: ['文曲'] }] } as NonNullable<ReportInput['ziwei']>,
    astrology: {
      western: { aspects: ['Mercury trine Moon'], ascendant: { sign: '天秤座', degree: 12 }, midheaven: { sign: '蟹座', degree: 4 } },
      vedic: { moonNakshatra: 'レーヴァティー', moonPada: 2 },
    } as NonNullable<ReportInput['astrology']>,
    ...overrides,
  }
}

test('Fact V2は由来と投票可否を全件に持つ', () => {
  const source = input()
  const facts = buildReportFactsV2(source, extractReportMetadata(source))
  assert.ok(facts.length > 0)
  for (const fact of facts) {
    assert.ok(fact.canonicalSourceId)
    assert.ok(fact.derivations.length > 0)
    assert.equal(typeof fact.votesInConsensus, 'boolean')
    assert.ok(fact.derivations.every(item => item.weight >= 0 && item.weight <= 1))
  }
})

test('紫微斗数はlunarに属し、旧暦・時刻・年干の由来を持つ', () => {
  const source = input()
  const ziwei = buildReportFactsV2(source, extractReportMetadata(source)).filter(fact => fact.system === '紫微斗数')
  assert.ok(ziwei.length > 0)
  assert.ok(ziwei.every(fact => fact.lineage === 'lunar'))
  assert.ok(ziwei.every(fact => ['lunar-date', 'birth-time', 'year-stem'].every(key => fact.derivations.some(item => item.key === key))))
})

test('納音はFactとして保持するが独立票に数えない', () => {
  const source = input()
  const nayin = buildReportFactsV2(source, extractReportMetadata(source)).find(fact => fact.system === '納音')
  assert.ok(nayin)
  assert.equal(nayin.votesInConsensus, false)
  assert.equal(nayin.lineage, 'stems')
})

test('出生時刻なしでは時刻依存Factを返さない', () => {
  const source = input({ birthTime: undefined })
  const facts = buildReportFactsV2(source, extractReportMetadata(source))
  assert.equal(facts.some(fact => fact.requiresBirthTime), false)
  assert.equal(facts.some(fact => fact.derivations.some(item => item.key === 'birth-time')), false)
})

test('PR-1は従来Factの出力を変更しない', () => {
  const source = input()
  const legacy = buildReportFacts(source, extractReportMetadata(source))
  buildReportFactsV2(source, extractReportMetadata(source))
  assert.deepEqual(buildReportFacts(source, extractReportMetadata(source)), legacy)
  assert.ok(legacy.every(fact => !('derivations' in fact) && !('canonicalSourceId' in fact) && !('votesInConsensus' in fact)))
})

test('PR-2aは配列位置ではなく内容からsignature keyを作る', () => {
  const source = input()
  const metadata = extractReportMetadata(source)
  metadata.contradictions = [
    { source: 'astrology', detail: '月と太陽の緊張' },
    { source: 'astrology', detail: '金星と土星の緊張' },
  ]
  metadata.relationshipDistortions = [{ relation: '冲', pillars: '日支と月支', meaning: '関係の揺れ' }]
  metadata.domainHighlights = [{ palace: '夫妻宮', star: '天相', mutagen: '化忌' }]
  const facts = buildReportFactsV2(source, metadata)
  assert.ok(facts.some(fact => fact.signal === 'tension-astrology-月と太陽の緊張'))
  assert.ok(facts.some(fact => fact.signal === 'tension-astrology-金星と土星の緊張'))
  assert.ok(facts.some(fact => fact.signal === 'distortion-冲-日支と月支'))
  assert.ok(facts.some(fact => fact.signal === 'mutagen-夫妻宮-天相-化忌'))
  assert.equal(facts.some(fact => /^tension-astrology-\d+$/.test(fact.signal)), false)
})

test('PR-2a-2は固有名詞を明示表で解決しindependenceへフォールバックしない', () => {
  const source = input({ nayin: '楊柳木', sukuyo: '心宿' })
  const facts = buildReportFactsV2(source, extractReportMetadata(source))
  assert.ok(facts.some(fact => fact.factor === 'nayin:楊柳木' && fact.signal === 'adaptability'))
  assert.ok(facts.some(fact => fact.factor === 'lunarMansion:心宿' && fact.signal === 'insight'))
  assert.ok(facts.some(fact => fact.factor.includes('moonNakshatra:レーヴァティー') && fact.signal === 'sensitivity'))
  assert.ok(facts.some(fact => fact.factor.includes('minorStar:夫妻宮:0:文曲') && fact.signal === 'expression'))
})

test('PR-2a-2は未知名称でFactを捏造しない', () => {
  const warnings: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => { warnings.push(args) }
  try {
    const source = input({ nayin: '未知納音', sukuyo: '未知宿', astrology: { vedic: { moonNakshatra: '未知ナクシャトラ' } } as NonNullable<ReportInput['astrology']> })
    const facts = buildReportFactsV2(source, extractReportMetadata(source))
    assert.equal(facts.some(fact => /未知/.test(fact.factor)), false)
    assert.equal(facts.some(fact => /未知/.test(fact.factor) && fact.signal === 'independence'), false)
    assert.equal(warnings.length, 3)
  } finally {
    console.warn = original
  }
})
