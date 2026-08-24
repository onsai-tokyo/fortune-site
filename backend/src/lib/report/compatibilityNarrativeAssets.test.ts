import assert from 'node:assert/strict'
import test from 'node:test'
import type { PairTraitScore } from './derivedTraitScores.js'
import { compatibilityProfileBlock, compatibilityScoreBlock } from './compatibilityNarrativeAssets.js'
import type { CompatibilityProfileScore } from './synastryFacts.js'

const score = (key: PairTraitScore['key'], value: number, confidence = 0.8): PairTraitScore => ({
  key, value, confidence, inputScores: ['social_sensitivity'], relationAxes: [],
})

test('相性スコアを高・中・低の別文章へ変換する', () => {
  const low = compatibilityScoreBlock(score('compatibility_lifestyle', 0.2), '二人の暮らし')
  const middle = compatibilityScoreBlock(score('compatibility_lifestyle', 0.5), '二人の暮らし')
  const high = compatibilityScoreBlock(score('compatibility_lifestyle', 0.8), '二人の暮らし')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('確信度不足は一般論で埋めず既存文へフォールバックする', () => {
  assert.equal(compatibilityScoreBlock(score('compatibility_transparency', 0.9, 0.24), '会話'), null)
})

test('会話の流れを深い理解と混同しない文章へ変換する', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'conversational_flow', value, confidence, contributingFacts: ['cross-aspect:test'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '距離の始まり')
  const middle = compatibilityProfileBlock(profile(0.5), '距離の始まり')
  const high = compatibilityProfileBlock(profile(0.8), '距離の始まり')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /話が弾むことと心の奥まで分かることは別/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '距離の始まり'), null)
})

test('感情の深さを安心感と混同しない文章へ変換する', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'emotional_intimacy', value, confidence, contributingFacts: ['cross-aspect:moon'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '魅力の正体')
  const middle = compatibilityProfileBlock(profile(0.5), '魅力の正体')
  const high = compatibilityProfileBlock(profile(0.8), '魅力の正体')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /強く感じ取れることと安心して頼れることは別/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '魅力の正体'), null)
})

test('修復力を衝突の少なさや破局判定と混同しない文章へ変換する', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'repair_capacity', value, confidence, contributingFacts: ['cross-aspect:jupiter'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '安心への戻り道')
  const middle = compatibilityProfileBlock(profile(0.5), '安心への戻り道')
  const high = compatibilityProfileBlock(profile(0.8), '安心への戻り道')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /破局|別れる/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '安心への戻り道'), null)
})
