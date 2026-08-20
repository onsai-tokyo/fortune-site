import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Response } from 'express'
import { requireReadingAuth, type AuthRequest } from './auth.js'

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
