import test from 'node:test'
import assert from 'node:assert/strict'
import { partnerDraftFromRaw, pendingPartnerFromRaw, pendingPartnerKey, pendingPartnerNotice } from './partnerDraft'
const input = { name: '架空B', relation: '友人', birthDate: '1988-03-12', birthTime: null, birthPlace: '東京都', gender: 'female', metYear: 2020 }
const pending = { version: 2, input, operationId: '11111111-1111-4111-8111-111111111111', oldPartnerId: '22222222-2222-4222-8222-222222222222', deleted: true }
test('pending partner keys separate accounts; legacy input restores without implicit operation', () => {
  assert.notEqual(pendingPartnerKey('owner-a'), pendingPartnerKey('owner-b'))
  assert.deepEqual(partnerDraftFromRaw(JSON.stringify(input)), input)
  assert.equal(pendingPartnerFromRaw(JSON.stringify(input)), null)
})
test('pending partner operation preserves same operation id and irreversible progress', () => {
  assert.deepEqual(pendingPartnerFromRaw(JSON.stringify(pending)), pending)
  assert.match(pendingPartnerNotice(JSON.stringify(pending))!, /前の相手は削除済み/)
  const registered = { ...pending, registeredId: '33333333-3333-4333-8333-333333333333' }
  assert.equal(pendingPartnerFromRaw(JSON.stringify(registered))!.registeredId, registered.registeredId)
  assert.match(pendingPartnerNotice(JSON.stringify(registered))!, /登録を重複させず/)
})
test('malformed pending data is not interpreted as registration instructions', () => {
  for (const value of [null, 'bad', '{}', 'null', JSON.stringify({ ...input, metYear: '2020' })]) {
    assert.equal(partnerDraftFromRaw(value), null)
    assert.equal(pendingPartnerFromRaw(value), null)
  }
  assert.equal(pendingPartnerFromRaw(JSON.stringify({ ...pending, operationId: 'bad' })), null)
})
