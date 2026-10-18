import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AccountBoundary, restoreSession } from './accountBoundary.ts'
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
test('old A subscription cannot apply to B or a later A session', () => {
  const scope = new AccountBoundary()
  scope.select('A'); const old = scope.capture()
  scope.select('B'); assert.equal(scope.current(old), false)
  scope.select('A'); assert.equal(scope.current(old), false)
  const current = scope.capture(); scope.invalidate(); assert.equal(scope.current(current), false)
})
test('session reject ends loading and a retry can restore', async () => {
  const scope = new AccountBoundary()
  let loading = true, error = false, user = ''
  await restoreSession(scope, () => Promise.reject(Error('offline')), v => { user = v }, () => { error = true }, () => { loading = false })
  assert.equal(loading, false); assert.equal(error, true)
  await restoreSession(scope, async () => 'B', v => { user = v; error = false }, () => { error = true }, () => {})
  assert.equal(user, 'B'); assert.equal(error, false)
})
test('late getSession and disposed responses cannot replace auth event', async () => {
  const scope = new AccountBoundary(), request = deferred<string>()
  let applied = '', failed = false
  const pending = restoreSession(scope, () => request.promise, v => { applied = v }, () => { failed = true }, () => {})
  scope.select('B'); request.resolve('A'); await pending
  assert.equal(applied, '')
  const rejected = deferred<string>()
  const disposed = restoreSession(scope, () => rejected.promise, v => { applied = v }, () => { failed = true }, () => {})
  scope.invalidate(); rejected.reject(Error('late')); await disposed
  assert.equal(failed, false)
})
