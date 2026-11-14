import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentPolicy, canCreateWithCredits } from './paymentPolicy'
test('REMOTE defaults closed and false never allows purchases or simulated credits', () => {
  for (const flag of [undefined, 'false', 'FALSE', '1', '']) assert.deepEqual(paymentPolicy(true, flag), { purchasesOpen: false, simulatePurchase: false })
})
test('REMOTE true opens checkout integration but still forbids all mock credit timers', () => {
  assert.deepEqual(paymentPolicy(true, 'true'), { purchasesOpen: true, simulatePurchase: false })
})
test('demo keeps write-pay-create flow with or without a flag', () => {
  for (const flag of [undefined, 'false', 'true']) assert.deepEqual(paymentPolicy(false, flag), { purchasesOpen: true, simulatePurchase: true })
})
test('admin-granted credits permit creation independently of payments', () => {
  assert.equal(canCreateWithCredits(1), true)
  for (const credits of [0, -1, NaN, Infinity]) assert.equal(canCreateWithCredits(credits), false)
})
