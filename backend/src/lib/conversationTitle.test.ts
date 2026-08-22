import test from 'node:test'
import assert from 'node:assert/strict'
import { compatibilityReadingTitle, personalReadingTitle } from './conversationTitle.js'

test('鑑定タイトルは日本時間の診断日をサーバー側で生成する', () => {
  const instant = new Date('2026-08-21T15:30:00.000Z')
  assert.equal(personalReadingTitle(instant), 'あなたについて　診断日 2026年8月22日')
  assert.equal(compatibilityReadingTitle('漫画家', instant), '漫画家との相性　診断日 2026年8月22日')
})

test('相手名が空の場合も安全なタイトルを返す', () => {
  assert.match(compatibilityReadingTitle('   ', new Date('2026-01-01T00:00:00.000Z')), /^お相手との相性　診断日 /)
})
