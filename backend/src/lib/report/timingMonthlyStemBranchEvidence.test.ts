import assert from 'node:assert/strict'
import test from 'node:test'
import { calcTimingCycles } from '../divination/index.js'
import { buildMonthlyTimingScoreTimeline } from './timingEvidencePipeline.js'
import { buildMonthlyStemBranchEvidence } from './timingMonthlyStemBranchEvidence.js'

const input = { birthYear: 1995, birthMonth: 2, birthDay: 20, birthHour: 3, birthMinute: 2, gender: 'female' as const, birthplace: '愛知県名古屋市' }

test('43年×12か月の流月Evidenceを再現可能に生成する', () => {
  const timing = calcTimingCycles(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute, input.gender)
  const left = buildMonthlyStemBranchEvidence({ ...input, annual: timing.annual })
  const right = buildMonthlyStemBranchEvidence({ ...input, annual: timing.annual })
  assert.equal(left.size, 43 * 12)
  assert.deepEqual(left, right)
  assert.ok([...left.values()].every(items => items.length === 13 && items.every(item => item.detail?.startsWith('shadow provisional /'))))
})

test('月次スコアは同年の年次Evidenceを保持したまま流月差を加える', () => {
  const timeline = buildMonthlyTimingScoreTimeline(input)
  assert.equal(timeline.byMonth.size, 43 * 12)
  const october = timeline.byMonth.get('2016-10')!
  const november = timeline.byMonth.get('2016-11')!
  assert.ok(october && november)
  assert.notDeepEqual(october, november)
  assert.ok(Object.values(october).every(score => Number.isFinite(score.relativeStrength) && Number.isFinite(score.confidence)))
})
