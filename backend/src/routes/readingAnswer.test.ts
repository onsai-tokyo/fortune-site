import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAnswerSystemPrompt } from '../lib/report/answerPrompt.js'

const conversation = {
  birth_data: { birthDate: '1995-02-25', birthplace: '愛知県', gender: 'female' },
  calculated_data: { annual: [{ year: 2027, age: 32 }] },
  report_text: '2027年は関係を形にしやすい流れです。',
  source_section: '鑑定全体',
}

test('システムプロンプトが拒否を禁止し質問への回答を要求する', () => {
  const system = buildAnswerSystemPrompt(conversation, new Date('2026-08-26T12:00:00+09:00'))
  assert.match(system, /「分かりません」「読めません」「お答えできません」で終わる回答は禁止/)
  assert.match(system, /必ず利用者の質問へ答えてください/)
  assert.match(system, /現在の満年齢は31歳/)
})

test('推測禁止の重複と旧年齢範囲への依存を残さない', () => {
  const system = buildAnswerSystemPrompt(conversation)
  const count = (system.match(/推測(して作ら|しないで)/g) ?? []).length
  assert.ok(count <= 1, `禁止指示が${count}回あります`)
  assert.doesNotMatch(system, /計算済みデータの年齢表記から推測/)
})
