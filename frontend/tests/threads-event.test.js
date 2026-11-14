import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/threads-event.js'
import { classifySource, sanitizeLandingPath } from '../src/web/data/measurementRules.js'

test('classifies campaign, search, internal and direct arrivals in order', () => {
  const url = path => new URL(path, 'https://fate-lab.com')
  assert.equal(classifySource(url('/threads-launch?utm_source=x'), ''), 'threads')
  assert.equal(classifySource(url('/welcome?utm_source=threads'), 'https://www.google.co.jp/'), 'threads')
  assert.equal(classifySource(url('/welcome?utm_source=unknown'), ''), 'other_campaign')
  assert.equal(classifySource(url('/welcome'), 'https://www.google.co.jp/?q=test'), 'organic_search')
  assert.equal(classifySource(url('/welcome'), 'https://www.google.com.example.test/'), 'direct')
  assert.equal(classifySource(url('/couple'), 'https://fate-lab.com/guides/compatibility?token=value'), 'site_guide')
  assert.equal(classifySource(url('/couple'), 'https://fate-lab.com/guides-other/'), 'direct')
  assert.equal(sanitizeLandingPath('/reading/private-id'), 'other')
  assert.equal(sanitizeLandingPath('/you'), '/you')
})

test('forwards only validated event parameters to GA4', async t => {
  const original = process.env.GA4_API_SECRET
  process.env.GA4_API_SECRET = 'test'
  t.after(() => {
    if (original === undefined) delete process.env.GA4_API_SECRET
    else process.env.GA4_API_SECRET = original
  })
  let payload
  const send = t.mock.method(globalThis, 'fetch', async (_, options) => {
    payload = JSON.parse(options.body)
    return { ok: true }
  })
  const sessionId = Math.floor(Date.now() / 1000)
  const res = { setHeader() {}, status(code) { this.code = code; return this }, end() {} }
  const req = { method: 'POST', headers: { origin: 'https://fate-lab.com' }, body: {
    event: 'coupon_click', clientId: `123.${sessionId}`, sessionId, source: 'site_guide',
    landing_path: '/you/private-id', referrer_path: '/guides/compatibility?token=private-id',
    campaign_name: 'https://example.com/?token=private-id', link_type: 'affiliate',
    offer_id: 'coconala-phone', referrer: 'https://example.com/private-id', reading_id: 'private-id',
  } }
  await handler(req, res)
  assert.equal(res.code, 204)
  const { params } = payload.events[0]
  assert.equal(params.campaign_medium, 'internal')
  assert.equal(params.campaign_name, '(not set)')
  assert.equal(params.link_type, 'affiliate')
  assert.equal(params.offer_id, 'coconala-phone')
  assert.ok(!JSON.stringify(payload).includes('private-id'))
  for (const key of ['landing_path', 'referrer_path', 'referrer', 'reading_id']) assert.ok(!(key in params))
  await handler({ ...req, headers: { origin: 'https://example.com' } }, res)
  assert.equal(res.code, 403)
  assert.equal(send.mock.callCount(), 1)
})
