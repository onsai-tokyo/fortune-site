import assert from 'node:assert/strict'
import test from 'node:test'
import type { PairTraitScore } from './derivedTraitScores.js'
import { compatibilityScoreBlock } from './compatibilityNarrativeAssets.js'

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
