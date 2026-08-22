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

function inputFor(index: number): ReportInput {
  const year = 1965 + (index * 17) % 50
  const month = 1 + (index * 7) % 12
  const day = 1 + (index * 11) % 28
  const hour = (index * 5) % 24
  const minute = (index * 13) % 60
  const hasBirthTime = index % 5 !== 0
  const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const shichu = calcShichu(year, month, day, hour, minute)
  const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
  return {
    birthDate, birthTime: hasBirthTime ? `${hour}:${minute}` : undefined, birthplace: '愛知県名古屋市', gender: index % 2 ? 'male' : 'female',
    shichuDay: shichu.day.kanshi, nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx), sanmeiStar: sanmei.shukumeiStar,
    chusatsu: sanmei.chusatsu, sukuyo: getSukuyo(year, month, day), lifePathNumber: calcLifePathNumber(birthDate),
    numerologyProfile: calcNumerologyProfile(year, month, day, 2026), honmeiName: KYUSEI_NAMES[calcHonmeiStar(year, month, day)],
    kyuseiProfile: calcKyuseiProfile(year, month, day, hour, minute), timing: calcTimingCycles(year, month, day, hour, minute, index % 2 ? 'male' : 'female'),
    sanmeiRelations: calcSanmeiRelations(shichu, sanmei.chusatsu), ziwei: calcZiwei(year, month, day, hour, index % 2 ? 'male' : 'female', '愛知県名古屋市'),
    astrology: calcAstrology(year, month, day, hour, minute, '愛知県名古屋市'), ...calcExpandedDivination(shichu),
  }
}

test('PR-3: 100件のシャドー経路をAI呼び出しなしで評価する', () => {
  const results = Array.from({ length: 100 }, (_, index) => {
    const input = inputFor(index)
    const facts = buildReportFactsV2(input, extractReportMetadata(input))
    const findings = buildReportFindingsV2(facts)
    const consensus = findings.filter(finding => finding.kind === 'consensus')
    assert.equal(!input.birthTime && facts.some(fact => fact.requiresBirthTime), false)
    return {
      facts: facts.length, findings: findings.length, consensus: consensus.length,
      independence: median(consensus.map(finding => finding.independence)),
      assignable: assignableChapterCount(findings),
    }
  })
  const average = (key: 'facts' | 'findings' | 'consensus' | 'assignable') => results.reduce((sum, result) => sum + result[key], 0) / results.length
  const summary = {
    samples: results.length,
    factAverage: average('facts'), findingAverage: average('findings'), consensusAverage: average('consensus'),
    findingZeroCount: results.filter(result => result.findings === 0).length,
    assignableChapterAverage: average('assignable'), assignableChapterMinimum: Math.min(...results.map(result => result.assignable)),
    independenceMedian: median(results.flatMap(result => result.independence === null ? [] : [result.independence])),
  }
  console.info('PR-3 shadow distribution', summary)
  assert.equal(summary.samples, 100)
  assert.ok(summary.factAverage > 0)
  assert.ok(summary.findingAverage > 0)
})
