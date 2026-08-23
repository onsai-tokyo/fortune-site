import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { appleClientSecret } from './appleSignIn.js'

test('Sign in with Apple client secretはES256・短期・正しいaud/subで署名する', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  process.env.APPLE_SIGN_IN_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  process.env.APPLE_SIGN_IN_KEY_ID = 'TESTKEY123'
  process.env.APPLE_TEAM_ID = 'TESTTEAM12'
  process.env.APPLE_BUNDLE_ID = 'com.onsai.fatelab'

  const decoded = jwt.verify(appleClientSecret(), publicKey, {
    algorithms: ['ES256'],
    audience: 'https://appleid.apple.com',
    issuer: 'TESTTEAM12',
    subject: 'com.onsai.fatelab',
    complete: true,
  })
  assert.equal(decoded.header.kid, 'TESTKEY123')
  const payload = decoded.payload as jwt.JwtPayload
  assert.ok(payload.iat && payload.exp)
  assert.equal(payload.exp - payload.iat, 300)
})
