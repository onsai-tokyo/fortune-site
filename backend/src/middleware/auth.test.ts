import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Response } from 'express'
import jwt from 'jsonwebtoken'
import { requireAuth, requireReadingAuth, type AuthRequest } from './auth.js'

function responseRecorder() {
  let statusCode = 200
  let body: unknown
  const response = {
    status(code: number) {
      statusCode = code
      return response
    },
    json(value: unknown) {
      body = value
      return response
    },
  } as unknown as Response
  return { response, result: () => ({ statusCode, body }) }
}

test('reading authentication is required by default', async () => {
  const original = process.env.REQUIRE_READING_AUTH
  delete process.env.REQUIRE_READING_AUTH
  try {
    const { response, result } = responseRecorder()
    let nextCalled = false
    await requireReadingAuth({ headers: {} } as AuthRequest, response, (() => { nextCalled = true }) as NextFunction)
    assert.equal(nextCalled, false)
    assert.deepEqual(result(), { statusCode: 401, body: { error: 'ログインが必要です' } })
  } finally {
    if (original === undefined) delete process.env.REQUIRE_READING_AUTH
    else process.env.REQUIRE_READING_AUTH = original
  }
})

test('explicit local opt-out keeps the guest route available', async () => {
  const original = process.env.REQUIRE_READING_AUTH
  process.env.REQUIRE_READING_AUTH = 'false'
  try {
    const { response } = responseRecorder()
    let nextCalled = false
    await requireReadingAuth({ headers: {} } as AuthRequest, response, (() => { nextCalled = true }) as NextFunction)
    assert.equal(nextCalled, true)
  } finally {
    if (original === undefined) delete process.env.REQUIRE_READING_AUTH
    else process.env.REQUIRE_READING_AUTH = original
  }
})

test('requireAuth verifies a Supabase HS256 token locally', async () => {
  const originalSecret = process.env.SUPABASE_JWT_SECRET
  const originalUrl = process.env.SUPABASE_URL
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  try {
    const token = jwt.sign(
      { sub: 'user-123', email: 'test@example.com', aud: 'authenticated' },
      'test-secret',
      { algorithm: 'HS256', issuer: 'https://example.supabase.co/auth/v1', expiresIn: '5m' },
    )
    const request = { headers: { authorization: `Bearer ${token}` } } as AuthRequest
    const { response } = responseRecorder()
    let nextCalled = false
    await requireAuth(request, response, (() => { nextCalled = true }) as NextFunction)
    assert.equal(nextCalled, true)
    assert.equal(request.userId, 'user-123')
    assert.equal(request.userEmail, 'test@example.com')
    assert.equal(request.accessToken, token)
  } finally {
    if (originalSecret === undefined) delete process.env.SUPABASE_JWT_SECRET
    else process.env.SUPABASE_JWT_SECRET = originalSecret
    if (originalUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalUrl
  }
})

test('requireAuth rejects an invalid signature without a Supabase request', async () => {
  const originalSecret = process.env.SUPABASE_JWT_SECRET
  const originalUrl = process.env.SUPABASE_URL
  process.env.SUPABASE_JWT_SECRET = 'correct-secret'
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  try {
    const token = jwt.sign(
      { sub: 'forged-user', aud: 'authenticated' },
      'wrong-secret',
      { algorithm: 'HS256', issuer: 'https://example.supabase.co/auth/v1', expiresIn: '5m' },
    )
    const { response, result } = responseRecorder()
    let nextCalled = false
    await requireAuth({ headers: { authorization: `Bearer ${token}` } } as AuthRequest, response, (() => { nextCalled = true }) as NextFunction)
    assert.equal(nextCalled, false)
    assert.deepEqual(result(), { statusCode: 401, body: { error: 'セッションが無効です。再度ログインしてください。' } })
  } finally {
    if (originalSecret === undefined) delete process.env.SUPABASE_JWT_SECRET
    else process.env.SUPABASE_JWT_SECRET = originalSecret
    if (originalUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalUrl
  }
})
