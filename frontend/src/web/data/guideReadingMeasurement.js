import { measurementSession, sendMeasurement } from './browserMeasurement.js'
import { attributionLifetime, measurementClientIdPattern, productionOrigin, sanitizeLandingPath } from './measurementRules.js'

export const guideReadingEvents = {
  start: 'guide_reading_start',
  result: 'guide_reading_result',
  banner: 'guide_reading_coconala_click',
}

const journeyKey = 'fl-guide-reading-v1'
const coupleKey = 'fl-guide-couple-v1'

export function guideReadingPath(path) {
  const safe = sanitizeLandingPath(path)
  return safe.startsWith('/guides/') ? safe : undefined
}

function readJourney(key = journeyKey) {
  if (location.origin !== productionOrigin) return null
  const journey = JSON.parse(sessionStorage.getItem(key) ?? 'null')
  const age = Date.now() - journey?.startedAt
  if (!(age >= 0 && age < attributionLifetime * 1000) || !guideReadingPath(journey.guidePath)) return null
  if (key === journeyKey && (!measurementClientIdPattern.test(journey.clientId) || !Number.isInteger(journey.sessionId)
    || (journey.flow_id !== undefined && !/^[0-9a-f]{16}$/.test(journey.flow_id)))) return null
  return journey
}

function journeyFields(journey) {
  const { guidePath, flow_id, clientId, sessionId } = journey
  return { guidePath, flow_id, clientId, sessionId, reading_type: 'self' }
}

export function startGuideReading() {
  try {
    const session = measurementSession()
    const guidePath = guideReadingPath(location.pathname)
    if (!session || !guidePath) return
    const journey = { startedAt: Date.now(), guidePath, sessionId: session.sessionId, clientId: session.clientId,
      flow_id: crypto.randomUUID().replaceAll('-', '').slice(0, 16), stage: 'started' }
    sessionStorage.setItem(journeyKey, JSON.stringify(journey))
    sendMeasurement(guideReadingEvents.start, journeyFields(journey))
  } catch { /* Ignore unavailable storage. */ }
}

export function startGuideCouple() {
  const guidePath = guideReadingPath(location.pathname)
  if (location.origin !== productionOrigin || !guidePath) return
  try { sessionStorage.setItem(coupleKey, JSON.stringify({ startedAt: Date.now(), guidePath })) } catch { /* Still count the click. */ }
  sendMeasurement('guide_to_couple', { guidePath, reading_type: 'couple' })
}

export function articleOrigin(kind) {
  try {
    if (!kind) {
      const self = readJourney()
      const couple = readJourney(coupleKey)
      if (self && (!couple || self.startedAt >= couple.startedAt)) return journeyFields(self)
      return couple ? { guidePath: couple.guidePath, reading_type: 'couple' } : {}
    }
    const journey = readJourney(kind === 'couple' ? coupleKey : journeyKey)
    if (kind === 'couple' && journey) return { guidePath: journey.guidePath }
    if (journey && kind === 'self') return journeyFields(journey)
  } catch { /* Storage is optional. */ }
  return {}
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
    sendMeasurement(guideReadingEvents.result, journeyFields(journey))
  } catch { /* Ignore unavailable or invalid storage. */ }
}

export function recordGuideReadingBanner(path) {
  if (!/^\/you(?:\/(?:chapters|years)\/[^/]+)?\/?$/i.test(path)) return
  try {
    const journey = readJourney()
    if (journey?.stage !== 'result') return
    sessionStorage.setItem(journeyKey, JSON.stringify({ ...journey, stage: 'banner' }))
    sendMeasurement(guideReadingEvents.banner, { ...journeyFields(journey), cta_position: path.startsWith('/you/years/') ? 'year_result' : 'self_result' })
  } catch { /* Ignore unavailable or invalid storage. */ }
}
