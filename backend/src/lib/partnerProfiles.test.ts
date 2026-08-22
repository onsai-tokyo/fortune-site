import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPartnerCapacity, MAX_PARTNER_PROFILES, normalizeRelationship, validatePartnerProfile } from './partnerProfiles.js'

test('相手プロフィール上限は一箇所で2人と定義する', () => assert.equal(MAX_PARTNER_PROFILES, 2))
test('APIを直接呼んでも3人目を拒否する', () => assert.throws(() => assertPartnerCapacity(2), /2人まで/))
test('2人未満なら登録できる', () => assert.doesNotThrow(() => assertPartnerCapacity(1)))
test('相手プロフィールの必須項目を検証する', () => {
  assert.throws(() => validatePartnerProfile({ displayName: '', birthDate: 'x' }))
  assert.equal(validatePartnerProfile({ displayName: 'A', birthDate: '1990-01-01', birthplace: '東京', gender: 'female' }).display_name, 'A')
})

test('17種類の表示名を3つの内部グループへ安全に変換する', () => {
  assert.deepEqual(normalizeRelationship('元恋人'), { relationshipLabel: '元恋人', relationshipType: 'romantic' })
  assert.deepEqual(normalizeRelationship('会社の同僚'), { relationshipLabel: '会社の同僚', relationshipType: 'friend' })
  assert.deepEqual(normalizeRelationship('兄弟姉妹'), { relationshipLabel: '兄弟姉妹', relationshipType: 'family' })
  assert.deepEqual(normalizeRelationship('不正な値'), { relationshipLabel: 'お付き合い中', relationshipType: 'romantic' })
})
