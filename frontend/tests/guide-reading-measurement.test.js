import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearCompletedGuideReading, guideReadingEvents, pendingGuideReading,
  recordGuideReadingBanner, recordGuideReadingResult, startGuideReading,
} from '../src/web/data/guideReadingMeasurement.js'
import { readTagIdentity } from '../src/web/data/browserMeasurement.js'
import { isMeasurementTest, measurementSessionKey } from '../src/web/data/measurementRules.js'

function browserStorage() {
  const storage = new Map()
  return {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }
}

function setup(t) {
  const startedAt = 1800000000000
  const open = path => { globalThis.location = new URL(path, 'https://fate-lab.com') }
  for (const key of ['location', 'sessionStorage', 'localStorage']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: browserStorage() })
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    })
  }
  open('/guides/marriage-timing')
  const clock = t.mock.method(Date, 'now', () => startedAt)
  const sent = []
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/threads-event')
    assert.equal(options.mode, 'cors')
    assert.equal(options.keepalive, true)
    assert.equal(options.referrerPolicy, 'no-referrer')
    sent.push(JSON.parse(options.body))
  })
  return { startedAt, open, clock, sent }
}

test('tracks an article start, the displayed result and one subsequent result banner click', t => {
  const { startedAt, open, sent } = setup(t)
  const clientId = '12.1799999999'
  open('/guides/day-master/kinoe/?utm_campaign=secret#anchor')
  readTagIdentity((_command, _tag, key, resolve) => resolve(key === 'client_id' ? clientId : startedAt / 1000 - 30))
  startGuideReading()
  open('/welcome?from=guide&returnTo=%2Fyou')
  assert.equal(pendingGuideReading(), startedAt)
  recordGuideReadingBanner('/you') // A banner before the result is never part of this funnel.
  recordGuideReadingResult(startedAt - 1)
  assert.equal(sent.length, 1)
  open('/you')
  recordGuideReadingResult(startedAt)
  recordGuideReadingResult(startedAt) // StrictMode or revisiting the result.
  recordGuideReadingBanner('/couple')
  recordGuideReadingBanner('/you/years/2026')
  recordGuideReadingBanner('/you')
  assert.deepEqual(sent.map(hit => hit.event), Object.values(guideReadingEvents))
  assert.match(sent[0].flow_id, /^[0-9a-f]{16}$/)
  for (const hit of sent) {
    assert.equal(hit.flow_id, sent[0].flow_id)
    assert.equal(hit.clientId, clientId)
    assert.equal(hit.sessionId, startedAt / 1000 - 30)
    assert.equal(hit.guidePath, '/guides/day-master/kinoe')
    assert.equal(hit.reading_type, 'self')
  }
  assert.equal(sent.at(-1).cta_position, 'year_result')
})

test('expires journeys and replaces an earlier article for a new reading in the same tab', t => {
  const { startedAt, open, clock, sent } = setup(t)
  startGuideReading()
  clock.mock.mockImplementation(() => startedAt + 1000)
  open('/guides/meeting-timing')
  startGuideReading()
  assert.equal(sent[0].clientId, sent[1].clientId)
  assert.deepEqual(sent.map(event => event.guidePath), ['/guides/marriage-timing', '/guides/meeting-timing'])
  recordGuideReadingResult(startedAt)
  assert.equal(sent.length, 2)
  recordGuideReadingResult(pendingGuideReading())
  clearCompletedGuideReading() // A new non-guide reading supersedes the previous result.
  recordGuideReadingBanner('/you')
  assert.equal(sent.length, 3)
  startGuideReading()
  clock.mock.mockImplementation(() => startedAt + 1801000)
  assert.equal(pendingGuideReading(), undefined)
  recordGuideReadingResult(startedAt + 1000)
  assert.equal(sent.length, 4)
})

test('marks the whole QA funnel internal after the URL loses the marker', t => {
  const { open, sent, startedAt } = setup(t)
  open('/guides/marriage-timing?fl_test=1')
  startGuideReading()
  assert.equal(pendingGuideReading(), startedAt)
  open('/guides/meeting-timing')
  assert.equal(isMeasurementTest(location), true)
  startGuideReading()
  open('/you')
  recordGuideReadingResult(startedAt)
  recordGuideReadingBanner('/you')
  assert.equal(sent.length, 4)
  assert.ok(sent.every(hit => hit.test))
  assert.equal(isMeasurementTest(new URL('/?fl_test=0', location.origin)), false)
  assert.equal(isMeasurementTest(new URL('/couple', location.origin)), false)
})

test('honors a QA visit already marked by the site and skips non-production origins', t => {
  const { open, sent, startedAt } = setup(t)
  sessionStorage.setItem(measurementSessionKey, JSON.stringify({ test: true, sessionId: startedAt / 1000 }))
  startGuideReading()
  sessionStorage.removeItem(measurementSessionKey)
  assert.equal(sent[0].test, true)
  for (const host of ['localhost', '127.0.0.1', 'preview.vercel.app']) {
    open('https://' + host + '/guides/marriage-timing')
    startGuideReading()
  }
  assert.equal(sent.length, 1)
})
