import { campaignMedium, couponParameters, sanitizeAttribution } from '../src/web/data/measurementRules.js'

const events = new Set(['landing_visit', 'self_reading_complete', 'threads_visit', 'couple_reading_complete', 'coupon_view', 'coupon_click', 'coconala_banner_click'])
const origin = 'https://fate-lab.com'
const clientIdPattern = /^[0-9]{1,10}\.[0-9]{10}$/

async function sendEvents(endpoint, clientId, events) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(4000),
    body: JSON.stringify({
      client_id: clientId,
      consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
      events,
    }),
  })
  return response.ok
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (req.headers.origin !== origin) return res.status(403).end()

  const { event, clientId, sessionId } = req.body ?? {}
  if (!events.has(event) || typeof clientId !== 'string' ||
      !clientIdPattern.test(clientId) ||
      !Number.isInteger(sessionId) || sessionId < 1700000000 ||
      sessionId > Math.floor(Date.now() / 1000) + 60) return res.status(400).end()

  const attribution = sanitizeAttribution(req.body ?? {})
  const source = attribution.source ?? (req.body?.source === undefined && ['threads_visit', 'couple_reading_complete', 'coupon_click'].includes(event) ? 'threads' : undefined)
  const coupon = event === 'coupon_click' ? couponParameters(req.body ?? {}) : {}
  const couponPage = event === 'coupon_view' || event === 'coupon_click'
  const secret = process.env.GA4_API_SECRET
  if (!secret) return res.status(503).end()

  const endpoint = new URL('https://www.google-analytics.com/mp/collect')
  endpoint.searchParams.set('measurement_id', 'G-FPZ7QKTXLJ')
  endpoint.searchParams.set('api_secret', secret)
  const params = {
    session_id: sessionId,
    engagement_time_msec: 1,
    ...attribution,
    ...coupon,
    page_location: couponPage ? `${origin}/coupons` : undefined,
    source,
    fl_traffic_source: attribution.source ?? (event === 'threads_visit' ? 'threads' : 'unknown'),
    campaign_source: source,
    campaign_medium: campaignMedium(source),
    campaign_name: req.body?.source === undefined && source === 'threads' ? 'fatelab_launch' : attribution.campaign_name,
  }
  const name = event === 'coupon_view' ? 'page_view' : event
  const test = req.body?.test === true
  const reportNames = []
  if (event === 'coupon_view' && attribution.source === 'threads') reportNames.push('threads_coupon_view')
  if (coupon.offer_id === 'coconala-phone' && coupon.link_type === 'affiliate') {
    reportNames.push('coconala_list_click')
    if (attribution.source === 'threads') reportNames.push('threads_coconala_click')
  }

  try {
    // QA events never share names with production metrics.
    const reports = [name, ...reportNames].map(name => ({ name: test ? `qa_${name}` : name, params }))
    const ok = await sendEvents(endpoint, clientId, reports)
    return res.status(ok ? 204 : 502).end()
  } catch {
    return res.status(502).end()
  }
}
