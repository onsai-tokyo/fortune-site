import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateGenerator, classifyFallbackReason } from './generationMetrics.js'

test('AI失敗理由を集計可能な固定分類へ変換する', () => {
  assert.equal(classifyFallbackReason(new Error('AI report rewrite timed out')), 'card_timeout')
  assert.equal(classifyFallbackReason(new Error('Invalid AI pages')), 'invalid_pages')
  assert.equal(classifyFallbackReason(new Error('Invalid AI title or summary')), 'invalid_title')
  assert.equal(classifyFallbackReason(new Error('AI card mixed an unrelated domain')), 'forbidden_domain')
  assert.equal(classifyFallbackReason(new Error('AI card did not reference metadata')), 'no_metadata_refs')
  assert.equal(classifyFallbackReason(new Error('network failed')), 'api_error')
  assert.equal(classifyFallbackReason(new Error('anything'), true), 'overall_timeout')
})

test('鑑定全体の生成方式をカード数から集計する', () => {
  assert.equal(aggregateGenerator(8, 0), 'ai')
  assert.equal(aggregateGenerator(0, 8), 'deterministic')
  assert.equal(aggregateGenerator(5, 3), 'mixed')
})
