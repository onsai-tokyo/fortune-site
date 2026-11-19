import { publicMeasurementPaths } from './publicMeasurementPaths.js'

const social = new Set(['threads', 'tiktok', 'instagram', 'x'])
export const productionOrigin = 'https://fate-lab.com'
function groupForPublicPath(path) {
  if (path === '/' || path === '/threads-launch') return 'top'
  if (path === '/couple') return 'couple'
  if (/^\/tools(?:\/|$)/.test(path)) return 'tool'
  if (path.startsWith('/uranai/')) return 'uranai'
  if (/^\/guides\/\d{4}-fortune(?:\/|$)/.test(path)) return 'fortune'
  if (/^\/guides\/(?:day-master|ten-god|twelve-stage)\//.test(path)) return 'series'
  if (/^\/guides(?:\/|$)/.test(path)) return 'guide'
  return 'other'
}

export function landingGroupsFor(publicPaths) {
  const groups = new Map()
  for (const path of publicPaths) {
    const canonical = path.replace(/\/$/, '') || '/'
    groups.set(canonical, groupForPublicPath(canonical))
  }
  return groups
}

const paths = landingGroupsFor([...publicMeasurementPaths, '/welcome', '/you'])
const sources = new Set([...social, 'other_campaign', 'organic_search', 'site_guide', 'direct'])
const offers = new Set(['coconala-phone', 'spacia-phone', 'miror-phone', 'miror-chat', 'brillante-chat', 'destiny-phone'])
const engines = new Set(['google', 'bing', 'yahoo', 'other'])
// Campaign parameters are user-controlled. Only published labels cross the analytics boundary.
const campaigns = new Set(['fatelab_launch', 'seo_share', 'openai'])
const media = new Set(['social', 'organic', 'referral', 'profile', 'bio', 'link', 'campaign'])
export function safeCampaignQuery(input) {
  const result = new URLSearchParams()
  if (social.has(input.utm_source) || input.utm_source === 'openai') result.set('utm_source', input.utm_source)
  if (media.has(input.utm_medium)) result.set('utm_medium', input.utm_medium)
  if (campaigns.has(input.utm_campaign)) result.set('utm_campaign', input.utm_campaign)
  return result
}
const search = /(?:^|\.)(?:google\.(?:com|co\.jp|[a-z]{2}|(?:co|com)\.[a-z]{2})|bing\.com|yahoo\.(?:com|co\.jp)|duckduckgo\.com)$/

export function sanitizeLandingPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return 'other'
  const canonical = path.replace(/\/$/, '') || '/'
  return paths.has(canonical) ? canonical : 'other'
}

export function classifySource(url, referrer) {
  const utm = url.searchParams.get('utm_source')?.trim().toLowerCase()
  if (url.pathname === '/threads-launch') return 'threads'
  if (utm !== undefined) return social.has(utm) ? utm : 'other_campaign'
  try {
    const incoming = new URL(referrer)
    if (/(?:^|\.)threads\.(?:com|net)$/.test(incoming.hostname)) return 'threads'
    if (search.test(incoming.hostname)) return 'organic_search'
    if (incoming.origin === 'https://fate-lab.com' && /^\/(guides|tools)(?:\/|$)/.test(incoming.pathname)) return 'site_guide'
  } catch { /* Direct visits can have an empty referrer. */ }
  return 'direct'
}

const guideEntryKey = 'fl-guide-entry-v1'
export const attributionLifetime = 1800
export const measurementSessionKey = 'fl-site-measurement-v1'
export const measurementClientIdPattern = /^[0-9]{1,10}\.[0-9]{10}$/
const testKey = 'fl-internal-traffic-v1'
let memoryTest = false
let lastFlagUrl

export function isMeasurementTest(url, now = Math.floor(Date.now() / 1000)) {
  const flag = url.searchParams.get('fl_test')
  // Consume a URL switch once per navigation so an older tab respects a newer switch.
  const changed = lastFlagUrl !== url.href
  lastFlagUrl = url.href
  if (changed && (flag === '1' || flag === '0')) {
    memoryTest = flag === '1'
    try { localStorage.setItem(testKey, flag) } catch { /* This document still honors the switch. */ }
  } else {
    try {
      const saved = localStorage.getItem(testKey)
      if (saved !== null) memoryTest = saved === '1'
      else {
        const prior = JSON.parse(sessionStorage.getItem(measurementSessionKey) || 'null')
        const marked = Math.max(Number(sessionStorage.getItem('fl-measurement-test-at')), prior?.test ? prior.sessionId : 0)
        memoryTest = marked > 0 && now >= marked && now - marked < attributionLifetime
        if (memoryTest) localStorage.setItem(testKey, '1')
      }
    } catch { /* Use in-memory state. */ }
  }
  return memoryTest
}

export function arrivalAttribution(url, referrer) {
  const source = classifySource(url, referrer)
  const hostname = source === 'organic_search' ? new URL(referrer).hostname : ''
  const engine = hostname.split('.').find(part => ['google', 'yahoo', 'bing'].includes(part))
  const campaignSource = url.searchParams.get('utm_source')
  return sanitizeAttribution({
    source, landing_path: sanitizeLandingPath(url.pathname),
    fl_search_engine: hostname ? engine ?? 'other' : undefined,
    referrer_path: source === 'site_guide' ? new URL(referrer).pathname : undefined,
    campaign_name: campaignSource === 'openai' ? 'openai' : campaignSource ? url.searchParams.get('utm_campaign') : undefined,
  })
}

function readGuideEntry(storage, now) {
  const entry = JSON.parse(storage.getItem(guideEntryKey) ?? 'null')
  if (!entry || !sources.has(entry.source) || !Number.isInteger(entry.time) ||
      now < entry.time || now - entry.time >= attributionLifetime) return undefined
  return sanitizeAttribution(entry)
}

export function rememberGuideEntry(url, referrer, storage, now) {
  const source = classifySource(url, referrer)
  if (source === 'site_guide') {
    if (readGuideEntry(storage, now)) return
  } else if (source === 'direct') {
    // Navigating between same-site pages should not reset the original landing.
    if (referrer && new URL(referrer).origin === url.origin && readGuideEntry(storage, now)) return
  }
  const attribution = arrivalAttribution(url, referrer)
  storage.setItem(guideEntryKey, JSON.stringify({ ...attribution, time: now }))
}

export function attributionFromGuide(storage, now) {
  return readGuideEntry(storage, now)
}

export function sanitizeAttribution(input) {
  const source = sources.has(input.source) ? input.source : undefined
  const landing = sanitizeLandingPath(input.landing_path)
  const landing_path = landing !== 'other' || input.landing_path === 'other' ? landing : undefined
  const referrer = sanitizeLandingPath(input.referrer_path)
  const referrer_path = source === 'site_guide' && /^\/(guides|tools)\//.test(referrer) ? referrer : undefined
  const fl_search_engine = source === 'organic_search' && engines.has(input.fl_search_engine) ? input.fl_search_engine : undefined
  const campaign_name = campaigns.has(input.campaign_name)
    ? input.campaign_name : '(not set)'
  const fl_landing_group = paths.get(landing) ?? 'other'
  return { source, landing_path, fl_landing_group, referrer_path, campaign_name, ...(fl_search_engine && { fl_search_engine }) }
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
