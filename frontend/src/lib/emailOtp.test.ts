import test from 'node:test'
import assert from 'node:assert/strict'
import { isEmailOtp, parseEmailOtpLength } from './emailOtp'

test('OTP length defaults to production eight; staging six and 6–10 are configurable', () => {
  assert.equal(parseEmailOtpLength(), 8)
  assert.equal(parseEmailOtpLength(''), 8)
  for (const length of [6, 7, 8, 9, 10]) assert.equal(parseEmailOtpLength(String(length)), length)
})
test('invalid OTP configuration fails closed rather than silently using the wrong length', () => {
  for (const value of ['5', '11', '8.0', '08', ' 6 ', 'bad']) assert.throws(() => parseEmailOtpLength(value))
})
test('only configured-length ASCII digits pass, including leading zeroes', () => {
  for (const length of [6, 8, 10]) {
    assert.ok(isEmailOtp('0'.repeat(length), length))
    for (const code of ['1'.repeat(length - 1), '1'.repeat(length + 1), 'a'.repeat(length), '１'.repeat(length), ' '.repeat(length)]) {
      assert.equal(isEmailOtp(code, length), false)
    }
  }
  assert.equal(isEmailOtp('123456', 8), false)
  assert.equal(isEmailOtp('12345678', 6), false)
})
