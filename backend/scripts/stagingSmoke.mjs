import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Usage (only after staging is explicitly resumed):
// node scripts/stagingSmoke.mjs --expected-commit <full-40-character-sha>
// Or set STAGING_EXPECTED_COMMIT. No network request is made without it.
import { expectedCommitFrom } from './stagingSmokeConfig.mjs'
const expectedCommit = expectedCommitFrom(process.argv.slice(2), process.env)

const project = 'https://xxsolnxwbxdylqnyttij.supabase.co'
const api = 'https://fortune-site-staging-api.onrender.com'
const origin = 'https://fortune-site-my19pkbp4-onsaitokyo-4984s-projects.vercel.app'
const key = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY
if (!key?.startsWith('sb_publishable_')) throw new Error('Staging publishable key required')
const client = createClient(project, key, { auth: { persistSession: false, autoRefreshToken: false } })
let session
async function call(path, options = {}) {
  const response = await fetch(api + path, {
    ...options,
    headers: { Origin: origin, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...options.headers },
    signal: AbortSignal.timeout(120_000),
  })
  assert.equal(response.headers.get('access-control-allow-origin'), origin, 'CORS origin')
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path}: HTTP ${response.status}`)
  return response
}
try {
  const health = await (await call('/health')).json()
  assert.equal(health.runtime.commitSha?.toLowerCase(), expectedCommit)
  console.log('PASS staging commit and CORS')
  const login = await client.auth.signInAnonymously()
  if (login.error || !login.data.session) throw new Error(`Anonymous sign-in failed: ${login.error?.code ?? 'missing_session'}`)
  session = login.data.session
  assert.equal(session.user.is_anonymous, true)
  console.log('PASS anonymous sign-in')
  for (const path of ['/api/reading/conversations', '/api/partners', '/api/books/status', '/api/books', '/api/reading/saves']) {
    await (await call(path)).json()
    console.log('PASS authenticated ' + path)
  }
  const input = { birthDate: '1994-05-12', birthplace: '東京都', gender: 'female', nickname: 'staging smoke' }
  const operation = randomUUID()
  const response = await call('/api/preview/generate?format=sse', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operation }, body: JSON.stringify(input),
  })
  const text = await response.text()
  const report = [...text.matchAll(/data: (\{.*\})/g)].map(m => JSON.parse(m[1])).find(e => e.type === 'complete')?.report
  assert.ok(report, 'SSE completion report')
  const status = await (await call('/api/preview/generations/' + operation)).json()
  assert.equal(status.state, 'completed')
  console.log('PASS deterministic reading generation and operation recovery')
  const saveResponse = await call('/api/reading/conversations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operation },
    body: JSON.stringify({ birthData: input, calculatedData: report.calculatedData ?? {}, reportText: String(report.reportText ?? JSON.stringify(report)), structuredReport: report, sourceSection: 'あなたについて' }),
  })
  await saveResponse.json()
  const conversations = await (await call('/api/reading/conversations')).json()
  assert.ok(conversations.conversations?.length, 'Persisted reading')
  const id = conversations.conversations[0].id
  for (const suffix of ['/cards', '/timing-history']) {
    const payload = await (await call('/api/reading/' + id + suffix)).json()
    assert.ok(payload.cards?.length, 'Nonempty real reading cards')
    console.log('PASS real reading ' + suffix)
  }
  await call('/api/reading/saves/you-2026', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isSaved: true }) })
  const saves = await (await call('/api/reading/saves')).json()
  assert.ok(saves.saves.some(s => s.save_key === 'you-2026'))
  console.log('PASS year-specific save persistence')
} finally {
  if (session) {
    const response = await call('/api/reading/account', { method: 'DELETE' })
    assert.equal(response.status, 204)
    console.log('PASS delete synthetic smoke-test account and cascade its data')
  }
}
