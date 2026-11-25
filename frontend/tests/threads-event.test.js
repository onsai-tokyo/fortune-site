import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/threads-event.js'
import { guideReadingEvents } from '../src/web/data/guideReadingMeasurement.js'
import { attributionFromGuide, classifySource, rememberGuideEntry, sanitizeLandingPath } from '../src/web/data/measurementRules.js'

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
  assert.equal(classifySource(url('/coupons'), 'https://l.threads.com/'), 'threads')
  assert.equal(classifySource(url('/coupons'), 'https://www.threads.net/'), 'threads')
  assert.equal(classifySource(url('/coupons'), 'https://threads.com.example.test/'), 'direct')
})

test('carries a safe search or Threads landing through guide navigation', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }
  const guide = new URL('https://fate-lab.com/guides/marriage-timing?private_token=secret')
  const tool = new URL('https://fate-lab.com/tools/shichu-suimei-calculator')
  rememberGuideEntry(guide, 'https://www.google.co.jp/?q=secret', storage, 1000)
  rememberGuideEntry(tool, guide.href, storage, 1020)
  assert.deepEqual(attributionFromGuide(storage, 1040), {
    source: 'organic_search', fl_search_engine: 'google', landing_path: '/guides/marriage-timing', fl_landing_group: 'guide', referrer_path: undefined, campaign_name: '(not set)',
  })
  assert.equal(attributionFromGuide(storage, 2800), undefined)
  rememberGuideEntry(new URL(guide.origin + guide.pathname + '?utm_source=threads&utm_campaign=seo_share'), '', storage, 3000)
  assert.equal(attributionFromGuide(storage, 3010).source, 'threads')
  assert.equal(attributionFromGuide(storage, 3010).campaign_name, 'seo_share')
  assert.ok(![...data.values()].join().includes('secret'))
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
  assert.equal(params.campaign_medium, undefined)
  assert.equal(params.fl_traffic_source, 'site_guide')
  assert.equal(params.campaign_name, undefined)
  assert.equal(params.page_location, 'https://fate-lab.com/coupons')
  assert.equal(params.link_type, 'affiliate')
  assert.equal(params.offer_id, 'coconala-phone')
  assert.ok(!JSON.stringify(payload).includes('private-id'))
  for (const key of ['landing_path', 'referrer_path', 'referrer', 'reading_id']) assert.ok(!(key in params))
  await handler({ ...req, body: { ...req.body, event: 'coupon_view', source: 'threads', landing_path: '/' } }, res)
  assert.equal(res.code, 204)
  assert.equal(payload.events[0].name, 'page_view')
  assert.equal(payload.events[0].params.page_location, 'https://fate-lab.com/coupons')
  assert.equal(payload.events[0].params.landing_path, '/')
  assert.equal(payload.events[0].params.source, undefined)
  assert.equal(payload.events[0].params.fl_traffic_source, 'threads')
  assert.equal(payload.events[0].params.link_type, undefined)
  for (const event of ['self_reading_complete', 'couple_reading_complete', 'coupon_click']) {
    await handler({ ...req, body: { event, clientId: req.body.clientId, sessionId,
      source: 'organic_search', landing_path: '/guides/marriage-timing' } }, res)
    assert.equal(res.code, 204)
    assert.equal(payload.events[0].params.fl_traffic_source, 'organic_search')
    assert.equal(payload.events[0].params.landing_path, '/guides/marriage-timing')
  }
  await handler({ ...req, body: { event: 'coupon_click', clientId: req.body.clientId, sessionId } }, res)
  assert.equal(payload.events[0].params.fl_traffic_source, 'unknown')
  await handler({ ...req, headers: { origin: 'https://example.com' } }, res)
  assert.equal(res.code, 403)
  assert.equal(send.mock.callCount(), 6)

  const click = { ...req.body, source: 'threads' }
  await handler({ ...req, body: click }, res)
  assert.equal(res.code, 204)
  assert.equal(payload.client_id, click.clientId)
  assert.deepEqual(payload.events.map(event => event.name), ['coupon_click', 'coconala_list_click', 'threads_coconala_click'])

  await handler({ ...req, body: { ...click, test: true } }, res)
  assert.equal(payload.client_id, click.clientId)
  assert.deepEqual(payload.events.map(event => event.name), ['qa_coupon_click', 'qa_coconala_list_click', 'qa_threads_coconala_click'])

  await handler({ ...req, body: { ...click, event: 'coupon_view', test: true } }, res)
  assert.deepEqual(payload.events.map(event => event.name), ['qa_page_view', 'qa_threads_coupon_view'])

  await handler({ ...req, body: { ...click, event: 'coconala_banner_click' } }, res)
  assert.equal(res.code, 204)
  assert.deepEqual(payload.events.map(event => event.name), ['coconala_banner_click'])
  assert.equal(payload.events[0].params.fl_traffic_source, 'threads')

  await handler({ ...req, body: { ...click, event: 'coconala_banner_click', test: true } }, res)
  assert.deepEqual(payload.events.map(event => event.name), ['qa_coconala_banner_click'])

  await handler({ ...req, body: { ...click, source: 'direct' } }, res)
  assert.deepEqual(payload.events.map(event => event.name), ['coupon_click', 'coconala_list_click'])

  await handler({ ...req, body: { ...click, offer_id: 'spacia-phone' } }, res)
  assert.deepEqual(payload.events.map(event => event.name), ['coupon_click'])
})

