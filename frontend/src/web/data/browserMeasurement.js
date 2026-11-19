import {
  arrivalAttribution, attributionFromGuide, attributionLifetime, isMeasurementTest, measurementClientIdPattern,
  measurementSessionKey, productionOrigin, safeCampaignQuery, sanitizeAttribution, sanitizeLandingPath,
} from './measurementRules.js'

const visitorKey = 'fl-coupon-visitor-v1'
let current
let pageStart
let tagClient
let tagSession
const nowSeconds = () => Math.floor(Date.now() / 1000)
const validClient = id => typeof id === 'string' && measurementClientIdPattern.test(id)
const live = (start, now) => Number.isInteger(start) && start <= now && now - start < attributionLifetime

export function resetEngagement() { pageStart = Date.now() }

export function readTagIdentity(tag = globalThis.gtag) {
  if (location.origin !== productionOrigin || typeof tag !== 'function') return
  try {
    tag('get', 'G-FPZ7QKTXLJ', 'client_id', id => { if (validClient(id)) { tagClient = id; measurementSession() } })
    tag('get', 'G-FPZ7QKTXLJ', 'session_id', value => {
      if (live(Number(value), nowSeconds())) { tagSession = Number(value); measurementSession() }
    })
  } catch { /* Tags may be unavailable in embedded browsers. */ }
}

function browserClient(now) {
  try {
    const ga = document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)(?:;|$)/)?.[1]
    if (validClient(ga)) return ga
  } catch { /* Cookie access can be blocked. */ }
  let id
  try {
    id = localStorage.getItem(visitorKey) || localStorage.getItem('fl-guide-reading-visitor-v1')
  } catch { /* Use the in-memory session. */ }
  if (!validClient(id)) id = [crypto.getRandomValues(new Uint32Array(1))[0], now].join('.')
  try { localStorage.setItem(visitorKey, id) } catch { /* Storage is optional. */ }
  return id
}

export function measurementSession() {
  if (location.origin !== productionOrigin) return
  const url = new URL(location.href)
  const referrer = globalThis.document?.referrer || ''
  const now = nowSeconds()
  const test = isMeasurementTest(url)
  if (!current) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(measurementSessionKey) || 'null')
      if (validClient(saved?.clientId) && Number.isInteger(saved.sessionId) && live(saved.started ?? saved.sessionId, now)) {
        current = { ...sanitizeAttribution(saved), clientId: saved.clientId, sessionId: saved.sessionId,
          started: saved.started ?? saved.sessionId, announced: saved.announced === true }
      }
    } catch { /* A fresh session also works without storage. */ }
  }
  if (!current || !live(current.started, now)) {
    let arrival = arrivalAttribution(url, referrer)
    if (arrival.source === 'site_guide') {
      try { arrival = attributionFromGuide(sessionStorage, now) ?? arrival } catch { /* Older guide tabs may have no entry. */ }
    }
    current = { ...arrival, clientId: browserClient(now), sessionId: now, started: now, announced: false }
  }
  if (tagClient) current.clientId = tagClient
  if (live(tagSession, now)) current.sessionId = tagSession
  persist()
  return { ...sanitizeAttribution(current), clientId: current.clientId, sessionId: current.sessionId, test }
}

function persist() {
  try { sessionStorage.setItem(measurementSessionKey, JSON.stringify(current)) } catch { /* Keep in memory. */ }
}

export function announceArrival() {
  const session = measurementSession()
  if (!session || current.announced) return
  current.announced = true
  persist()
  sendMeasurement('landing_visit')
  if (session.source === 'threads') sendMeasurement('threads_visit')
}

export function sendMeasurement(event, fields = {}) {
  const session = measurementSession()
  if (!session) return
  const elapsed = pageStart == null ? globalThis.performance?.now() : Date.now() - pageStart
  const engagement = Number.isFinite(elapsed) ? Math.min(1800000, Math.max(1, Math.round(elapsed))) : 1
  const campaign = fields.page_path !== '/you' && (event === 'page_view' || event === 'coupon_view')
    ? Object.fromEntries(safeCampaignQuery(Object.fromEntries(new URL(location.href).searchParams))) : {}
  void fetch('/api/threads-event', {
    method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...session, event, engagement, ...campaign, ...fields }),
  }).catch(() => { /* Never block navigation or a reading on analytics. */ })
}

export function resultPage(path) {
  if (/^\/(?:you(?:\/|$)|(?:r|s|reading)\/[^/]+|couple\/(?!new(?:\/|$))[^/]+)/.test(path)) return '/you'
  const safe = sanitizeLandingPath(path)
  return safe === 'other' ? undefined : safe
}
