import test from 'node:test'
import assert from 'node:assert/strict'
import { webApiPath } from './webApiPath'
test('Web APIs use their namespace exactly once and retain queries', () => {
  assert.equal(webApiPath('/api/books/abc/questions'), '/api/web/books/abc/questions')
  assert.equal(webApiPath('/api/preview/generate?format=sse'), '/api/web/preview/generate?format=sse')
  assert.equal(webApiPath('/api/web/reading/saves'), '/api/web/reading/saves')
  assert.equal(webApiPath('/health'), '/health')
})
