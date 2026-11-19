import { campaignMedium, couponParameters, measurementClientIdPattern, safeCampaignQuery, sanitizeAttribution, sanitizeLandingPath } from '../src/web/data/measurementRules.js'
import { guideReadingEvents, guideReadingPath } from '../src/web/data/guideReadingMeasurement.js'

const events = new Set(['page_view', 'guide_to_couple', 'guide_to_fortune', 'guide_to_coupons', 'guide_to_tool', 'related_guide_click', 'affiliate_click', 'seo_tool_complete', 'landing_visit', 'self_reading_complete', 'threads_visit', 'couple_reading_complete', 'coupon_view', 'coupon_click', 'coconala_banner_click'])
const guideEvents = new Set(Object.values(guideReadingEvents))
const positions = new Set(['self_result', 'couple_result', 'year_result', 'guide_footer', 'coupons_list', 'consult_page'])
const toolNames = new Set(['angel_number_lookup', 'shichu_timing', 'sanmeigaku_calculator', 'shichu_suimei_calculator', 'life_path_number', 'day_master'])
const linkEvents = new Set(['guide_to_fortune', 'guide_to_coupons', 'guide_to_tool', 'related_guide_click'])
const origin = 'https://fate-lab.com'

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
  if (req.headers.origin !== origin || (req.headers.host && req.headers.host !== 'fate-lab.com')) return res.status(403).end()

  const { event, clientId, sessionId } = req.body ?? {}
  const guideEvent = guideEvents.has(event)
  if ((!events.has(event) && !guideEvent) || typeof clientId !== 'string' ||
      !measurementClientIdPattern.test(clientId) ||
      !Number.isInteger(sessionId) || sessionId < 1700000000 ||
      sessionId > Math.floor(Date.now() / 1000) + 60) return res.status(400).end()

  const test = req.body?.test === true
  const guidePath = guideReadingPath(req.body.guidePath)
  if ((guideEvent || event === 'guide_to_couple') && !guidePath) return res.status(400).end()
  const page = sanitizeLandingPath(req.body.page_path)
  if (event === 'page_view' && page === 'other') return res.status(400).end()
  const target = sanitizeLandingPath(req.body.link_path)
  const position = positions.has(req.body.cta_position) ? req.body.cta_position : undefined
  const isBanner = event === 'coconala_banner_click' || event === guideReadingEvents.banner
  const isSelf = guideEvent || event === 'self_reading_complete'
  const isCouple = event === 'guide_to_couple' || event === 'couple_reading_complete'
  const reading = isSelf ? 'self' : isCouple ? 'couple' : isBanner && ['couple', 'self'].includes(req.body.reading_type) ? req.body.reading_type : undefined
  const flow = reading === 'self' && guidePath && /^[0-9a-f]{16}$/.test(req.body.flow_id ?? '') ? req.body.flow_id : undefined

  const attribution = sanitizeAttribution(req.body ?? {})
  const source = attribution.source ?? (req.body?.source === undefined && ['threads_visit', 'couple_reading_complete', 'coupon_click'].includes(event) ? 'threads' : undefined)
  const coupon = event === 'coupon_click' ? couponParameters(req.body ?? {}) : {}
  const couponPage = event === 'coupon_view' || event === 'coupon_click'
  const secret = process.env.GA4_API_SECRET
  if (!secret) return res.status(503).end()

  const endpoint = new URL('https://www.google-analytics.com/mp/collect')
  endpoint.searchParams.set('measurement_id', 'G-FPZ7QKTXLJ')
  endpoint.searchParams.set('api_secret', secret)
  const path = couponPage ? '/coupons' : (guideEvent || event === 'guide_to_couple') ? guidePath : page
  const query = path !== '/you' && ['page_view', 'coupon_view'].includes(event) ? safeCampaignQuery(req.body).toString() : ''
  const params = {
    session_id: sessionId,
    engagement_time_msec: Number.isInteger(req.body.engagement) ? Math.max(1, Math.min(1800000, req.body.engagement)) : 1,
    traffic_type: test ? 'internal' : undefined,
    guide_path: (reading || isBanner) ? guidePath : undefined,
    flow_id: flow, reading_type: reading,
    cta_position: coupon.offer_id === 'coconala-phone' ? 'coupons_list' : isBanner ? position : undefined,
    tool_name: event === 'seo_tool_complete' && toolNames.has(req.body.tool_name) ? req.body.tool_name : undefined,
    placement: event === 'affiliate_click' ? 'seo_page' : undefined,
    link_url: linkEvents.has(event) && target !== 'other' ? origin + target : undefined,
    tool_path: event === 'guide_to_tool' && target.startsWith('/tools/') ? target : undefined,
    ...attribution,
    ...coupon,
    page_location: path && path !== 'other' ? origin + path + (query ? '?' + query : '') : undefined,
    fl_landing_path: attribution.landing_path ?? 'other',
    source,
    fl_traffic_source: attribution.source ?? (event === 'threads_visit' ? 'threads' : 'unknown'),
    campaign_source: source,
    campaign_medium: campaignMedium(source),
    campaign_name: req.body?.source === undefined && source === 'threads' ? 'fatelab_launch' : attribution.campaign_name,
  }
  const name = event === 'coupon_view' ? 'page_view' : event
  const reportNames = []
  if (event === 'coupon_view' && attribution.source === 'threads') reportNames.push('threads_coupon_view')
  if (coupon.offer_id === 'coconala-phone' && coupon.link_type === 'affiliate') {
    reportNames.push('coconala_list_click')
    if (attribution.source === 'threads') reportNames.push('threads_coconala_click')
  }

  try {
    // QA events never share names with production metrics.
    const reports = [name, ...reportNames].map(name => ({ name: test ? 'qa_' + name : name, params }))
    const ok = await sendEvents(endpoint, clientId, reports)
    return res.status(ok ? 204 : 502).end()
  } catch {
    return res.status(502).end()
  }
}
