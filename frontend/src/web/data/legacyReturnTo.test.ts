import assert from 'node:assert/strict'
import test from 'node:test'
import { legacyReturnTo } from './legacyReturnTo'

test('legacy login returns only to safe read-only reports without checkout parameters', () => {
  assert.equal(legacyReturnTo('/r/old-token'), '/r/old-token')
  assert.equal(legacyReturnTo('/reading/old-id?checkout=success#secret'), '/reading/old-id')
  for (const path of [null, '//evil.invalid', '/%252fevil.invalid', '/\\evil.invalid', '/credits/return', '/compose', '/reading/new', '/reading/history', '/legacy/login', 'https://evil.invalid']) assert.equal(legacyReturnTo(path), '/')
})
