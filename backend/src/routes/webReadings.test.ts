import test from 'node:test'
import assert from 'node:assert/strict'
import { webCoupleTimeline, webReadingOverview } from './webReadings.js'
import { coupleSnapshot, snapshotTimeline } from '../lib/report/coupleAllYears/snapshot.js'
import { bookSources } from '../lib/aiBooks.js'
import { profileMeetingKey } from './coupleTimeline.js'
const source = '11111111-1111-4111-8111-111111111111', partner = '22222222-2222-4222-8222-222222222222'

test('Web overview scopes self and partner to owner; future range is bounded and cards are projected', async () => {
  for (const kind of ['partner', 'future'] as const) for (const foreign of ['', 'self', 'partner']) {
    const reads: string[] = []
    let calculations = 0, status = 200, body: any
    const req = { userId: 'owner', accessToken: 'token', params: { selfId: source, partnerId: partner } }
    const res = { setHeader() {}, status(n: number) { status = n; return res }, json(v: unknown) { body = v } }
    const year = new Date().getFullYear()
    const deps = {
      admin: () => ({ from(table: string) {
        const filters: Record<string, string> = {}
        const q = { select() { return q }, eq(k: string, v: string) { filters[k] = v; return q }, async maybeSingle() {
          reads.push(table); assert.equal(filters.user_id, 'owner')
          assert.equal(filters.id, table === 'reading_conversations' ? source : partner)
          return { error: null, data: (table === 'reading_conversations' && foreign === 'self') || (table === 'partner_profiles' && foreign === 'partner') ? null : table === 'reading_conversations' ? { kind: 'self', birth_data: {} } : { birth_time: '03:02:00' } }
        } }; return q
      } }),
      partner: (v: any) => { calculations++; assert.equal(v.partner.birth_time, '03:02'); return { cards: [{ id: 'personality' }, { id: 'private-chart', kind: 'chart' }] } },
      future: (_v: unknown, end: number) => { calculations++; assert.equal(end, year + 5); return { cards: [{ id: `year-${year}` }, { id: `year-${year + 1}` }, { id: `year-${year + 6}` }] } },
      context: async () => ({}), project: async () => (card: any) => ({ ...card, projected: true }),
    }
    await webReadingOverview(req as any, res as any, kind, deps as any)
    const denied = foreign === 'self' || kind === 'partner' && foreign === 'partner'
    assert.equal(status, denied ? 404 : 200)
    assert.equal(calculations, denied ? 0 : 1)
    if (!denied) { assert.equal(body.cards.length, 1); assert.equal(body.cards[0].projected, true) }
    assert.ok(reads.every(t => ['reading_conversations', 'partner_profiles'].includes(t)))
  }
})
function setup(birthDate = '1994-05-12', otherDate = '1996-08-23') {
  const saved: { payload: unknown; operation: string | undefined }[] = []
  const a = { id: source, kind: 'self', birth_data: { birthDate, birthTime: '12:00', birthplace: '東京都', gender: 'female' }, reading_revision_id: 'revision' }
  const b = { id: partner, display_name: '相手', birth_date: otherDate, birth_time: '10:00:00', birthplace: '東京都', gender: 'male', relationship_label: '友人', relationship_type: 'friend' }
  const client = { from(table: string) {
    assert.ok(['reading_conversations', 'partner_profiles', 'couple_timeline_settings'].includes(table), 'no points/AI/grant queries')
    const filters: Record<string, unknown> = {}
    const query = { select() { return query }, eq(k: string, v: unknown) { filters[k] = v; return query }, async maybeSingle() { const row = table === 'reading_conversations' ? a : table === 'partner_profiles' ? b : { meeting_year: 2024 }; return { data: filters.user_id !== 'owner' || ('id' in row && filters.id !== row.id) ? null : row, error: null } } }
    return query
  } }
  const deps = { user: () => client, admin: () => client, timeline: snapshotTimeline, context: async () => ({ lifeEvents: [] }), save: async (_token: string, payload: unknown, _title: string, operation?: string) => { saved.push({ payload, operation }); return { id: source, revisionId: partner, reused: false } } }
  let status = 200, body: any
  const res = { setHeader() {}, status(code: number) { status = code; return res }, json(value: unknown) { body = value } }
  const req = { params: { selfId: source, partnerId: partner }, userId: 'owner', accessToken: 'synthetic', method: 'GET', body: {} }
  const run = async () => { await webCoupleTimeline(req as any, res as any, deps as any); return { status, body } }
  return { a, b, req, run, saved, deps }
}
test('Web couple timeline uses exactly the same snapshot engine as iOS, with real births', async () => {
  const previous = process.env.COUPLE_TIMELINE_ENGINE
  try {
    for (const engine of ['', 'v3']) {
      process.env.COUPLE_TIMELINE_ENGINE = engine
      const outputs: string[] = []
      for (const selfBirth of ['1994-05-12', '1983-01-28']) for (const partnerBirth of ['1996-08-23', '1990-11-07']) {
        const fixture = setup(selfBirth, partnerBirth), result = await fixture.run()
        assert.equal(result.status, 200)
        assert.deepEqual(result.body, snapshotTimeline(coupleSnapshot({ self: fixture.a.birth_data, partner: fixture.b, relationshipLabel: '友人', relationshipType: 'friend' }, partner), 2024, []))
        assert.equal(fixture.saved.length, 0, 'GET must not create sources or consume credits')
        outputs.push(JSON.stringify(result.body.entries))
      }
      assert.equal(new Set(outputs).size, 4, 'two real birthdays x two real partner birthdays must differ')
    }
  } finally { if (previous === undefined) delete process.env.COUPLE_TIMELINE_ENGINE; else process.env.COUPLE_TIMELINE_ENGINE = previous }
})
test('selected couple year is saved with correct owned source and idempotent operation, never arbitrary client prose', async () => {
  const f = setup(); const timeline = (await f.run()).body
  f.req.method = 'POST'; f.req.body = { year: 2026, reportText: 'client must not control source' }
  const result = await f.run()
  assert.equal(result.status, 200); assert.equal(result.body.sourceId, source)
  const payload = f.saved[0].payload as any
  assert.equal(payload.kind, 'compatibility'); assert.equal(payload.partnerProfileId, partner); assert.equal(payload.sourceYear, 2026)
  assert.equal(payload.calculatedData._structuredReport.cards[0].id, timeline.entries.find((e: any) => e.year === 2026).card.id)
  assert.ok(bookSources({ kind: payload.kind, calculated_data: payload.calculatedData }, '人間関係').length >= 3)
  assert.ok(!JSON.stringify(payload).includes('client must not control source'))
  await f.run(); assert.equal(f.saved[0].operation, f.saved[1].operation)
  f.req.body = { year: 1800 }; assert.equal((await f.run()).status, 422)
})
test('Web couple timeline rejects another user before calculation or persistence', async () => {
  const f = setup(); f.req.userId = 'other'
  assert.equal((await f.run()).status, 404); assert.equal(f.saved.length, 0)
})
test('Web couple timeline rejects missing self/partner IDs, including POST persistence', async () => {
  for (const key of ['selfId', 'partnerId'] as const) {
    const f = setup(); f.req.method = 'POST'; f.req.body = { year: 2026 }
    f.req.params[key] = '99999999-9999-4999-8999-999999999999'
    assert.equal((await f.run()).status, 404); assert.equal(f.saved.length, 0)
    f.req.params[key] = 'invalid'
    assert.equal((await f.run()).status, 400)
  }
})

