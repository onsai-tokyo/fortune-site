import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/threads-event.js'
import { guideReadingPath, articleOrigin, startGuideCouple } from '../src/web/data/guideReadingMeasurement.js'
import { arrivalAttribution, landingGroupsFor, measurementSessionKey, safeCampaignQuery, sanitizeAttribution } from '../src/web/data/measurementRules.js'
import { startThreadsMeasurement, trackMeasurementRoute, trackThreadsEvent } from '../src/web/data/threadsMeasurement.ts'

const origin = 'https://fate-lab.com'
const storage = () => {
  const entries = new Map()
  return { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) }
}

test('landing groups use only published paths, with specific series and annual guides taking precedence', () => {
  const examples = [
    ['/', 'top'], ['/threads-launch', 'top'], ['/couple/', 'couple'],
    ['/tools/', 'tool'], ['/tools/shichu-suimei-calculator', 'tool'],
    ['/guides/', 'guide'], ['/guides/day-master', 'guide'], ['/guides/marriage-timing', 'guide'],
    ['/guides/day-master/kinoe', 'series'], ['/guides/ten-god/hiken', 'series'],
    ['/guides/twelve-stage/chosei', 'series'], ['/uranai/konki', 'uranai'], ['/coupons', 'other'],
    ['/r/private-token', 'other'], ['/guides/ten-god/private-token', 'other'],
    ['/uranai/1995-02-20', 'other'], ['/guides/compatibility?gender=female', 'other'],
    [undefined, 'other'],
  ]
  for (const [landing_path, expected] of examples) {
    assert.equal(sanitizeAttribution({ landing_path, fl_landing_group: 'fortune' }).fl_landing_group, expected)
  }
  // The annual hub and its articles join this index when added to the public inventory.
  const annual = landingGroupsFor(['/guides/2027-fortune', '/guides/2027-fortune/kinoe'])
  assert.deepEqual([...annual.values()], ['fortune', 'fortune'])
  assert.equal(annual.has('/guides/2027-fortune/private-token'), false)
})

test('routes, guide-to-couple and the static loader share the production boundary', async t => {
  const sent = []
  const open = path => { globalThis.location = new URL(path, origin) }
  for (const [key, value] of Object.entries({ localStorage: storage(), sessionStorage: storage(), location: null, document: { referrer: '' } })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    t.after(() => { delete globalThis[key] })
  }
  t.mock.method(globalThis, 'fetch', async (_url, { body }) => { sent.push(JSON.parse(body)); return { ok: true } })
  for (const host of ['localhost', '127.0.0.1', 'preview.vercel.app']) {
    open('https://' + host + '/guides/compatibility?fl_test=1')
    await import(new URL('../dist/assets/static-measurement.js?' + host, import.meta.url))
    startThreadsMeasurement()
    trackMeasurementRoute('/coupons')
    trackThreadsEvent('coconala_banner_click')
    startGuideCouple()
  }
  assert.equal(sent.length, 0)

  open('/guides/compatibility?utm_source=threads&fl_test=1')
  startGuideCouple()
  open('/couple')
  startThreadsMeasurement()
  trackMeasurementRoute('/couple')
  trackMeasurementRoute('/couple')
  trackThreadsEvent('couple_reading_complete')
  trackThreadsEvent('coconala_banner_click', { cta_position: 'couple_result' })
  trackMeasurementRoute('/coupons')
  trackMeasurementRoute('/coupons')
  open('/you/years/2027?gender=female&dob=1995-02-20&utm_source=threads')
  trackMeasurementRoute('/you/years/2027')
  open('/r/private-token')
  trackMeasurementRoute('/r/private-token')
  assert.deepEqual(sent.filter(hit => ['page_view', 'coupon_view'].includes(hit.event)).map(hit => hit.page_path),
    ['/couple', '/coupons', '/you', '/you'])
  assert.ok(sent.every(hit => hit.test && hit.source === 'threads' && hit.landing_path === '/guides/compatibility' && hit.fl_landing_group === 'guide'))
  assert.equal(JSON.parse(sessionStorage.getItem(measurementSessionKey)).fl_landing_group, 'guide')
  assert.equal(localStorage.getItem(measurementSessionKey), null)
  for (const hit of sent.filter(hit => ['guide_to_couple', 'couple_reading_complete', 'coconala_banner_click'].includes(hit.event))) {
    assert.equal(hit.guidePath, '/guides/compatibility')
    assert.equal(hit.flow_id, undefined)
  }
  assert.doesNotMatch(JSON.stringify(sent), /private-token|female|1995-02-20|\/years\/2027/)
  assert.equal(sent.find(hit => hit.cta_position)?.cta_position, 'couple_result')
  const now = Date.now()
  t.mock.method(Date, 'now', () => now + 86400000)
  assert.deepEqual(articleOrigin('couple'), {})
  open('/coupons')
  trackThreadsEvent('coupon_click', { offer_id: 'coconala-phone', link_type: 'affiliate' })
  assert.equal(sent.at(-1).test, true)
  assert.equal(sent.at(-1).fl_landing_group, 'other')
  open('/coupons?fl_test=0')
  trackThreadsEvent('coupon_click')
  assert.equal(sent.at(-1).test, false)
})

