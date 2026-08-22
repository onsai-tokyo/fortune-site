import test from 'node:test'
import assert from 'node:assert/strict'
import { chatReadingTitle, compatibilityReadingTitle, personalReadingTitle } from './conversationTitle.js'

test('鑑定タイトルは一覧の日付表示と重複しない', () => {
  const instant = new Date('2026-08-21T15:30:00.000Z')
  assert.equal(personalReadingTitle(instant), 'あなたについて')
  assert.equal(compatibilityReadingTitle('まなみ', '漫画家', instant), 'まなみと漫画家の相性')
})

test('相手名が空の場合も安全なタイトルを返す', () => {
  assert.equal(compatibilityReadingTitle('   ', '   ', new Date('2026-01-01T00:00:00.000Z')), 'あなたとお相手の相性')
  assert.equal(chatReadingTitle('  恋愛の流れを\n詳しく知りたい  '), '恋愛の流れを 詳しく知りたい')
})