test('Web source lookup uses server-side owned reads even when authenticated table reads are forbidden', async t => {
  t.mock.method(console, 'warn', () => {})
  const f = setup()
  let userReads = 0
  f.deps.user = () => { userReads++; throw new Error('authenticated partner_profiles access forbidden') }
  assert.equal((await f.run()).status, 200)
  assert.equal(userReads, 0)
  assert.equal(f.saved.length, 0)
})

test('server-side Web source lookup filters both owner and id, rejecting mixed-owner GET and POST', async t => {
  t.mock.method(console, 'warn', () => {})
  const foreignSource = '33333333-3333-4333-8333-333333333333'
  const foreignPartner = '44444444-4444-4444-8444-444444444444'
  for (const method of ['GET', 'POST']) for (const [selfId, partnerId, expected] of [
    [source, partner, 200], [source, foreignPartner, 404],
    [foreignSource, partner, 404], [foreignSource, foreignPartner, 404],
  ] as const) {
    const f = setup()
    const reads: Array<{ table: string; filters: Record<string, unknown> }> = []
    const realTimeline = f.deps.timeline
    let calculations = 0
    f.deps.timeline = (...args) => { calculations++; return realTimeline(...args) }
    f.deps.admin = () => ({ from(table: string) {
      const filters: Record<string, unknown> = {}
      const query = { select() { return query }, eq(k: string, v: unknown) { filters[k] = v; return query }, async maybeSingle() {
        reads.push({ table, filters: { ...filters } })
        assert.equal(filters.user_id, 'owner', 'service reads must include verified request owner, never client body owner')
        if (table === 'couple_timeline_settings') {
          assert.equal(filters.relationship_key, profileMeetingKey(partner))
          return { data: { meeting_year: 2024 }, error: null }
        }
        assert.equal(typeof filters.id, 'string', 'service reads must target the selected id')
        const ownRow = table === 'reading_conversations' ? f.a : f.b
        const foreignId = table === 'reading_conversations' ? foreignSource : foreignPartner
        const row = filters.id === ownRow.id ? { ...ownRow, user_id: 'owner' }
          : filters.id === foreignId ? { ...ownRow, id: foreignId, user_id: 'other' } : null
        return { data: row?.user_id === filters.user_id ? row : null, error: null }
      } }
      return query
    } }) as any
    f.req.params = { selfId, partnerId }; f.req.method = method
    f.req.body = { year: 2026, user_id: 'other', userId: 'other', owner: 'other' }
    assert.equal((await f.run()).status, expected)
    assert.equal(reads.filter(r => r.table !== 'couple_timeline_settings').length, 2)
    assert.equal(calculations, expected === 200 ? 1 : 0)
    assert.equal(f.saved.length, expected === 200 && method === 'POST' ? 1 : 0)
  }
})

