import assert from 'node:assert/strict'
import test from 'node:test'
import { refundAiChatQuestion, reserveAiChatQuestion } from './aiChatUsage.js'

test('AIチャット枠を月間上限付きRPCで確保する', async () => {
  const calls: Array<{ name: string, args: Record<string, unknown> }> = []
  const client = { async rpc(name: string, args: Record<string, unknown>) { calls.push({ name, args }); return { data: 'ok', error: null } } }
  assert.equal(await reserveAiChatQuestion('user-1', 100, 5000, client), 'ok')
  assert.deepEqual(calls[0], {
    name: 'reserve_ai_chat_question',
    args: { target_user_id: 'user-1', user_question_limit: 100, global_question_limit: 5000 },
  })
})

test('ユーザー上限と全体上限を区別する', async () => {
  const userClient = { async rpc() { return { data: 'user_limit', error: null } } }
  const globalClient = { async rpc() { return { data: 'global_limit', error: null } } }
  assert.equal(await reserveAiChatQuestion('user-1', 100, 5000, userClient), 'user_limit')
  assert.equal(await reserveAiChatQuestion('user-1', 100, 5000, globalClient), 'global_limit')
})

test('失敗したAI質問の予約を返却する', async () => {
  const calls: Array<{ name: string, args: Record<string, unknown> }> = []
  const client = { async rpc(name: string, args: Record<string, unknown>) { calls.push({ name, args }); return { data: null, error: null } } }
  await refundAiChatQuestion('user-1', client)
  assert.deepEqual(calls[0], { name: 'refund_ai_chat_question', args: { target_user_id: 'user-1' } })
})
