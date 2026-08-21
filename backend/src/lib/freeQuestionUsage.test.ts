import assert from 'node:assert/strict'
import test from 'node:test'
import { consumeFreeQuestion, refundFreeQuestion } from './freeQuestionUsage.js'

test('無料質問の消費と返却はservice role用RPCクライアントを通す', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = { async rpc(name: string, args: Record<string, unknown>) { calls.push({ name, args }); return { data: name.startsWith('consume') ? 1 : null, error: null } } }
  assert.equal(await consumeFreeQuestion('user-1', 2, client), 1)
  await refundFreeQuestion('user-1', client)
  assert.deepEqual(calls, [
    { name: 'consume_free_reading_question', args: { target_user_id: 'user-1', question_limit: 2 } },
    { name: 'refund_free_reading_question', args: { target_user_id: 'user-1' } },
  ])
})

test('RPCエラーを握りつぶさない', async () => {
  const client = { async rpc() { return { data: null, error: { message: 'permission denied' } } } }
  await assert.rejects(() => consumeFreeQuestion('user-1', 2, client), /permission denied/)
})
