import assert from 'node:assert/strict'
import test from 'node:test'
import { calcAstrology } from '../astrology.js'
import type { ReportInput } from '../deterministicReport.js'
import { calcZiwei } from '../ziwei.js'
import { calcExpandedDivination, calcHonmeiStar, calcKyuseiProfile, calcLifePathNumber, calcNayin, calcNumerologyProfile, calcSanmei, calcSanmeiRelations, calcShichu, calcTimingCycles, getSukuyo, KYUSEI_NAMES } from '../../routes/calc.js'
import { buildReportFactsV2 } from './factsV2.js'
import { buildReportFindingsV2 } from './findingsV2.js'
import { extractReportMetadata } from './metadata.js'
import { assignableChapterCount, median } from './shadowEvaluation.js'
import { bootstrapTraitScoreScale } from './traitScoreScale.js'
import { ALL_TRAIT_SCORE_KEYS, TRAIT_SCORE_RULES, computeTraitScores, matchesTraitFact } from './traitScores.js'

const pr1Factor = /^(?:planet:|vedic-planet:|elementDominant:|elementMissing:|modalityDominant:|structuredAspect:|house:)/
const beforePr1 = (facts: ReturnType<typeof buildReportFactsV2>) => facts.filter(fact => !pr1Factor.test(fact.factor))
const countDuplicatePairs = (values: string[]) => {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.values()].reduce((sum, count) => sum + (count * (count - 1)) / 2, 0)
}

type Result = {
  facts: number; ephemeris: number; sources: number; findings: number; consensus: number; assignable: number
  independence: number | null; signature: string
}

function evaluate(facts: ReturnType<typeof buildReportFactsV2>): Result {
  const findings = buildReportFindingsV2(facts)
  const consensus = findings.filter(finding => finding.kind === 'consensus')
  return {
    facts: facts.length,
    ephemeris: facts.filter(fact => fact.lineage === 'ephemeris').length,
    sources: new Set(facts.map(fact => fact.canonicalSourceId)).size,
    findings: findings.length,
    consensus: consensus.length,
    independence: median(consensus.map(finding => finding.independence)),
    assignable: assignableChapterCount(findings),
    signature: findings.map(finding => finding.key).sort().join('|'),
  }
}

function summarize(results: Result[]) {
  return {
    samples: results.length,
    factMedian: median(results.map(result => result.facts)),
    ephemerisMedian: median(results.map(result => result.ephemeris)),
    canonicalSourceMedian: median(results.map(result => result.sources)),
    findingMedian: median(results.map(result => result.findings)),
    consensusMedian: median(results.map(result => result.consensus)),
    findingZeroCount: results.filter(result => result.findings === 0).length,
    assignedChapterMedian: median(results.map(result => result.assignable)),
    duplicateFindingKeyPairs: countDuplicatePairs(results.map(result => result.signature)),
    independenceMedian: median(results.flatMap(result => result.independence === null ? [] : [result.independence])),
  }
}

function inputForDate(year: number, month: number, day: number, hour: number, minute: number, gender: 'male' | 'female', hasBirthTime = true): ReportInput {
  const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const shichu = calcShichu(year, month, day, hour, minute)
  const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
  return {
    birthDate, birthTime: hasBirthTime ? `${hour}:${minute}` : undefined, birthplace: '愛知県名古屋市', gender,
    shichuDay: shichu.day.kanshi, nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx), sanmeiStar: sanmei.shukumeiStar,
    chusatsu: sanmei.chusatsu, sukuyo: getSukuyo(year, month, day), lifePathNumber: calcLifePathNumber(birthDate),
    numerologyProfile: calcNumerologyProfile(year, month, day, 2026), honmeiName: KYUSEI_NAMES[calcHonmeiStar(year, month, day)],
    kyuseiProfile: calcKyuseiProfile(year, month, day, hour, minute), timing: calcTimingCycles(year, month, day, hour, minute, gender),
    sanmeiRelations: calcSanmeiRelations(shichu, sanmei.chusatsu), ziwei: calcZiwei(year, month, day, hour, gender, '愛知県名古屋市'),
    astrology: calcAstrology(year, month, day, hasBirthTime ? hour : undefined, minute, '愛知県名古屋市'), ...calcExpandedDivination(shichu),
  }
}

function inputFor(index: number): ReportInput {
  return inputForDate(
    1965 + (index * 17) % 50, 1 + (index * 7) % 12, 1 + (index * 11) % 28,
    (index * 5) % 24, (index * 13) % 60, index % 2 ? 'male' : 'female', index % 5 !== 0,
  )
}

test('PR-1: 100件のシャドー経路で天体Fact追加前後を評価する', () => {
  const unmatched: unknown[][] = []
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    if (args[0] === 'Signal mapping unmatched') unmatched.push(args)
    else originalWarn(...args)
  }
  let samples: Array<{ before: Result; after: Result }>
  try {
    samples = Array.from({ length: 100 }, (_, index) => {
      const input = inputFor(index)
      const facts = buildReportFactsV2(input, extractReportMetadata(input))
      assert.equal(!input.birthTime && facts.some(fact => fact.requiresBirthTime), false)
      return { before: evaluate(beforePr1(facts)), after: evaluate(facts) }
    })
  } finally {
    console.warn = originalWarn
  }
  const before = summarize(samples.map(sample => sample.before))
  const after = summarize(samples.map(sample => sample.after))
  console.info('PR-1 shadow distribution', { before, after, factMedianIncrease: (after.factMedian ?? 0) - (before.factMedian ?? 0) })
  assert.equal(after.samples, 100)
  assert.ok((after.factMedian ?? 0) - (before.factMedian ?? 0) >= 25)
  assert.ok((after.ephemerisMedian ?? 0) >= 15)
  assert.ok((after.canonicalSourceMedian ?? 0) >= 20)
  assert.ok((after.findingMedian ?? 0) >= 12)
  assert.ok((after.consensusMedian ?? 0) >= 5)
  assert.equal(after.findingZeroCount, 0)
  assert.ok((after.assignedChapterMedian ?? 0) >= 7)
  assert.ok(after.duplicateFindingKeyPairs <= 5)
  assert.deepEqual(unmatched, [])
})

