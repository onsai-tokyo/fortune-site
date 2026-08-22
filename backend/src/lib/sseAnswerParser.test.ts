import assert from 'node:assert/strict'
import test from 'node:test'
import { StreamingAnswerParser } from './sseAnswerParser.js'

test('NEXTマーカーが全境界で分割されても本文と候補を分離する', () => {
  const source = '最初に結論を伝えます。\n---NEXT---\n次の質問A\n次の質問B\n次の質問C'
  for (let split = 1; split < source.length; split++) {
    const parser = new StreamingAnswerParser()
    const streamed = parser.push(source.slice(0, split)) + parser.push(source.slice(split))
    const result = parser.finish()
    assert.equal(streamed + result.finalDelta, '最初に結論を伝えます。\n')
    assert.equal(result.answer, '最初に結論を伝えます。')
    assert.deepEqual(result.suggestions, ['次の質問A', '次の質問B', '次の質問C'])
  }
})

test('NEXTマーカーがなくても保留末尾を本文として返す', () => {
  const parser = new StreamingAnswerParser()
  const streamed = parser.push('通常の回答---NE')
  const result = parser.finish()
  assert.equal(streamed + result.finalDelta, '通常の回答---NE')
  assert.equal(result.answer, '通常の回答---NE')
  assert.deepEqual(result.suggestions, [])
})

test('Markdown強調がチャンクをまたいでも本文へ残らない', () => {
  const parser = new StreamingAnswerParser()
  const streamed = parser.push('これは*') + parser.push('*大切な場面**です。\n---NEXT---\n次を聞く')
  const result = parser.finish()
  assert.equal(streamed + result.finalDelta, 'これは大切な場面です。\n')
  assert.equal(result.answer, 'これは大切な場面です。')
  assert.deepEqual(result.suggestions, ['次を聞く'])
})
