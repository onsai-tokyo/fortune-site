import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createSupabaseTokenVerifier } from './supabaseTokenVerifier.js'
import { assertAuthConfiguration } from './authConfiguration.js'
const url = 'https://synthetic.supabase.co'
function key(kid: string) {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return { jwk: { ...pair.publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' },
    token: (claims: object = {}) => jwt.sign({ sub: 'synthetic-user', aud: 'authenticated', iss: `${url}/auth/v1`, exp: 4_000_000_000, ...claims }, pair.privateKey, { algorithm: 'ES256', keyid: kid }) }
}
const old = key('old'), fresh = key('fresh')
test('real signatures: rotation before TTL, single flight and issuer-wide cooldown', async () => {
  let calls = 0
  const verifier = createSupabaseTokenVerifier({ fetch: async () => {
    calls++; await new Promise(resolve => setImmediate(resolve))
    return Response.json({ keys: calls === 1 ? [old.jwk] : [old.jwk, fresh.jwk] })
  } })
  assert.equal((await verifier.verify(old.token(), undefined, url)).status, 'valid')
  const results = await Promise.all(Array.from({ length: 20 }, () => verifier.verify(fresh.token(), undefined, url)))
  assert.ok(results.every(r => r.status === 'valid')); assert.equal(calls, 2)
  for (let i = 0; i < 10; i++) assert.equal((await verifier.verify(key(`fake${i}`).token(), undefined, url)).status, 'invalid')
  assert.equal(calls, 2)
})
test('timeout is unavailable, bounded and recovers after cooldown', async () => {
  let calls = 0, clock = 0
  const verifier = createSupabaseTokenVerifier({ now: () => clock, fetch: async () => {
    calls++; if (calls === 1) throw new DOMException('timeout', 'TimeoutError')
    return Response.json({ keys: [fresh.jwk] })
  } })
  for (let i = 0; i < 10; i++) assert.equal((await verifier.verify(fresh.token(), undefined, url)).status, 'unavailable')
  assert.equal(calls, 1); clock = 30_001
  assert.equal((await verifier.verify(fresh.token(), undefined, url)).status, 'valid')
})
test('signature, audience, issuer, expiration and nonempty subject mandatory', async () => {
  const verifier = createSupabaseTokenVerifier({ fetch: async () => Response.json({ keys: [fresh.jwk] }) })
  for (const claims of [{ aud: 'wrong' }, { iss: 'https://wrong' }, { exp: 1 }, { sub: '' }, { sub: '   ' }]) {
    assert.equal((await verifier.verify(fresh.token(claims), undefined, url)).status, 'invalid')
  }
  assert.equal((await verifier.verify(key('fresh').token(), undefined, url)).status, 'invalid')
  assert.equal((await verifier.verify('e30.e30.', undefined, url)).status, 'invalid')
})
test('500 and malformed JWKS unavailable; valid empty JWKS invalid', async () => {
  for (const response of [new Response('', { status: 500 }), Response.json({}), Response.json({ keys: [{ ...fresh.jwk, x: 'bad' }] })]) {
    const verifier = createSupabaseTokenVerifier({ fetch: async () => response })
    assert.equal((await verifier.verify(fresh.token(), undefined, url)).status, 'unavailable')
  }
  assert.equal((await createSupabaseTokenVerifier({ fetch: async () => Response.json({ keys: [] }) }).verify(fresh.token(), undefined, url)).status, 'invalid')
})
test('production bypass rejected at startup', () => {
  assert.throws(() => assertAuthConfiguration({ NODE_ENV: 'production', REQUIRE_READING_AUTH: 'false' }))
  assert.doesNotThrow(() => assertAuthConfiguration({ NODE_ENV: 'development', REQUIRE_READING_AUTH: 'false' }))
})
