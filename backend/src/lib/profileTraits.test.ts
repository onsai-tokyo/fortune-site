import assert from 'node:assert/strict'
import test from 'node:test'
import { filterTraitCandidates, traitsAreSimilar, validateTraitCandidate } from './profileTraits.js'

test('人格断定・診断・能力否定を確認カードから除外する', () => {
  for (const text of ['優柔不断です', '計画が苦手', '不安傾向が強い', 'HSPです']) {
    assert.equal(validateTraitCandidate({ category: 'decision', text }), null)
  }
  assert.deepEqual(validateTraitCandidate({ category: 'decision', text: '情報を集めてから決めることが多い' }), {
    category: 'decision', text: '情報を集めてから決めることが多い',
  })
})

test('承認済み・否定済みと似た記述を再提案せず最大2枚にする', () => {
  assert.equal(traitsAreSimilar('情報を集めてから決める', '情報を集めてから決めることが多い'), true)
  const result = filterTraitCandidates([
    { category: 'decision', text: '情報を集めてから決めることが多い' },
    { category: 'work', text: '人に説明すると考えがまとまりやすい' },
    { category: 'love', text: '約束を言葉で確認できると安心する' },
    { category: 'value', text: '締め切りがあると行動しやすい' },
  ], ['情報を集めてから決める'])
  assert.equal(result.length, 2)
  assert.equal(result.some(item => item.text.includes('情報を集めて')), false)
})
