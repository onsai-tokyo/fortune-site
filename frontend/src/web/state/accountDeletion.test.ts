import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccountDeletion, ACCOUNT_DELETE_AUTH_REQUIRED, ACCOUNT_DELETE_OWNER_CHANGED, ACCOUNT_DELETE_SIGNOUT_FAILED } from './accountDeletion'

function fixture() {
  let owner: string | null = 'owner-a'
  const calls: string[] = []
  const deps = {
    remote: true,
    currentOwner: () => owner,
    session: async (): Promise<{ owner: string; token: string } | null> => ({ owner: 'owner-a', token: 'fixture-token' }),
    remove: async (_token: string) => { calls.push('delete') },
    signOut: async () => { calls.push('signOut'); owner = null },
    clearLocal: (id?: string) => { calls.push(`clear:${id}`) },
  }
  return { deps, calls, switchOwner: (id: string | null) => { owner = id } }
}

test('deletion awaits server confirmation before sign-out and local cleanup', async () => {
  const f = fixture()
  let release!: () => void
  f.deps.remove = async () => { f.calls.push('delete'); await new Promise<void>(r => { release = r }) }
  const remove = createAccountDeletion(f.deps)
  const pending = remove()
  await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(f.calls, ['delete'])
  release(); await pending
  assert.deepEqual(f.calls, ['delete', 'signOut', 'clear:owner-a'])
})

test('server rejection keeps local state and session, and allows explicit retry', async () => {
  const f = fixture(); f.deps.remove = async () => { throw new Error('synthetic server failure') }
  const remove = createAccountDeletion(f.deps)
  await assert.rejects(remove(), /synthetic server failure/)
  assert.deepEqual(f.calls, [])
  f.deps.remove = async () => { f.calls.push('delete') }
  await remove()
  assert.deepEqual(f.calls, ['delete', 'signOut', 'clear:owner-a'])
})

test('missing session never silently succeeds or clears data', async () => {
  const f = fixture(); f.deps.session = async () => null
  await assert.rejects(createAccountDeletion(f.deps)(), { message: ACCOUNT_DELETE_AUTH_REQUIRED })
  assert.deepEqual(f.calls, [])
})

test('different session owner cannot submit a DELETE', async () => {
  const f = fixture(); f.deps.session = async () => ({ owner: 'owner-b', token: 'other' })
  await assert.rejects(createAccountDeletion(f.deps)(), { message: ACCOUNT_DELETE_AUTH_REQUIRED })
  assert.deepEqual(f.calls, [])
})

test('concurrent deletion calls send only one request', async () => {
  const f = fixture(); let release!: () => void
  f.deps.remove = async () => { f.calls.push('delete'); await new Promise<void>(r => { release = r }) }
  const remove = createAccountDeletion(f.deps); const pending = remove()
  await assert.rejects(remove(), /退会処理中/)
  await new Promise(r => setTimeout(r, 0)); release(); await pending
  assert.equal(f.calls.filter(c => c === 'delete').length, 1)
})

test('owner switch during server DELETE never signs out or clears the new account', async () => {
  const f = fixture(); f.deps.remove = async () => { f.calls.push('delete'); f.switchOwner('owner-b') }
  await assert.rejects(createAccountDeletion(f.deps)(), { message: ACCOUNT_DELETE_OWNER_CHANGED })
  assert.deepEqual(f.calls, ['delete'])
})

test('failed local sign-out is explicit; retry never deletes the account twice', async () => {
  const f = fixture(); f.deps.signOut = async () => { f.calls.push('signOut'); throw new Error('synthetic') }
  const remove = createAccountDeletion(f.deps)
  await assert.rejects(remove(), { message: ACCOUNT_DELETE_SIGNOUT_FAILED })
  assert.deepEqual(f.calls, ['delete', 'signOut'])
  f.deps.signOut = async () => { f.calls.push('signOut'); f.switchOwner(null) }
  await remove()
  assert.deepEqual(f.calls, ['delete', 'signOut', 'signOut', 'clear:owner-a'])
})

test('demo deletion only clears demo state, without auth or API calls', async () => {
  const f = fixture(); f.deps.remote = false
  await createAccountDeletion(f.deps)()
  assert.deepEqual(f.calls, ['clear:undefined'])
})
