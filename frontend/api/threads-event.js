import { campaignMedium, couponParameters, sanitizeAttribution } from '../src/web/data/measurementRules.js'

const events = new Set(['landing_visit', 'self_reading_complete', 'threads_visit', 'couple_reading_complete', 'coupon_click'])
const origin = 'https://fate-lab.com'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (req.headers.origin !== origin) return res.status(403).end()

  const { event, clientId, sessionId } = req.body ?? {}
  if (!events.has(event) || typeof clientId !== 'string' ||
      !/^[0-9]{1,10}\.[0-9]{10}$/.test(clientId) ||
      !Number.isInteger(sessionId) || sessionId < 1700000000 ||
      sessionId > Math.floor(Date.now() / 1000) + 60) return res.status(400).end()

  const attribution = sanitizeAttribution(req.body ?? {})
  const source = attribution.source ?? (req.body?.source === undefined && !['landing_visit', 'self_reading_complete'].includes(event) ? 'threads' : undefined)
  const coupon = event === 'coupon_click' ? couponParameters(req.body ?? {}) : {}
  const secret = process.env.GA4_API_SECRET
  if (!secret) return res.status(503).end()

  const endpoint = new URL('https://www.google-analytics.com/mp/collect')
  endpoint.searchParams.set('measurement_id', 'G-FPZ7QKTXLJ')
  endpoint.searchParams.set('api_secret', secret)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        client_id: clientId,
        consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
        events: [{ name: event, params: {
          session_id: sessionId,
          engagement_time_msec: 1,
          ...attribution,
          ...coupon,
          source,
          campaign_source: source,
          campaign_medium: campaignMedium(source),
          campaign_name: req.body?.source === undefined && source === 'threads' ? 'fatelab_launch' : attribution.campaign_name,
        } }],
      }),
    })
    return res.status(response.ok ? 204 : 502).end()
  } catch {
    return res.status(502).end()
  }
}
