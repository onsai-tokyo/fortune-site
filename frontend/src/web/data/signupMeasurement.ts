import { browserAttributionFields } from './contentAttribution.js'
import { measurementSession } from './browserMeasurement.js'
import { productionOrigin } from './measurementRules.js'

const pending = new Map<string, Promise<void>>()
const checked = new Set<string>()
/** Called for restored sessions AND auth changes, including anonymous -> email upgrades. */
export function checkSignupMeasurement(session: { access_token: string; user: { id: string; is_anonymous?: boolean; email_confirmed_at?: string } } | null): Promise<void> {
  if (location.origin !== productionOrigin || !session || session.user.is_anonymous || !session.user.email_confirmed_at) return Promise.resolve()
  const owner = session.user.id
  if (checked.has(owner)) return Promise.resolve()
  const active = pending.get(owner)
  if (active) return active
  const measurement = measurementSession()
  if (!measurement || measurement.test) return Promise.resolve()
  const fields = browserAttributionFields() // Snapshot before asynchronous auth/receipt work.
  const request = fetch('/api/analytics-signup', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ clientId: measurement.clientId, sessionId: measurement.sessionId, ...fields }) })
    .then(response => { if (response.ok) checked.add(owner) })
    .catch(() => { /* Analytics must not block authentication. */ })
    .finally(() => { pending.delete(owner) })
  pending.set(owner, request)
  return request
}
