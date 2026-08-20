import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { ipKeyGenerator } from 'express-rate-limit'
import { clearSupabaseJwksCacheForTests, verifiedUserIdFromAuthorization } from './rateLimitIdentity.js'

const secret = 'test-supabase-jwt-secret-with-sufficient-length'
const supabaseUrl = 'https://example.supabase.co'

function accessToken(overrides: Record<string, unknown> = {}, signingSecret = secret) {
  const options: jwt.SignOptions = {
    algorithm: 'HS256',
    ...(!('exp' in overrides) ? { expiresIn: '1h' as const } : {}),
    ...(!('iss' in overrides) ? { issuer: `${supabaseUrl}/auth/v1` } : {}),
  }
  return jwt.sign({ sub: 'user-123', aud: 'authenticated', ...overrides }, signingSecret, options)
}

test('HS256署名を検証したJWTのsubだけをレート制限キーに使う', async () => {
  assert.equal(
    await verifiedUserIdFromAuthorization(`Bearer ${accessToken()}`, secret, supabaseUrl),
    'user-123',
  )
})

test('署名・期限・issuerの検証に失敗したJWTは未認証扱いにする', async () => {
  assert.equal(await verifiedUserIdFromAuthorization(`Bearer ${accessToken({}, 'wrong-secret')}`, secret, supabaseUrl), undefined)
  assert.equal(await verifiedUserIdFromAuthorization(`Bearer ${accessToken({ exp: 1 })}`, secret, supabaseUrl), undefined)
  assert.equal(await verifiedUserIdFromAuthorization(`Bearer ${accessToken({ iss: 'https://attacker.example/auth/v1' })}`, secret, supabaseUrl), undefined)
  assert.equal(await verifiedUserIdFromAuthorization('Bearer malformed-token', secret, supabaseUrl), undefined)
})

test('Supabase JWKSのES256署名を検証してGoogleログインのsubを使う', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'google-test-key', alg: 'ES256', use: 'sig' }
  const token = jwt.sign({ sub: 'google-user', aud: 'authenticated' }, privateKey, {
    algorithm: 'ES256', keyid: publicJwk.kid, issuer: `${supabaseUrl}/auth/v1`, expiresIn: '5m',
  })
  const originalFetch = globalThis.fetch
  clearSupabaseJwksCacheForTests()
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 })
  try {
    assert.equal(await verifiedUserIdFromAuthorization(`Bearer ${token}`, secret, supabaseUrl), 'google-user')
  } finally {
    globalThis.fetch = originalFetch
    clearSupabaseJwksCacheForTests()
  }
})

test('ipKeyGeneratorは同じIPv6 /56内のアドレスを同じキーにまとめる', () => {
  assert.equal(ipKeyGenerator('2001:db8:abcd:1200::1', 56), ipKeyGenerator('2001:db8:abcd:12ff::2', 56))
  assert.notEqual(ipKeyGenerator('2001:db8:abcd:1200::1', 56), ipKeyGenerator('2001:db8:abcd:1300::1', 56))
})