test('PR-1: 同年10件で外惑星がfindingを支配しない', () => {
  const samples = Array.from({ length: 10 }, (_, index) => {
    const month = index + 1
    const day = 2 + index * 2
    const input = inputForDate(1995, month, day, index * 2, index * 3, index % 2 ? 'male' : 'female')
    const facts = buildReportFactsV2(input, extractReportMetadata(input))
    const findings = buildReportFindingsV2(facts)
    const factById = new Map(facts.map(fact => [fact.id, fact]))
    const primary = findings.flatMap(finding => finding.primaryFacts).map(id => factById.get(id)).filter(Boolean)
    const outer = primary.filter(fact => /(?:天王星|海王星|冥王星)/.test(fact!.factor)).length
    const pr1Keys = findings.filter(finding => finding.primaryFacts.some(id => pr1Factor.test(factById.get(id)?.factor ?? ''))).map(finding => finding.key)
    return { keys: new Set(findings.map(finding => finding.key)), pr1Keys: new Set(pr1Keys), outerRatio: primary.length ? outer / primary.length : 0 }
  })
  const common = [...samples[0].keys].filter(key => samples.every(sample => sample.keys.has(key)))
  const commonPr1 = [...samples[0].pr1Keys].filter(key => samples.every(sample => sample.pr1Keys.has(key)))
  console.info('PR-1 generation-bias comparison', { commonFindingKeys: common, commonCount: common.length, commonPr1FindingKeys: commonPr1, commonPr1Count: commonPr1.length, outerRatios: samples.map(sample => sample.outerRatio) })
  assert.ok(common.length <= 3)
  assert.ok(commonPr1.length <= 3)
  assert.ok(samples.every(sample => sample.outerRatio <= 0.2))
})

test('PR-1: 時刻なしは時刻依存・ハウスFactを含まない', () => {
  const timedInput = inputFor(21)
  const untimedInput = { ...timedInput, birthTime: undefined, astrology: { available: false, reason: '時刻なし', method: '出生時刻なし' } }
  const timedFacts = buildReportFactsV2(timedInput, extractReportMetadata(timedInput))
  const untimedFacts = buildReportFactsV2(untimedInput, extractReportMetadata(untimedInput))
  assert.equal(untimedFacts.some(fact => fact.requiresBirthTime), false)
  assert.equal(untimedFacts.some(fact => fact.factor.startsWith('house:')), false)
  assert.ok(timedFacts.some(fact => fact.factor.startsWith('house:')))
  assert.ok(buildReportFindingsV2(timedFacts).length > 0)
  assert.ok(buildReportFindingsV2(untimedFacts).length > 0)
  console.info('PR-1 birth-time comparison', {
    timedFactCount: timedFacts.length, untimedFactCount: untimedFacts.length,
    timedFindingCount: buildReportFindingsV2(timedFacts).length, untimedFindingCount: buildReportFindingsV2(untimedFacts).length,
  })
})

const standardDeviation = (values: number[]) => {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
}

test('PR-2c: 確認済みルールを100件でシャドー計測する', () => {
  const scale = bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS)
  const samples = Array.from({ length: 100 }, (_, index) => {
    const input = inputFor(index)
    const facts = buildReportFactsV2(input, extractReportMetadata(input))
    return { facts, scores: computeTraitScores(facts, TRAIT_SCORE_RULES, scale) }
  })
  const implementedKeys = [...new Set(TRAIT_SCORE_RULES.map(rule => rule.score))]
  const distribution = Object.fromEntries(implementedKeys.map(key => {
    const scores = samples.map(sample => sample.scores[key])
    const values = scores.map(score => score.value)
    return [key, {
      standardDeviation: Number(standardDeviation(values).toFixed(3)),
      middleBandRatio: Number((values.filter(value => value >= 0.4 && value <= 0.6).length / values.length).toFixed(3)),
      nonZeroRatio: Number((scores.filter(score => score.contributingFacts.length > 0).length / scores.length).toFixed(3)),
      confidenceMean: Number((scores.reduce((sum, score) => sum + score.confidence, 0) / scores.length).toFixed(3)),
    }]
  }))
  const unmatchedRules = TRAIT_SCORE_RULES.filter(rule => !samples.some(sample => sample.facts.some(fact => matchesTraitFact(fact, rule.match))))
    .map(rule => `${rule.score}:${rule.source}:${JSON.stringify(rule.match)}`)

  console.info('PR-2c confirmed-rule shadow distribution', { ruleCount: TRAIT_SCORE_RULES.length, implementedKeys, distribution, unmatchedRules })
  assert.equal(samples.length, 100)
  assert.ok(implementedKeys.every(key => samples.some(sample => sample.scores[key].contributingFacts.length > 0)))
})