test('forwards an article path and no personal fields at every guide reading stage', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true }))
  const original = process.env.GA4_API_SECRET
  process.env.GA4_API_SECRET = 'test'
  t.after(() => {
    if (original === undefined) delete process.env.GA4_API_SECRET
    else process.env.GA4_API_SECRET = original
  })
  const now = Math.floor(Date.now() / 1000)
  const res = { setHeader() {}, status(code) { this.code = code; return this }, end() {} }
  const req = { method: 'POST', headers: { origin: 'https://fate-lab.com' }, body: {
    clientId: `123.${now}`, sessionId: now, guidePath: '/guides/day-master/kinoe/',
    birthDate: '1990-02-03', gender: 'female', source: 'threads', referrer_path: '/guides/compatibility',
    page_location: 'https://example.test/with-personal-data',
  } }
  for (const event of Object.values(guideReadingEvents)) {
    await handler({ ...req, body: { ...req.body, event } }, res)
    assert.equal(res.code, 204)
    const payload = JSON.parse(fetch.mock.calls.at(-1).arguments[1].body)
    assert.equal(payload.client_id, req.body.clientId)
    assert.deepEqual(payload.events, [{ name: event, params: {
      session_id: now, engagement_time_msec: 1, page_location: 'https://fate-lab.com/guides/day-master/kinoe',
      guide_path: '/guides/day-master/kinoe', reading_type: 'self', fl_landing_path: 'other', fl_landing_group: 'other',
      fl_traffic_source: 'threads',
    } }])
    await handler({ ...req, body: { ...req.body, event, test: true } }, res)
    assert.equal(res.code, 204)
  }
  for (const guidePath of ['/tools/shichu-suimei-calculator', '/guides', '/guides/marriage-timing?birthDate=1990-02-03', 'https://example.test/guides/other']) {
    await handler({ ...req, body: { ...req.body, event: guideReadingEvents.start, guidePath } }, res)
    assert.equal(res.code, 400)
  }
  assert.equal(fetch.mock.callCount(), 6)
  for (const { arguments: [, options] } of fetch.mock.calls) {
    const event = JSON.parse(options.body).events[0]
    assert.equal(event.name.startsWith('qa_'), event.params.traffic_type === 'internal')
    assert.doesNotMatch(options.body, /1990-02-03|female|personal-data/)
  }
})