test('Web couple handler fails closed before server access if authenticated identity is absent', async t => {
  t.mock.method(console, 'warn', () => {})
  for (const missing of ['userId', 'accessToken'] as const) {
    const f = setup()
    f.req[missing] = ''
    f.deps.admin = () => { throw new Error('must not access server client') }
    assert.equal((await f.run()).status, 401)
    assert.equal(f.saved.length, 0)
  }
})

test('Web timeline diagnostics classify database failures without logging database text or private fields', async t => {
  const log = t.mock.method(console, 'warn', () => {})
  const privateText = 'DO_NOT_LOG token=secret birth=1990-01-15 report=private owner=id'
  for (const [dbCode, code] of [
    ['42501', 'DB_PERMISSION_DENIED'], ['42703', 'DB_COLUMN_MISSING'],
    ['42P01', 'DB_RELATION_MISSING'], ['PGRST116', 'DB_ROW_CARDINALITY'],
    ['PGRST200', 'DB_SCHEMA_CACHE'], ['PGRST202', 'DB_SCHEMA_CACHE'], ['PGRST204', 'DB_SCHEMA_CACHE'],
    [privateText, 'DB_READ_UNAVAILABLE'],
  ]) for (const stage of ['source_lookup', 'meeting_settings']) {
    const f = setup()
    const query = { select() { return query }, eq() { return query }, async maybeSingle() { return { data: null, error: { code: dbCode, message: privateText, details: privateText, hint: privateText } } } }
    const failingClient = { from() { return query } } as any
    const base = f.deps.admin()
    f.deps.admin = () => ({ from(table: string) {
      return (stage === 'source_lookup' ? table !== 'couple_timeline_settings' : table === 'couple_timeline_settings')
        ? failingClient.from(table) : base.from(table)
    } }) as any
    const result = await f.run()
    assert.equal(result.status, 503)
    assert.deepEqual(result.body, { error: 'ふたりの年表を読み込めませんでした。再読み込みしてください。' })
    assert.deepEqual(log.mock.calls.at(-1)?.arguments, ['WEB_COUPLE_TIMELINE_FAILED', { method: 'GET', stage, status: 503, code }])
    assert.equal(f.saved.length, 0)
  }
  assert.ok(!JSON.stringify(log.mock.calls.map(c => c.arguments)).includes(privateText))
})

