import assert from 'node:assert/strict'
import test from 'node:test'
import { calcAstrology } from '../astrology.js'
import type { ReportInput } from '../deterministicReport.js'
import { extractAstrologyFacts, isMoonSignStableForDay, parseAspect, SIGN_SPEC } from './astrologyFacts.js'
import { buildReportFactsV2 } from './factsV2.js'
import { extractReportMetadata } from './metadata.js'

function source(overrides: Partial<ReportInput> = {}): ReportInput {
  const astrology = calcAstrology(1995, 2, 20, 3, 2, '愛知県')
  return {
    birthDate: '1995-02-20', birthTime: '03:02', birthplace: '愛知県', gender: 'female',
    shichuDay: '丙午', nayin: '天河水', sanmeiStar: '調舒星', chusatsu: '申酉天中殺', sukuyo: '角宿',
    lifePathNumber: 1, honmeiName: '五黄土星', elementBalance: { scores: { 木: 2, 火: 3, 土: 1, 金: 0, 水: 2 }, method: 'test' },
    astrology, ...overrides,
  }
}

test('実出力の天体・星座表記をFactへ接続する', () => {
  const input = source()
  const facts = extractAstrologyFacts(input)
  const planets = input.astrology?.western?.planets ?? []
  assert.deepEqual(planets.map(planet => planet.name), ['太陽', '月', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'])
  for (const planet of planets) assert.ok(facts.some(fact => fact.factor.startsWith(`planet:${planet.name}:${planet.sign}`)))
  const sun = facts.find(fact => fact.factor.startsWith('planet:太陽:'))
  assert.equal(sun?.signal, SIGN_SPEC[planets.find(planet => planet.name === '太陽')!.sign].signal)
  const moon = facts.find(fact => fact.factor.startsWith('planet:月:'))
  assert.equal(moon?.requiresBirthTime, !isMoonSignStableForDay(input))
})

test('アスペクト文字列を構造化し、外惑星同士は除外する', () => {
  assert.deepEqual(parseAspect('太陽と月のスクエア（オーブ2.3°）'), { a: '太陽', b: '月', type: 'スクエア', orb: 2.3 })
  assert.equal(parseAspect('Mercury trine Moon'), null)
  const input = source()
  const facts = extractAstrologyFacts(input)
  assert.ok(facts.some(fact => fact.factor === 'structuredAspect:太陽:スクエア:冥王星:orb0.1'))
  assert.equal(facts.some(fact => fact.factor.includes('天王星:コンジャンクション:海王星')), false)
})

test('特別アスペクトは天体名の入力順に依存せず同じsignalを返す', () => {
  const western = source().astrology!.western!
  const facts = extractAstrologyFacts(source({
    astrology: { ...source().astrology!, western: { ...western, aspects: [
      '金星と土星のスクエア（オーブ1.0°）',
      '土星と金星のオポジション（オーブ1.5°）',
    ] } },
  }))
  const relevant = facts.filter(fact => fact.factor.startsWith('structuredAspect:'))
  assert.equal(relevant.length, 2)
  assert.ok(relevant.every(fact => fact.signal === 'responsibility' && fact.axis === 'domain-love'))
})

test('元素の突出と欠落をFact化する', () => {
  const input = source({
    astrology: {
      available: true, method: 'fixture',
      western: {
        ascendant: { sign: '牡羊座', degree: 0 }, midheaven: { sign: '牡羊座', degree: 0 }, aspects: [],
        planets: ['太陽', '月', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'].map((name, index) => ({ name, longitude: index, sign: index < 5 ? '牡羊座' : '牡牛座', degree: index, retrograde: false })),
      },
    },
  })
  const facts = extractAstrologyFacts(input)
  assert.ok(facts.some(fact => fact.factor.startsWith('elementDominant:fire:')))
  assert.ok(facts.some(fact => fact.factor === 'elementMissing:air' && fact.signature))
  assert.ok(facts.some(fact => fact.factor === 'elementMissing:water' && fact.signature))
})

test('ハウスは出生時刻がある場合だけ発行する', () => {
  const timedInput = source()
  const untimedInput = source({ birthTime: undefined })
  const timed = buildReportFactsV2(timedInput, extractReportMetadata(timedInput))
  const untimed = buildReportFactsV2(untimedInput, extractReportMetadata(untimedInput))
  assert.ok(timed.some(fact => fact.factor.startsWith('house:')))
  assert.equal(untimed.some(fact => fact.factor.startsWith('house:')), false)
  assert.equal(untimed.some(fact => fact.requiresBirthTime), false)
})

test('月が一日中同じ星座なら出生時刻なしでも西洋・インドの月Factを保持する', () => {
  const input = source({ birthDate: '1995-02-02', birthTime: undefined, astrology: { available: false, reason: '時刻なし', method: '出生時刻なし' } })
  assert.equal(isMoonSignStableForDay(input), true)
  const facts = buildReportFactsV2(input, extractReportMetadata(input))
  assert.ok(facts.some(fact => fact.factor.startsWith('planet:月:')))
  assert.ok(facts.some(fact => fact.factor.startsWith('vedic-planet:月:')))
  assert.equal(facts.filter(fact => /planet:月:/.test(fact.factor)).some(fact => fact.requiresBirthTime), false)
})

test('同一入力のFact ID配列は完全一致する', () => {
  const input = source()
  const metadata = extractReportMetadata(input)
  assert.deepEqual(buildReportFactsV2(input, metadata).map(fact => fact.id), buildReportFactsV2(input, metadata).map(fact => fact.id))
})
