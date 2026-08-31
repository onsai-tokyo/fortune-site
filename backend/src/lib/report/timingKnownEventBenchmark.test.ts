import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMonthlyTimingScoreTimeline, buildTimingScoreTimeline } from './timingEvidencePipeline.js'
import { CASE_A_TIMING_BENCHMARK, evaluateKnownTimingCase, evaluateKnownTimingMonths, KNOWN_TIMING_BENCHMARKS, measureUnlabelledTimingActivation } from './timingKnownEventBenchmark.js'

test('Aさんの既知イベントを本番文章ではなくshadow検証ラベルとして保持する', () => {
  assert.equal(CASE_A_TIMING_BENCHMARK.events.length, 13)
  assert.deepEqual(CASE_A_TIMING_BENCHMARK.events.map(item => item.year), [2013, 2014, 2016, 2016, 2018, 2019, 2021, 2021, 2022, 2023, 2024, 2025, 2026])
  assert.ok(CASE_A_TIMING_BENCHMARK.events.every(item => item.expectedScores.length >= 2))
})

test('18スコアのshadow定義を計測し、検出結果を期待テーマの部分集合に保つ', () => {
  const timeline = buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input)
  const result = evaluateKnownTimingCase(CASE_A_TIMING_BENCHMARK, timeline)
  assert.equal(result.length, CASE_A_TIMING_BENCHMARK.events.length)
  assert.ok(result.some(item => item.measurableScores.length > 0))
  assert.ok(result.every(item => item.unsupportedScores.length === 0))
  for (const item of result) {
    assert.deepEqual(
      [...item.measurableScores, ...item.unsupportedScores].sort(),
      [...item.event.expectedScores].sort(),
    )
    assert.ok(item.detectedScores.every(key => item.measurableScores.includes(key)))
    assert.ok(item.claimEligibleScores.every(key => item.measurableScores.includes(key)))
    assert.ok(item.claimEligibleScores.every(key => item.detectedScores.includes(key)))
    assert.deepEqual(item.diagnostics.map(entry => entry.key), item.measurableScores)
    assert.ok(item.diagnostics.every(entry => Number.isFinite(entry.rawSupport) && Number.isFinite(entry.relativeStrength) && Number.isFinite(entry.confidence)))
    assert.ok(item.diagnostics.every(entry => entry.status === 'detected' ? item.detectedScores.includes(entry.key) : !item.detectedScores.includes(entry.key)))
  }
})

test('未記録年は誤りと断定せずshadow発火量として分離して測る', () => {
  const timeline = buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input)
  const result = measureUnlabelledTimingActivation(CASE_A_TIMING_BENCHMARK, timeline)
  const labelledYears = new Set(CASE_A_TIMING_BENCHMARK.events.map(item => item.year))
  assert.ok(result.length > 0)
  assert.ok(result.every(item => !labelledYears.has(item.year)))
  assert.ok(result.every((item, index) => index === 0 || result[index - 1]!.year < item.year))
  assert.ok(result.every(item => new Set(item.activatedScores).size === item.activatedScores.length))
  assert.ok(result.every(item => item.claimEligibleScores.every(key => item.activatedScores.includes(key))))
})

test('月指定イベントは年次と流月を合算した月別Claim安全条件で測る', () => {
  const result = evaluateKnownTimingMonths(CASE_A_TIMING_BENCHMARK, buildMonthlyTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input))
  assert.equal(result.length, CASE_A_TIMING_BENCHMARK.events.filter(item => item.months?.length).length)
  for (const item of result) {
    assert.deepEqual(Object.keys(item.claimEligibleScoresByMonth).map(Number), item.event.months)
    assert.ok(Object.values(item.claimEligibleScoresByMonth).flat().every(key => item.event.expectedScores.includes(key)))
  }
})

test('同一入力のshadow評価は再現する', () => {
  const left = evaluateKnownTimingCase(CASE_A_TIMING_BENCHMARK, buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input))
  const right = evaluateKnownTimingCase(CASE_A_TIMING_BENCHMARK, buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input))
  assert.deepEqual(left, right)
  assert.deepEqual(
    measureUnlabelledTimingActivation(CASE_A_TIMING_BENCHMARK, buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input)),
    measureUnlabelledTimingActivation(CASE_A_TIMING_BENCHMARK, buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input)),
  )
})

test('A〜Dの既知イベントを重複IDなしの検証ラベルとして保持する', () => {
  assert.equal(KNOWN_TIMING_BENCHMARKS.length, 4)
  const events = KNOWN_TIMING_BENCHMARKS.flatMap(item => item.events)
  assert.equal(events.length, 27)
  assert.equal(new Set(events.map(item => item.id)).size, events.length)
  assert.ok(events.every(item => item.expectedScores.length > 0))
  assert.equal(KNOWN_TIMING_BENCHMARKS.find(item => item.id.startsWith('case-b'))?.input.birthHour, undefined)
})
