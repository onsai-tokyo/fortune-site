import { publicMeasurementPaths } from './publicMeasurementPaths.js'

export const attributionKey = 'fatelab:content-attribution:v1'
export const attributionTtl = 30 * 86400000
const paths = new Set(publicMeasurementPaths.map(p => p.replace(/\/$/, '') || '/'))
const sources = new Set(['threads', 'instagram', 'tiktok', 'x', 'facebook', 'line', 'newsletter'])
const media = new Set(['social', 'paid_social', 'email', 'referral'])
const campaign = /^c(20\d{2})(\d{2})(\d{2})(?:_\d{2})?$/
const post = /^p(20\d{2})(\d{2})(\d{2})_\d{2}$/
function code(value, pattern) {
  if (typeof value !== 'string') return undefined
  const m = value.match(pattern)
  if (!m) return undefined
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`)
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}` ? value : undefined
}
export function publicPage(path) {
  if (typeof path !== 'string') return undefined
  const p = path.replace(/\/$/, '') || '/'
  return paths.has(p) ? p : undefined
}
export function contentId(path) {
  const p = publicPage(path)
  return p && ((/^\/(guides|tools)\/.+/.test(p)) || p.startsWith('/uranai/') || p === '/couple') ? p : undefined
}
export function taggedTouch(params) {
  const source = params.get('utm_source')
  const medium = params.get('utm_medium') ?? (source === 'newsletter' ? 'email' : 'social')
  if (!sources.has(source) || !media.has(medium)) return null
  return { source, medium, campaign: code(params.get('utm_campaign'), campaign), content: code(params.get('utm_content'), post) }
}
function referrerUrl(referrer) {
  try {
    const u = new URL(referrer)
    return u.protocol === 'https:' && !u.username && !u.password && !u.port ? u : null
  } catch { return null }
}
export function incomingTouch(params, referrer) {
  const ref = referrerUrl(referrer)
  if (ref && ['fate-lab.com', 'www.fate-lab.com'].includes(ref.hostname)) return null
  const tagged = taggedTouch(params)
  if (tagged) return tagged
  if ([...params.keys()].some(k => k.toLowerCase().startsWith('utm_'))) return null
  const host = ref?.hostname.replace(/^www\./, '')
  if (['google.com', 'google.co.jp', 'bing.com', 'search.yahoo.co.jp', 'yahoo.co.jp', 'duckduckgo.com'].includes(host)) {
    return { source: host.includes('google') ? 'google' : host.includes('yahoo') ? 'yahoo' : host.includes('bing') ? 'bing' : 'duckduckgo', medium: 'organic' }
  }
  const social = { 'threads.net': 'threads', 'threads.com': 'threads', 'l.threads.com': 'threads', 'l.threads.net': 'threads', 'instagram.com': 'instagram', 'l.instagram.com': 'instagram',
    'tiktok.com': 'tiktok', 'vm.tiktok.com': 'tiktok', 'vt.tiktok.com': 'tiktok', 'x.com': 'x', 't.co': 'x', 'twitter.com': 'x',
    'facebook.com': 'facebook', 'l.facebook.com': 'facebook', 'm.facebook.com': 'facebook', 'lm.facebook.com': 'facebook', 'line.me': 'line' }
  return Object.hasOwn(social, host) ? { source: social[host], medium: 'social' } : null
}
export function sanitizeContentAttribution(input) {
  const allowed = sources.has(input?.acq_source) && media.has(input?.acq_medium)
    || ['google', 'bing', 'yahoo', 'duckduckgo'].includes(input?.acq_source) && input?.acq_medium === 'organic'
    || input?.acq_source === 'direct' && input?.acq_medium === 'none'
    || input?.acq_source === 'unknown' && input?.acq_medium === 'unknown'
  const entry = publicPage(input?.acq_entry_page)
  if (!allowed || !entry) return {}
  return { acq_source: input.acq_source, acq_medium: input.acq_medium,
    acq_campaign: code(input.acq_campaign, campaign) ?? '(none)', acq_content: code(input.acq_content, post) ?? '(none)',
    acq_entry_page: entry, last_content_id: contentId(input.last_content_id) ?? '(none)' }
}
export function readAttribution(storage, now = Date.now()) {
  try {
    const v = JSON.parse(storage.getItem(attributionKey) ?? 'null')
    if (!Number.isFinite(v?.at) || v.at > now || now - v.at >= attributionTtl) { storage.removeItem(attributionKey); return null }
    const fields = sanitizeContentAttribution(v)
    if (!fields.acq_source) { storage.removeItem(attributionKey); return null }
    return { ...fields, at: v.at }
  } catch { return null }
}
export function recordVisit(storage, path, params, referrer, newNavigation, now = Date.now()) {
  const entry = publicPage(path)
  if (!entry) return null // Auth, private reading and result routes never replace acquisition.
  const touch = newNavigation ? incomingTouch(params, referrer) : null
  const previous = readAttribution(storage, now)
  if (touch || !previous) {
    const internal = ['fate-lab.com', 'www.fate-lab.com'].includes(referrerUrl(referrer)?.hostname)
    const fallback = !referrer || internal ? { source: 'direct', medium: 'none' } : { source: 'unknown', medium: 'unknown' }
    const value = touch ?? fallback
    try { storage.setItem(attributionKey, JSON.stringify({ acq_source: value.source, acq_medium: value.medium,
      acq_campaign: value.campaign, acq_content: value.content, acq_entry_page: entry, at: now })) } catch { /* Optional storage. */ }
  }
  return touch
}
export function recordContent(storage, path, now = Date.now()) {
  const id = contentId(path), previous = readAttribution(storage, now)
  if (!id || !previous) return
  try { storage.setItem(attributionKey, JSON.stringify({ ...previous, last_content_id: id })) } catch { /* Optional storage. */ }
}
// Shared on window so separately loaded content/tag modules cannot reset one another.
export function captureBrowserVisit() {
  const w = globalThis.window ?? globalThis
  if (w.flAcquisitionCaptured || !publicPage(location.pathname)) return
  w.flAcquisitionCaptured = true
  const params = new URLSearchParams(location.search)
  if (['code', 'token', 'token_hash', 'access_token', 'refresh_token', 'type'].some(k => params.has(k))
      || /(?:access_token|refresh_token|token_hash|type)=/.test(location.hash)) return
  const navigation = globalThis.performance?.getEntriesByType?.('navigation')[0]
  try { w.flIncomingTouch = recordVisit(localStorage, location.pathname, new URLSearchParams(location.search), document.referrer,
    navigation?.type === 'navigate') } catch { /* Optional storage. */ }
}
export function observeContent(path) {
  captureBrowserVisit()
  try { recordContent(localStorage, path) } catch { /* Optional storage. */ }
}
export function browserAttributionFields() {
  captureBrowserVisit()
  try { const value = readAttribution(localStorage); return value ? sanitizeContentAttribution(value) : {} } catch { return {} }
}
export function landingCampaignFields() {
  captureBrowserVisit()
  const w = globalThis.window ?? globalThis
  if (w.flCampaignSent) return {}
  w.flCampaignSent = true
  const touch = w.flIncomingTouch
  return touch ? { campaign_source: touch.source, campaign_medium: touch.medium,
    ...(touch.campaign && { campaign_name: touch.campaign }), ...(touch.content && { campaign_content: touch.content }) } : {}
}

export function sanitizeLandingCampaign(input) {
  const touch = taggedTouch(new URLSearchParams({ utm_source: input?.campaign_source ?? '', utm_medium: input?.campaign_medium ?? '',
    utm_campaign: input?.campaign_name ?? '', utm_content: input?.campaign_content ?? '' }))
  if (touch) return { campaign_source: touch.source, campaign_medium: touch.medium,
    ...(touch.campaign && { campaign_name: touch.campaign }), ...(touch.content && { campaign_content: touch.content }) }
  return ['google', 'bing', 'yahoo', 'duckduckgo'].includes(input?.campaign_source) && input?.campaign_medium === 'organic'
    ? { campaign_source: input.campaign_source, campaign_medium: 'organic' } : {}
}
