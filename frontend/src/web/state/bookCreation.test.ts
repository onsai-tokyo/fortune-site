import test from 'node:test'
import assert from 'node:assert/strict'
import { bookRetryOperationId, existingBookRetry, knownBookRejection } from './bookCreation'
const owner = '11111111-1111-4111-8111-111111111111'
const failed = '44444444-4444-4444-8444-444444444444'
test('release only confirmed pre-order rejections, never uncertain errors or conflicts', () => {
  for (const [status, code] of [[402,'BOOK_NO_CREDITS'],[422,'BOOK_SOURCE'],[403,'WEB_AI_ADULT_ONLY'],[428,'AI_CONSENT_REQUIRED']] as const) assert.equal(knownBookRejection(status, code), true)
  for (const [status, code] of [[402,undefined],[409,'BOOK_OPERATION_CONFLICT'],[503,'BOOK_UNAVAILABLE'],[503,'BOOK_NO_CREDITS'],[401,undefined],[422,'UNKNOWN']] as const) assert.equal(knownBookRejection(status, code), false)
})
test('retry order is stable across tabs/reloads but separates owners and failed books', async () => {
  const id = await bookRetryOperationId(owner, failed)
  assert.match(id, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/)
  assert.equal(await bookRetryOperationId(owner.toUpperCase(), failed.toUpperCase()), id)
  assert.notEqual(await bookRetryOperationId(failed, owner), id)
  assert.notEqual(await bookRetryOperationId(owner, owner), id)
  await assert.rejects(bookRetryOperationId('', failed))
})
test('legacy random-id retries reuse only a newer matching source, focus, question and theme', () => {
  const original = {id:failed,sourceId:owner,sourceCardId:'year-2026',question:'相談文',theme:'仕事',createdAt:'2026-10-19T00:00:00Z',state:'failed'}
  const newer = {...original,id:owner,createdAt:'2026-10-20T00:00:00Z',state:'queued'}
  assert.equal(existingBookRetry(original,[original,newer]),newer)
  for (const change of [{sourceId:failed},{sourceCardId:'other'},{question:'別の相談'},{theme:'その他'},{createdAt:original.createdAt},{createdAt:'invalid'},{state:'unknown'}]) assert.equal(existingBookRetry(original,[{...newer,...change}]),undefined)
  assert.equal(existingBookRetry({...original,createdAt:'invalid'},[newer]),undefined)
})
