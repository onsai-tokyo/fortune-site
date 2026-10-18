import test from 'node:test'
import assert from 'node:assert/strict'
import { readingRouter } from './reading.js'

test('account deletion acknowledges completed retries and preserves real failures', async () => {
  const owner = '11111111-1111-4111-8111-111111111111'
  const oldFetch = globalThis.fetch
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
  const previous = names.map(name => process.env[name])
  process.env.SUPABASE_URL = 'https://synthetic.invalid'
  process.env.SUPABASE_SERVICE_KEY = 'synthetic'
  const route = (readingRouter as any).stack.find((entry: any) => entry.route?.path === '/account').route
  assert.equal(route.stack.length, 2, 'authentication middleware must remain before the handler')
  const handler = route.stack.at(-1).handle
  try {
    for (const scenario of [
      { name: 'first deletion', get: 200, remove: 200, expected: 204, methods: ['GET', 'DELETE'] },
      { name: 'lost acknowledgement retry', get: 404, code: 'user_not_found', expected: 204, methods: ['GET'] },
      { name: 'concurrent deletion', get: 200, remove: 404, code: 'user_not_found', expected: 204, methods: ['GET', 'DELETE'] },
      { name: 'generic 404', get: 404, code: 'not_found', expected: 500, methods: ['GET'] },
      { name: 'permission denied', get: 403, code: 'not_admin', expected: 500, methods: ['GET'] },
      { name: 'auth outage', get: 503, code: 'unexpected_failure', expected: 500, methods: ['GET'] },
      { name: 'database error', get: 200, remove: 500, code: 'unexpected_failure', expected: 500, methods: ['GET', 'DELETE'] },
    ]) {
      const calls: string[] = []
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input))
        assert.equal(url.origin, 'https://synthetic.invalid', 'no live auth or database requests')
        assert.equal(url.pathname, `/auth/v1/admin/users/${owner}`, 'use only the authenticated subject')
        const method = init?.method ?? 'GET'
        calls.push(method)
        const status = method === 'DELETE' ? scenario.remove! : scenario.get
        const body = status === 200 ? { id: owner, identities: [{ provider: 'google' }] }
          : { code: scenario.code, msg: 'synthetic failure' }
        return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } })
      }
      const res = {
        statusCode: 200, ended: false, body: undefined as any,
        status(code: number) { this.statusCode = code; return this },
        end() { this.ended = true; return this },
        json(body: unknown) { this.body = body; return this },
      }
      await handler({ userId: owner }, res)
      assert.equal(res.statusCode, scenario.expected, scenario.name)
      assert.deepEqual(calls, scenario.methods, scenario.name)
      assert.equal(res.ended, scenario.expected === 204, scenario.name)
    }
  } finally {
    globalThis.fetch = oldFetch
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name]
      else process.env[name] = previous[index]
    })
  }
})