test('collection rebuilds page locations, source, tool names and CTA fields from public values', async t => {
  const requests = []
  const secret = process.env.GA4_API_SECRET
  process.env.GA4_API_SECRET = 'test'
  t.after(() => { if (secret === undefined) delete process.env.GA4_API_SECRET; else process.env.GA4_API_SECRET = secret })
  t.mock.method(globalThis, 'fetch', async (_url, { body }) => { requests.push(JSON.parse(body)); return { ok: true } })
  const now = Math.floor(Date.now() / 1000)
  const post = async (event, extra) => {
    const res = { status(n) { this.code = n; return this }, setHeader() {}, end() {} }
    await handler({ method: 'POST', headers: { origin }, body: { event, clientId: '42.' + now,
      sessionId: now, test: true, page_path: '/welcome', source: 'organic_search', landing_path: '/guides/compatibility',
      fl_search_engine: 'google', engagement: 1800001, ...extra } }, res)
    return res.code
  }
  for (const event of ['self_reading_complete', 'couple_reading_complete']) {
    for (const test of [false, true]) {
      assert.equal(await post(event, {
        test, page_path: '/you', landing_path: '/tools/day-master', fl_landing_group: 'private-token',
        birthDate: '1995-02-20', gender: 'female', birthTime: '05:40', metYear: '2021',
      }), 204)
      const [hit] = requests.at(-1).events
      assert.equal(hit.name, test ? 'qa_' + event : event)
      assert.equal(hit.params.traffic_type, test ? 'internal' : undefined)
      assert.equal(hit.params.fl_traffic_source, 'organic_search')
      assert.equal(hit.params.fl_landing_group, 'tool')
      assert.doesNotMatch(JSON.stringify(hit), /private-token|1995-02-20|female|05:40|"2021"|metYear|birthDate|birthTime|gender/)
    }
  }
  const utm = { utm_source: 'threads', utm_medium: 'social', utm_campaign: 'seo_share', dob: '1995-02-20' }
  assert.equal(await post('page_view', utm), 204)
  let hit = requests.at(-1).events[0]
  assert.equal(hit.name, 'qa_page_view')
  assert.equal(hit.params.traffic_type, 'internal')
  assert.equal(hit.params.engagement_time_msec, 1800000)
  assert.equal(hit.params.fl_search_engine, 'google')
  assert.equal(hit.params.fl_landing_path, '/guides/compatibility')
  assert.equal(hit.params.page_location, origin + '/welcome?utm_source=threads&utm_medium=social&utm_campaign=seo_share')
  assert.equal(await post('page_view', { ...utm, page_path: '/you' }), 204)
  assert.equal(requests.at(-1).events[0].params.page_location, origin + '/you')
  assert.equal(await post('page_view', { page_path: '/guides/private-token' }), 400)
  assert.equal(await post('seo_tool_complete', { tool_name: 'day_master', result: 'private-result', gender: 'female' }), 204)
  hit = requests.at(-1).events[0]
  assert.equal(hit.params.tool_name, 'day_master')
  assert.doesNotMatch(JSON.stringify(requests), /private-token|private-result|1995-02-20|female/)
  assert.equal(guideReadingPath('/guides/1995-02-20'), undefined)
  assert.equal(safeCampaignQuery({ utm_campaign: 'private-token', utm_source: 'female' }).toString(), '')
  for (const [host, engine] of [['www.google.co.jp', 'google'], ['search.yahoo.co.jp', 'yahoo'], ['bing.com', 'bing'], ['duckduckgo.com', 'other']]) {
    assert.equal(arrivalAttribution(new URL(origin), 'https://' + host + '/?q=private').fl_search_engine, engine)
  }
  const chat = arrivalAttribution(new URL('/?utm_source=openai', origin), '')
  assert.equal(chat.source, 'other_campaign')
  assert.equal(chat.campaign_name, 'openai')
})
