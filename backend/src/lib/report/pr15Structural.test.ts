import assert from 'node:assert/strict'
import test from 'node:test'
import { calcAstrology } from '../astrology.js'
import type { ReportInput } from '../deterministicReport.js'
import { calcZiwei } from '../ziwei.js'
import { calcExpandedDivination, calcHonmeiStar, calcKyuseiProfile, calcLifePathNumber, calcNayin, calcNumerologyProfile, calcSanmei, calcSanmeiRelations, calcShichu, calcTimingCycles, getSukuyo, KYUSEI_NAMES } from '../../routes/calc.js'
import { assertCardContract } from './contract.js'
import { extractReportMetadata } from './metadata.js'
import { buildReportFacts } from './facts.js'
import { buildReportFindings } from './findings.js'
import { buildEditorialStructuredReport } from './editorial.js'
import { calculatedDataWithReport, storedReportFromCalculatedData } from './storedReport.js'
import { replaceTimingCards } from './timingCards.js'

function editorialFor(input: ReportInput) { const metadata = extractReportMetadata(input); const facts = buildReportFacts(input, metadata); return replaceTimingCards(buildEditorialStructuredReport(facts, buildReportFindings(facts)), input) }

type Sample = readonly [number, number, number, number, number]
const samples: readonly Sample[] = [
  [1995, 2, 20, 3, 2], [1990, 6, 12, 12, 0], [1988, 1, 1, 8, 15], [1997, 7, 30, 19, 45], [1983, 11, 5, 6, 30],
  [2000, 4, 18, 22, 10], [1976, 9, 27, 14, 20], [1992, 12, 3, 0, 5], [2003, 8, 14, 10, 40], [1969, 3, 9, 17, 55],
] as const

function inputFor(year: number, month: number, day: number, hour: number, minute: number): ReportInput {
  const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const shichu = calcShichu(year, month, day, hour, minute)
  const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
  return { birthDate, birthTime: `${hour}:${minute}`, birthplace: '愛知県名古屋市', gender: 'female',
    shichuDay: shichu.day.kanshi, nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx), sanmeiStar: sanmei.shukumeiStar,
    chusatsu: sanmei.chusatsu, sukuyo: getSukuyo(year, month, day), lifePathNumber: calcLifePathNumber(birthDate),
    numerologyProfile: calcNumerologyProfile(year, month, day, 2026), honmeiName: KYUSEI_NAMES[calcHonmeiStar(year, month, day)],
    kyuseiProfile: calcKyuseiProfile(year, month, day, hour, minute), timing: calcTimingCycles(year, month, day, hour, minute, 'female'),
    sanmeiRelations: calcSanmeiRelations(shichu, sanmei.chusatsu), ziwei: calcZiwei(year, month, day, hour, 'female', '愛知県名古屋市'),
    astrology: calcAstrology(year, month, day, hour, minute, '愛知県名古屋市'), ...calcExpandedDivination(shichu) }
}

test('PR15 contract: previewの出口はtab・tags・timing・一意性を満たす', () => {
  const report = editorialFor(inputFor(...samples[0]))
  assert.doesNotThrow(() => assertCardContract(report))
})

test('PR15 contract: 初回鑑定と保存済み鑑定は同じカードスキーマを返す', () => {
  const preview = editorialFor(inputFor(...samples[0]))
  const saved = storedReportFromCalculatedData(calculatedDataWithReport({}, preview))
  assert.deepEqual(saved, preview)
})

test('PR15 distribution: 10件すべてにFindingが1件以上ある', () => {
  const counts = samples.map(sample => { const input = inputFor(...sample); return buildReportFindings(buildReportFacts(input, extractReportMetadata(input))).length })
  console.info('finding distribution', { minimum: Math.min(...counts), maximum: Math.max(...counts), counts })
  assert.equal(counts.filter(count => count === 0).length, 0, 'finding = 0 の入力が存在します')
})

test('PR15 distribution: 10件すべてにtimingカードがありタイトルのユニーク率が85%を超える', () => {
  const reports = samples.map(sample => editorialFor(inputFor(...sample)))
  assert.equal(reports.filter(report => !report.cards.some(card => card.kind === 'timing')).length, 0)
  const titles = reports.flatMap(report => report.cards.filter(card => card.kind === 'timing').map(card => card.title.normalize('NFKC')))
  assert.ok(new Set(titles).size / titles.length > 0.85)
})
