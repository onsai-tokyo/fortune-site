import test from 'node:test'
import assert from 'node:assert/strict'
import { safeReturnTo } from './safeReturnTo'
test('same-origin app path, query and fragment remain usable', () => {
  for (const path of ['/books', '/compose?source=you-2026', '/you/years/2026#section']) assert.equal(safeReturnTo(path, '/books'), path)
  assert.equal(safeReturnTo('/one/../books', '/you'), '/books')
})
test('rejects external, protocol-relative, backslash, control and nested encoded attacks', () => {
  for (const path of ['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/%5cevil.invalid', '/%255cevil.invalid', '/%25255cevil.invalid', '/%2fevil.invalid', '/%252fevil.invalid', '/\nevil.invalid', '/%09/evil.invalid', ' /books', '/books ', 'javascript:alert(1)', '/%zz', null, undefined, '', '/%2525252525255cevil.invalid']) {
    assert.equal(safeReturnTo(path, '/books'), '/books', String(path))
    assert.equal(safeReturnTo(path, null), null, String(path))
  }
})
