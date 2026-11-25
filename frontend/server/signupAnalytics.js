import { measurementClientIdPattern } from '../src/web/data/measurementRules.js'
import { sanitizeContentAttribution } from '../src/web/data/contentAttribution.js'

export const measurementId = 'G-FPZ7QKTXLJ'
export function signupPayload(body, now = Date.now()) {
  if (!measurementClientIdPattern.test(body?.clientId ?? '') || !Number.isInteger(body?.sessionId)
      || body.sessionId < 1700000000 || body.sessionId > Math.floor(now / 1000) + 60) return null
  return { client_id: body.clientId, consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
    events: [{ name: 'sign_up', params: { session_id: body.sessionId, engagement_time_msec: 1,
      page_location: 'https://fate-lab.com/', page_title: 'Fate Lab', page_referrer: '',
      ...sanitizeContentAttribution(body) } }] }
}

/** Validate with Auth, then claim atomically in Postgres. Caller supplies no account ID. */
export async function claimSignup({ token, url, anonKey, fetcher = fetch }) {
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` }
  const response = await fetcher(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(4000) })
  if (response.status === 401 || response.status === 403) return false
  if (!response.ok) throw new Error('AUTH_UNAVAILABLE')
  const user = await response.json()
  if (!user?.id || user.is_anonymous === true || !user.email_confirmed_at) return false
  const claim = await fetcher(`${url}/rest/v1/rpc/claim_signup_analytics`, { method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(4000) })
  if (!claim.ok) throw new Error('RECEIPT_UNAVAILABLE')
  return await claim.json() === true
}
