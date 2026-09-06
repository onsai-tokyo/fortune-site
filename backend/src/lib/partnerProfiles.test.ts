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

test('存在しない日付・不正時刻を400にし、時刻不明と区別する', () => {
  const valid={displayName:'A',birthDate:'2000-02-29',birthplace:'東京',gender:'female'}
  for(const birthDate of ['1900-02-29','2001-02-29','2000-04-31','0000-01-01','2000-00-01','2000-13-01','2000-01-00']) assert.throws(()=>validatePartnerProfile({...valid,birthDate}),{statusCode:400})
  for(const birthTime of ['24:00','12:60','9:00','bad',12]) assert.throws(()=>validatePartnerProfile({...valid,birthTime}),{statusCode:400})
  assert.equal(validatePartnerProfile(valid).birth_time,null)
  assert.equal(validatePartnerProfile({...valid,birthTime:''}).birth_time,null)
  assert.equal(validatePartnerProfile({...valid,birthTime:'23:59'}).birth_time,'23:59')
})
