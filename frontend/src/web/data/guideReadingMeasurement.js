import { attributionLifetime, isMeasurementTest, measurementClientIdPattern } from './measurementRules.js'

export const guideReadingEvents = {
  start: 'guide_reading_start',
  result: 'guide_reading_result',
  banner: 'guide_reading_coconala_click',
}

const origin = 'https://fate-lab.com'
const journeyKey = 'fl-guide-reading-v1'
const visitorKey = 'fl-guide-reading-visitor-v1'

export function guideReadingPath(path) {
  if (typeof path !== 'string' || path.length > 100) return undefined
  const canonical = path.replace(/\/$/, '')
  return /^\/guides\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(canonical) ? canonical : undefined
}

function visitorId(analyticsClientId, sessionId) {
  if (typeof analyticsClientId === 'string' && measurementClientIdPattern.test(analyticsClientId)) return analyticsClientId
  const generated = `${crypto.getRandomValues(new Uint32Array(1))[0]}.${sessionId}`
  try {
    const saved = localStorage.getItem(visitorKey)
    if (saved && measurementClientIdPattern.test(saved)) return saved
    localStorage.setItem(visitorKey, generated)
  } catch { /* The generated ID still links the three events in this tab. */ }
  return generated
}

function readJourney() {
  if (location.origin !== origin || isMeasurementTest(new URL(location.href))) return null
  const journey = JSON.parse(sessionStorage.getItem(journeyKey) ?? 'null')
  const age = Date.now() - journey?.startedAt
  return age >= 0 && age < attributionLifetime * 1000 ? journey : null
}

function sendGuideEvent(event, { guidePath, clientId, sessionId }) {
  void fetch('/api/threads-event', {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, guidePath, clientId, sessionId }),
    keepalive: true,
  }).catch(() => { /* A measurement failure must not interrupt the reading. */ })
}

export function startGuideReading(analyticsClientId) {
  try {
    const url = new URL(location.href)
    if (url.origin !== origin) return
    sessionStorage.removeItem(journeyKey)
    if (isMeasurementTest(url)) return
    const guidePath = guideReadingPath(url.pathname)
    if (!guidePath) return
    const startedAt = Date.now()
    const sessionId = Math.floor(startedAt / 1000)
    const journey = { startedAt, guidePath, sessionId, clientId: visitorId(analyticsClientId, sessionId), stage: 'started' }
    sessionStorage.setItem(journeyKey, JSON.stringify(journey))
    sendGuideEvent(guideReadingEvents.start, journey)
  } catch { /* Reading still works when analytics is unavailable. */ }
}

export function pendingGuideReading() {
  try {
    const journey = readJourney()
    if (journey?.stage === 'started') return journey.startedAt
  } catch { /* Ignore unavailable or invalid storage. */ }
}

export function clearCompletedGuideReading() {
  try {
    const journey = readJourney()
    if (journey?.stage === 'result' || journey?.stage === 'banner') sessionStorage.removeItem(journeyKey)
  } catch { /* Ignore unavailable or invalid storage. */ }
}

export function recordGuideReadingResult(startedAt) {
  if (!Number.isInteger(startedAt)) return
  try {
    const journey = readJourney()
    if (journey?.stage !== 'started' || journey.startedAt !== startedAt) return
    sessionStorage.setItem(journeyKey, JSON.stringify({ ...journey, stage: 'result' }))
    sendGuideEvent(guideReadingEvents.result, journey)
  } catch { /* Ignore unavailable or invalid storage. */ }
}

export function recordGuideReadingBanner(path) {
  if (!/^\/you(?:\/(?:chapters|years)\/[^/]+)?\/?$/i.test(path)) return
  try {
    const journey = readJourney()
    if (journey?.stage !== 'result') return
    sessionStorage.setItem(journeyKey, JSON.stringify({ ...journey, stage: 'banner' }))
    sendGuideEvent(guideReadingEvents.banner, journey)
  } catch { /* Ignore unavailable or invalid storage. */ }
}
