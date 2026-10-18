/** Local PostgreSQL bridge test. This is NOT PostgREST/RLS integration or iOS E2E. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { partnersRouter } from '../routes/partners.js'

const socket = realpathSync(process.env.D02_TEST_SOCKET ?? '')
assert.match(socket, /^\/private\/tmp\/fatelab-d02-compat-[^/]+\/socket$/)
const psql = process.env.D02_TEST_PSQL!
assert.ok(psql)
const literal = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'"
function sql(query: string) {
  return execFileSync(psql, ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-p', '55472', '-U', 'postgres', '-d', 'postgres'],
    { input: query, encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG'))) }).trim()
}
const owner = '33333333-3333-4333-8333-333333333333', other = '44444444-4444-4444-8444-444444444444'
const operation = '55555555-5555-4555-8555-555555555555', cancelled = '66666666-6666-4666-8666-666666666666'
sql(`insert into auth.users(id) values(${literal(owner)}),(${literal(other)});`)
process.env.SUPABASE_URL = 'https://local-bridge.invalid'
process.env.SUPABASE_SERVICE_KEY = 'synthetic-local-service'
process.env.SUPABASE_JWT_SECRET = 'synthetic-local-test-secret-not-a-real-key'
const nativeFetch = globalThis.fetch
let loseResponse = true
const calls: string[] = []
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init)
  const url = new URL(request.url)
  assert.equal(url.origin, 'https://local-bridge.invalid', 'No external network permitted')
  calls.push(url.pathname)
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const name = url.pathname.split('/').at(-1)!
    assert.ok(['register_partner_operation', 'get_partner_registration_operation', 'cancel_partner_registration_operation'].includes(name))
    const body = await request.json() as Record<string, unknown>
    const args = [literal(body.p_user) + '::uuid', literal(body.p_op) + '::uuid']
    if (name === 'register_partner_operation') args.push(literal(JSON.stringify(body.p_profile)) + '::jsonb')
    const value = JSON.parse(sql(`set role service_role; select public.${name}(${args.join(',')});`))
    if (name === 'register_partner_operation' && loseResponse) {
      loseResponse = false
      return reply({ message: 'synthetic committed response lost' }, 503)
    }
    return reply(value)
  }
  if (url.pathname === '/rest/v1/partner_profiles' && request.method === 'GET') {
    const user = url.searchParams.get('user_id')
    assert.ok(user && user.startsWith('eq.'))
    return reply(JSON.parse(sql(`select coalesce(json_agg(p),'[]'::json) from public.partner_profiles p where user_id=${literal(user.slice(3))}::uuid;`)))
  }
  throw Error('Unexpected local bridge call')
}
const app = express(); app.use(express.json()); app.use('/api/partners', partnersRouter)
const server = app.listen(0, '127.0.0.1')
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
const address = server.address(); assert.ok(address && typeof address !== 'string')
const base = `http://127.0.0.1:${address.port}/api/partners`
const token = (user: string) => jwt.sign({ sub: user, role: 'authenticated', aud: 'authenticated', iss: 'https://local-bridge.invalid/auth/v1' }, process.env.SUPABASE_JWT_SECRET!, { expiresIn: 300 })
const profile = { displayName: '合成HTTP試験', birthDate: '2000-01-01', birthplace: '東京都', gender: 'female', relationshipType: 'friend', relationshipLabel: '友人' }
async function call(path: string, method = 'GET', user = owner, op = operation) {
  return nativeFetch(base + path, { method, headers: { authorization: `Bearer ${token(user)}`, 'Content-Type': 'application/json', 'Idempotency-Key': op }, ...(method === 'POST' && path === '' ? { body: JSON.stringify(profile) } : {}) })
}
try {
  assert.equal((await nativeFetch(base)).status, 401)
  assert.equal((await call('', 'POST')).status, 503)
  assert.equal(sql(`select count(*) from partner_profiles where user_id=${literal(owner)};`), '1')
  const recoveredResponse = await call(`/registration/operations/${operation}`)
  assert.equal(recoveredResponse.status, 200)
  assert.equal(recoveredResponse.headers.get('cache-control'), 'private, no-store')
  const recovered = await recoveredResponse.json() as any
  assert.equal(recovered.state, 'completed')
  const replay = await call('', 'POST'); assert.equal(replay.status, 201)
  assert.equal((await replay.json() as any).partner.id, recovered.partner.id)
  assert.equal((await (await call('')).json() as any).partners.length, 1)
  assert.equal((await (await call(`/registration/operations/${operation}`, 'GET', other)).json() as any).state, 'not_found')
  assert.equal((await (await call('', 'GET', other)).json() as any).partners.length, 0)
  assert.equal((await (await call(`/registration/operations/${cancelled}/cancel`, 'POST')).json() as any).state, 'cancelled')
  assert.equal((await call('', 'POST', owner, cancelled)).status, 410)
  sql(`delete from partner_profiles where id=${literal(recovered.partner.id)}::uuid;`)
  assert.equal((await (await call(`/registration/operations/${operation}`)).json() as any).state, 'deleted')
  assert.equal((await call('', 'POST')).status, 410)
  assert.equal(sql(`select count(*) from partner_profiles where user_id=${literal(owner)};`), '0')
  console.log('PASS HTTP/JWT -> production router -> RPC bridge -> real local SQL: lost response, replay, owner separation, cancellation, deletion')
  console.log('LIMIT: PostgREST is replaced by a test bridge; iOS client and live environment are not exercised')
} finally {
  globalThis.fetch = nativeFetch
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}