test('Web timeline diagnostics identify computation and persistence stages, never raw exceptions', async t => {
  const log = t.mock.method(console, 'warn', () => {})
  const previous = process.env.COUPLE_TIMELINE_ENGINE
  const privateText = 'DO_NOT_LOG API_KEY=secret source=id question=private'
  try {
    process.env.COUPLE_TIMELINE_ENGINE = 'v3'
    for (const stage of ['birth_snapshot', 'meeting_validation', 'timeline_context', 'timeline_build', 'source_save']) {
      const f = setup()
      let code = 'UNEXPECTED_FAILURE'
      if (stage === 'birth_snapshot') { f.a.birth_data.birthDate = 'invalid'; }
      if (stage === 'meeting_validation') {
        const query = { select() { return query }, eq() { return query }, async maybeSingle() { return { data: { meeting_year: 1800 }, error: null } } }
        const base = f.deps.admin()
        f.deps.admin = () => ({ from(table: string) { return table === 'couple_timeline_settings' ? query : base.from(table) } }) as any
        code = 'INVALID_MEETING_YEAR'
      }
      if (stage === 'timeline_context') f.deps.context = async () => { throw new Error(privateText) }
      if (stage === 'timeline_build') { f.deps.timeline = () => { throw new TypeError(privateText) }; code = 'TYPE_ERROR' }
      if (stage === 'source_save') {
        f.req.method = 'POST'; f.req.body = { year: 2026 }
        f.deps.save = async () => { throw new RangeError(privateText) }; code = 'RANGE_ERROR'
      }
      assert.equal((await f.run()).status, 503)
      assert.deepEqual(log.mock.calls.at(-1)?.arguments, ['WEB_COUPLE_TIMELINE_FAILED', { method: stage === 'source_save' ? 'POST' : 'GET', stage, status: 503, code }])
    }
    assert.ok(!JSON.stringify(log.mock.calls.map(c => c.arguments)).includes(privateText))
  } finally { if (previous === undefined) delete process.env.COUPLE_TIMELINE_ENGINE; else process.env.COUPLE_TIMELINE_ENGINE = previous }
})

test('Web timeline logs fixed client-rejection codes, but nothing on success', async t => {
  const log = t.mock.method(console, 'warn', () => {})
  const f = setup()
  assert.equal((await f.run()).status, 200)
  assert.equal(log.mock.calls.length, 0)
  f.req.method = 'POST'; f.req.body = { year: 1800 }
  assert.equal((await f.run()).status, 422)
  f.req.userId = 'other'
  assert.equal((await f.run()).status, 404)
  f.req.params.selfId = 'invalid'
  assert.equal((await f.run()).status, 400)
  assert.deepEqual(log.mock.calls.map(c => c.arguments), [
    ['WEB_COUPLE_TIMELINE_FAILED', { method: 'POST', stage: 'source_selection', status: 422, code: 'YEAR_NOT_READY' }],
    ['WEB_COUPLE_TIMELINE_FAILED', { method: 'POST', stage: 'source_lookup', status: 404, code: 'SOURCE_NOT_FOUND' }],
    ['WEB_COUPLE_TIMELINE_FAILED', { method: 'POST', stage: 'request_validation', status: 400, code: 'INVALID_IDS' }],
  ])
})
