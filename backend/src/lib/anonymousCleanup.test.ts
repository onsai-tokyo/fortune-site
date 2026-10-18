import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanupAnonymousUsers, cleanupOptions, type CleanupStore, type CleanupUser } from './anonymousCleanup.js'
const now = Date.parse('2026-10-18T00:00:00Z')
const old: CleanupUser = { id: 'old', is_anonymous: true, created_at: '2026-01-01' }
function fixture(users = [old]) {
  const deleted: string[] = []
  const store: CleanupStore = { listUsers: async () => users, getUser: async id => users.find(u => u.id === id) ?? null, countBooks: async () => ({ count: 0 }), countGrants: async () => ({ count: 0 }), deleteUser: async id => { deleted.push(id) } }
  return { store, deleted }
}
test('default and explicit dry-run never delete; apply is opt-in', async () => {
  assert.deepEqual(cleanupOptions([]), { apply: false }); assert.deepEqual(cleanupOptions(['--dry-run']), { apply: false }); assert.deepEqual(cleanupOptions(['--apply']), { apply: true })
  assert.throws(() => cleanupOptions(['--force'])); assert.throws(() => cleanupOptions(['--apply', '--dry-run']))
  const { store, deleted } = fixture(); const r = await cleanupAnonymousUsers(store, { now })
  assert.equal(r.candidates, 1); assert.equal(r.removed, 0); assert.deepEqual(deleted, [])
})
test('books/grants query errors or unknown counts stop before any deletion', async () => {
  for (const result of [{ count: null }, { count: 0, error: 'offline' }, { count: -1 }]) for (const field of ['countBooks', 'countGrants'] as const) {
    const { store, deleted } = fixture([{ ...old, id: 'first' }, old]); store[field] = async id => id === 'old' ? result : { count: 0 }
    await assert.rejects(cleanupAnonymousUsers(store, { now, apply: true }), /PROTECTION_QUERY_FAILED/); assert.deepEqual(deleted, [])
  }
})
test('only old explicit anonymous users without books/grants qualify', async () => {
  const { store, deleted } = fixture([old, { ...old, id: 'apple', is_anonymous: false }, { ...old, id: 'unknown', is_anonymous: undefined }, { ...old, id: 'recent', last_sign_in_at: '2026-10-17' }, { ...old, id: 'invalid', created_at: 'invalid' }, { ...old, id: 'book' }, { ...old, id: 'grant' }])
  store.countBooks = async id => ({ count: id === 'book' ? 1 : 0 }); store.countGrants = async id => ({ count: id === 'grant' ? 1 : 0 })
  await cleanupAnonymousUsers(store, { now, apply: true }); assert.deepEqual(deleted, ['old'])
})
test('recheck protects a newly linked user', async () => {
  const { store, deleted } = fixture(); store.getUser = async () => ({ ...old, is_anonymous: false })
  await cleanupAnonymousUsers(store, { now, apply: true }); assert.deepEqual(deleted, [])
})
test('recheck/delete failures stop without continuing', async () => {
  const { store, deleted } = fixture(); let count = 0; store.countBooks = async () => ++count === 1 ? { count: 0 } : { count: null, error: 'offline' }
  await assert.rejects(cleanupAnonymousUsers(store, { now, apply: true })); assert.deepEqual(deleted, [])
  const second = fixture(); second.store.deleteUser = async () => { throw new Error('delete failed') }
  await assert.rejects(cleanupAnonymousUsers(second.store, { now, apply: true }), /delete failed/)
})
test('all pages collected before deletion, including over 1000 users', async () => {
  const users = Array.from({ length: 1001 }, (_, i) => ({ ...old, id: String(i) })); const { store, deleted } = fixture(users)
  store.listUsers = async page => { assert.equal(deleted.length, 0); return users.slice((page - 1) * 1000, page * 1000) }
  const r = await cleanupAnonymousUsers(store, { now, apply: true }); assert.equal(r.removed, 1001); assert.equal(new Set(deleted).size, 1001)
})
test('listing failure aborts before writes', async () => {
  const { store, deleted } = fixture(); store.listUsers = async () => { throw new Error('list failed') }
  await assert.rejects(cleanupAnonymousUsers(store, { now, apply: true }), /list failed/); assert.deepEqual(deleted, [])
})
