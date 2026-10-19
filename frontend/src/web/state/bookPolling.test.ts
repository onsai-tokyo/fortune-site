import test from 'node:test'
import assert from 'node:assert/strict'
import { pollBookOperation } from './bookPolling'
test('queued, generating and review keep polling until delivered or failed', async () => {
  for (const end of ['delivered', 'failed']) {
    const states = ['queued', 'generating', 'review', end], observed: string[] = []
    const result = await pollBookOperation({ current: () => true, read: async () => ({ id: 'fixture', state: states.shift()! }), observe: async b => { observed.push(b.state) }, sleep: async () => {}, attempts: 10 })
    assert.equal(result?.state, end)
    assert.deepEqual(observed, ['queued', 'generating', 'review', end])
  }
})
test('missing operation and timeout never imply completion', async () => {
  let reads = 0
  assert.equal(await pollBookOperation({ current: () => true, read: async () => { reads++; return null }, observe: async () => { assert.fail() }, sleep: async () => {}, attempts: 3 }), null)
  assert.equal(reads, 3)
})
test('owner change ignores late results and prevents later requests', async () => {
  let current = true, reads = 0
  const result = await pollBookOperation({ current: () => current, read: async () => { reads++; current = false; return { id: 'old', state: 'delivered' } }, observe: async () => { assert.fail() }, sleep: async () => {}, attempts: 3 })
  assert.equal(result, null); assert.equal(reads, 1)
})
test('network errors and unknown states cannot complete or clear recovery', async () => {
  for (const state of ['unknown', 'network']) await assert.rejects(pollBookOperation({ current: () => true, read: async () => { if (state === 'network') throw new Error('network'); return { id: 'fixture', state } }, observe: async () => { assert.fail() }, sleep: async () => {}, attempts: 2 }))
})
