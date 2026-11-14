const social = new Set(['threads', 'tiktok', 'instagram', 'x'])
const paths = new Set(['/', '/welcome', '/couple', '/coupons', '/threads-launch', '/you'])
const sources = new Set([...social, 'other_campaign', 'organic_search', 'site_guide', 'direct'])
const offers = new Set(['coconala-phone', 'spacia-phone', 'miror-phone', 'miror-chat', 'brillante-chat', 'destiny-phone'])
const guide = /^\/(guides|tools)\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/
const campaign = /^[a-zA-Z0-9_-]{1,40}$/
const search = /(?:^|\.)(?:google\.(?:com|co\.jp|[a-z]{2}|(?:co|com)\.[a-z]{2})|bing\.com|yahoo\.(?:com|co\.jp)|duckduckgo\.com)$/

export function sanitizeLandingPath(path) {
  return paths.has(path) ? path : 'other'
}

export function classifySource(url, referrer) {
  const utm = url.searchParams.get('utm_source')
  if (url.pathname === '/threads-launch') return 'threads'
  if (utm !== null) return social.has(utm) ? utm : 'other_campaign'
  try {
    const incoming = new URL(referrer)
    if (search.test(incoming.hostname)) return 'organic_search'
    if (incoming.origin === 'https://fate-lab.com' && /^\/(guides|tools)(?:\/|$)/.test(incoming.pathname)) return 'site_guide'
  } catch { /* Direct visits can have an empty referrer. */ }
  return 'direct'
}

export function sanitizeAttribution(input) {
  const source = sources.has(input.source) ? input.source : undefined
  const landing_path = paths.has(input.landing_path) || input.landing_path === 'other' ? input.landing_path : undefined
  const referrer_path = source === 'site_guide' && typeof input.referrer_path === 'string' &&
    input.referrer_path.length <= 100 && guide.test(input.referrer_path) ? input.referrer_path : undefined
  const campaign_name = typeof input.campaign_name === 'string' && campaign.test(input.campaign_name)
    ? input.campaign_name : '(not set)'
  return { source, landing_path, referrer_path, campaign_name }
}

export function couponParameters(input) {
  return {
    link_type: input.link_type === 'affiliate' || input.link_type === 'official' ? input.link_type : undefined,
    offer_id: offers.has(input.offer_id) ? input.offer_id : undefined,
  }
}

export function campaignMedium(source) {
  return social.has(source) ? 'social' : ({
    organic_search: 'organic', site_guide: 'internal', other_campaign: 'campaign', direct: 'none',
  })[source]
}
