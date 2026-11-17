import { attributionFromGuide, attributionLifetime, classifySource, isMeasurementTest, measurementClientIdPattern, measurementSessionKey, sanitizeAttribution, sanitizeLandingPath, type Attribution } from './measurementRules.js'

type MeasurementEvent = 'landing_visit' | 'threads_visit' | 'self_reading_complete' | 'couple_reading_complete' | 'coupon_view' | 'coupon_click' | 'coconala_banner_click'
type Session = Attribution & { clientId: string; sessionId: number; test?: true }

const visitorKey = 'fl-coupon-visitor-v1'
let session: Session | undefined
let couponPageVisible = false

function active(value: Session | undefined, now: number): value is Session {
  return Boolean(value && measurementClientIdPattern.test(value.clientId) &&
    Number.isInteger(value.sessionId) && now >= value.sessionId && now - value.sessionId < attributionLifetime)
}

export function startThreadsMeasurement() {
  if (location.origin !== 'https://fate-lab.com') return
  const now = Math.floor(Date.now() / 1000)
  const url = new URL(location.href)
  const test = isMeasurementTest(url, now)
  if (active(session, now) && (!test || session?.test)) return

  try {
    const saved = JSON.parse(sessionStorage.getItem(measurementSessionKey) ?? 'null') as Session | undefined
    if (active(saved, now) && (!test || saved?.test)) {
      session = { clientId: saved.clientId, sessionId: saved.sessionId, ...sanitizeAttribution(saved),
        test: saved.test === true ? true : undefined }
      return
    }
  } catch { /* Embedded browsers can deny storage. */ }

  const source = classifySource(url, document.referrer)
  let referrerPath: string | undefined
  if (source === 'site_guide') referrerPath = new URL(document.referrer).pathname
  let guideEntry: Attribution | undefined
  if (source === 'site_guide') {
    try { guideEntry = attributionFromGuide(sessionStorage, now) } catch { /* Keep the entry referrer as fallback. */ }
  }
  const attribution = guideEntry ?? sanitizeAttribution({
    source,
    landing_path: sanitizeLandingPath(url.pathname),
    referrer_path: referrerPath,
    campaign_name: url.searchParams.get('utm_source') !== null ? url.searchParams.get('utm_campaign') : undefined,
  })
  const random = crypto.getRandomValues(new Uint32Array(1))[0]
  const sessionClientId = `${random}.${now}`
  const clientId = attribution.source === 'threads' && !test ? couponVisitorId(sessionClientId) : sessionClientId
  session = { clientId, sessionId: now, ...attribution, test: test ? true : undefined }
  try { sessionStorage.setItem(measurementSessionKey, JSON.stringify(session)) } catch { /* Keep the current session in memory. */ }
  trackThreadsEvent('landing_visit')
  if (attribution.source === 'threads') trackThreadsEvent('threads_visit')
}

// StrictMode replays effects on mount. Clear this flag only after leaving the route.
export function trackCouponRoute(isCouponPage: boolean) {
  if (isCouponPage && !couponPageVisible) trackThreadsEvent('coupon_view')
  couponPageVisible = isCouponPage
}

// Count repeat Threads visits from the same browser under one anonymous ID.
function couponVisitorId(fallback: string): string {
  try {
    const saved = localStorage.getItem(visitorKey)
    if (saved && measurementClientIdPattern.test(saved)) return saved
    localStorage.setItem(visitorKey, fallback)
  } catch { /* Use the session ID when persistent storage is unavailable. */ }
  return fallback
}

export function trackThreadsEvent(event: MeasurementEvent, coupon?: { link_type: 'affiliate' | 'official'; offer_id: string }) {
  if (event === 'coupon_view' || event === 'coupon_click') startThreadsMeasurement()
  if (!active(session, Math.floor(Date.now() / 1000))) return
  void fetch('/api/threads-event', {
    method: 'POST',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...session, ...coupon }),
    keepalive: true,
  }).catch(() => { /* Measurement must not interrupt the reading. */ })
}
