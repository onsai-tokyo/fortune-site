import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPartnerCapacity, MAX_PARTNER_PROFILES, validatePartnerProfile } from './partnerProfiles.js'

test('相手プロフィール上限は一箇所で2人と定義する', () => assert.equal(MAX_PARTNER_PROFILES, 2))
test('APIを直接呼んでも3人目を拒否する', () => assert.throws(() => assertPartnerCapacity(2), /2人まで/))
test('2人未満なら登録できる', () => assert.doesNotThrow(() => assertPartnerCapacity(1)))
test('相手プロフィールの必須項目を検証する', () => {
  assert.throws(() => validatePartnerProfile({ displayName: '', birthDate: 'x' }))
  assert.equal(validatePartnerProfile({ displayName: 'A', birthDate: '1990-01-01', birthplace: '東京', gender: 'female' }).display_name, 'A')
})
