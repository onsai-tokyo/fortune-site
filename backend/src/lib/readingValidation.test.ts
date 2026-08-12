import test from 'node:test'
import assert from 'node:assert/strict'
import { validateConversationTitle, validateReadingQuestion } from './readingValidation.js'

test('質問の前後空白と改行を正規化する', () => {
  assert.deepEqual(validateReadingQuestion('  2027年の\r\n恋愛を詳しく  '), { ok: true, value: '2027年の\n恋愛を詳しく' })
})

test('空・長すぎる質問・制御文字を拒否する', () => {
  assert.equal(validateReadingQuestion('   ').ok, false)
  const long = validateReadingQuestion('あ'.repeat(1201))
  assert.equal(long.ok, false)
  if (!long.ok) assert.equal(long.status, 413)
  assert.equal(validateReadingQuestion('質問\u0000です').ok, false)
})

test('履歴タイトルを安全な80文字以内に整える', () => {
  assert.equal(validateConversationTitle('  結婚\n時期について  '), '結婚 時期について')
  assert.equal(validateConversationTitle(''), null)
  assert.equal(validateConversationTitle('題'.repeat(100))?.length, 80)
})
