import test from 'node:test'
import assert from 'node:assert/strict'
import { membershipDisplayFromRow } from './appleMembershipDisplay.js'

const now = Date.parse('2026-10-12T00:00:00Z')
const row = { original_transaction_id: '123', product_id: 'annual', environment: 'Sandbox', subscription_status: 'active', expires_at: '2026-10-13T00:00:00Z', revoked_at: null }
test('exposes only matching metadata for an active server-owned membership', () => {
  assert.deepEqual(membershipDisplayFromRow(row, now), { originalTransactionId: '123', productId: 'annual', environment: 'Sandbox' })
})
test('expired, revoked, missing and invalid records cannot identify active membership', () => {
  for (const value of [null, {...row, expires_at:'2026-10-12T00:00:00Z'}, {...row, revoked_at:'2026-10-11'}, {...row, environment:'other'}, {...row, subscription_status:'expired'}, {...row, expires_at:'invalid'}]) {
    assert.equal(membershipDisplayFromRow(value, now), null)
  }
})
