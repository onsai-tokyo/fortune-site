import test from 'node:test'
import assert from 'node:assert/strict'
import { readingRouter } from './reading.js'

test('compatibility history paginates owned reports without generation or payment', async () => {
  const owner = '11111111-1111-4111-8111-111111111111'
  const partner = '22222222-2222-4222-8222-222222222222'
  const oldFetch = globalThis.fetch
  const names = ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
  const previous = names.map(name => process.env[name])
  process.env.SUPABASE_URL = 'https://synthetic.invalid'
  process.env.SUPABASE_ANON_KEY = 'synthetic'
  const route = (readingRouter as any).stack.find((entry: any) => entry.route?.path === '/conversations' && entry.route?.methods.get).route
  assert.equal(route.stack.length, 2, 'authentication middleware remains required')
  const handler = route.stack.at(-1).handle
  let calls: URL[] = [], rows: any[] = [], status = 200
  const response = () => ({
    statusCode: 200, body: undefined as any, headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value },
    status(value: number) { this.statusCode = value; return this },
    json(value: unknown) { this.body = value; return this },
  })
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input))
      calls.push(url)
      assert.equal(url.origin, 'https://synthetic.invalid')
      assert.equal(url.pathname, '/rest/v1/reading_conversations')
      assert.equal(init?.method ?? 'GET', 'GET')
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-owner-token')
      assert.equal(url.searchParams.get('user_id'), `eq.${owner}`)
      return new Response(JSON.stringify(status === 200 ? rows : { code: 'synthetic_failure', message: 'failure' }), { status, headers: { 'Content-Type': 'application/json' } })
    }
    const req = (query: Record<string, unknown>) => ({ userId: owner, accessToken: 'synthetic-owner-token', query })
    const query = { compatibilityHistory: '1', partnerId: partner, userId: 'untrusted-other-owner' }
    rows = Array.from({ length: 101 }, (_, index) => ({ id: `${(101 - index).toString(16).padStart(8, '0')}-3333-4333-8333-333333333333`, kind: 'compatibility' }))
    let res = response()
    await handler(req(query), res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.conversations.length, 100)
    assert.deepEqual(res.body.compatibilityHistory, { complete: false, nextCursor: rows[99].id })
    assert.equal(res.headers['Cache-Control'], 'private, no-store')
    assert.equal(calls[0].searchParams.get('kind'), 'eq.compatibility')
    assert.equal(calls[0].searchParams.get('partner_profile_id'), `eq.${partner}`)
    assert.equal(calls[0].searchParams.get('order'), 'id.desc')
    assert.equal(calls[0].searchParams.get('limit'), '101')
    const cursor = rows[99].id
    rows = rows.slice(100)
    res = response()
    await handler(req({ ...query, cursor }), res)
    assert.deepEqual(res.body.compatibilityHistory, { complete: true, nextCursor: null })
    assert.equal(res.body.conversations.length, 1)
    assert.equal(calls.at(-1)!.searchParams.get('id'), `lt.${cursor}`)
    rows = []
    res = response()
    await handler(req(query), res)
    assert.deepEqual(res.body.compatibilityHistory, { complete: true, nextCursor: null })

    for (const invalid of [{ partnerId: 'bad' }, { partnerId: [partner] }, { cursor: 'bad' }, { cursor: [cursor] }]) {
      const before = calls.length
      res = response()
      await handler(req({ ...query, ...invalid }), res)
      assert.equal(res.statusCode, 400)
      assert.equal(calls.length, before)
    }
    status = 503
    res = response()
    await handler(req(query), res)
    assert.equal(res.statusCode, 503)
    assert.equal(res.body.compatibilityHistory, undefined, 'outage must not acknowledge complete empty history')

    status = 200
    rows = [{ id: owner, kind: 'self', title: 'existing title' }]
    calls = []
    res = response()
    await handler(req({}), res)
    assert.deepEqual(res.body, { conversations: rows }, 'existing web/list response stays unchanged')
    assert.equal(calls[0].searchParams.get('kind'), null)
    assert.equal(calls[0].searchParams.get('limit'), '100')
  } finally {
    globalThis.fetch = oldFetch
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index] })
  }
})
