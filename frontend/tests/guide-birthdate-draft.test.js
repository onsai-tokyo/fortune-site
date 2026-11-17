import assert from 'node:assert/strict'
import test from 'node:test'
import { clearGuideBirthDate, readGuideBirthDate, saveGuideBirthDate } from '../src/web/data/guideBirthDateDraft.js'

test('round trips both guide inputs and removes the draft after use', () => {
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: key => store.delete(key),
  }
  assert.equal(saveGuideBirthDate('2000-02-29', 'female'), true)
  assert.deepEqual(readGuideBirthDate(), { birthDate: '2000-02-29', gender: 'female' })
  clearGuideBirthDate()
  assert.equal(readGuideBirthDate(), null)
})

test('keeps old drafts as manual prefills and drops expired or invalid automatic submissions', () => {
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  }
  saveGuideBirthDate('1990-02-03')
  assert.deepEqual(readGuideBirthDate(), { birthDate: '1990-02-03', gender: null })
  const [key] = store.keys()
  store.set(key, JSON.stringify({ birthDate: '1990-02-03', gender: 'unknown', issuedAt: Date.now() }))
  assert.deepEqual(readGuideBirthDate(), { birthDate: '1990-02-03', gender: null })
  store.set(key, JSON.stringify({ birthDate: '1990-02-03', gender: 'male', issuedAt: Date.now() - 31 * 60 * 1000 }))
  assert.equal(readGuideBirthDate(), null)
})
