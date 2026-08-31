import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTimingScoreTimeline } from './timingEvidencePipeline.js'
import { CASE_A_TIMING_BENCHMARK, evaluateKnownTimingCase } from './timingKnownEventBenchmark.js'

test('Aさんの既知イベントを本番文章ではなくshadow検証ラベルとして保持する', () => {
  assert.equal(CASE_A_TIMING_BENCHMARK.events.length, 13)
  assert.deepEqual(CASE_A_TIMING_BENCHMARK.events.map(item => item.year), [2013, 2014, 2016, 2016, 2018, 2019, 2021, 2021, 2022, 2023, 2024, 2025, 2026])
  assert.ok(CASE_A_TIMING_BENCHMARK.events.every(item => item.expectedScores.length >= 2))
})

test('未実装15スコアを不一致に数えず、計測可能と不足を分離する', () => {
  const timeline = buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input)
  const result = evaluateKnownTimingCase(CASE_A_TIMING_BENCHMARK, timeline)
  assert.equal(result.length, CASE_A_TIMING_BENCHMARK.events.length)
  assert.ok(result.some(item => item.measurableScores.length > 0))
  assert.ok(result.some(item => item.unsupportedScores.length > 0))
  for (const item of result) {
    assert.deepEqual(
      [...item.measurableScores, ...item.unsupportedScores].sort(),
      [...item.event.expectedScores].sort(),
    )
    assert.ok(item.detectedScores.every(key => item.measurableScores.includes(key)))
  }
})

test('同一入力のshadow評価は再現する', () => {
  const left = evaluateKnownTimingCase(CASE_A_TIMING_BENCHMARK, buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input))
  const right = evaluateKnownTimingCase(CASE_A_TIMING_BENCHMARK, buildTimingScoreTimeline(CASE_A_TIMING_BENCHMARK.input))
  assert.deepEqual(left, right)
})

