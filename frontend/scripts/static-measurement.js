import { browserAttributionFields, observeContent, landingCampaignFields } from './contentAttribution.js'
import { announceArrival, measurementSession, readTagIdentity, sendMeasurement } from './browserMeasurement.js'
import { classifySource, isMeasurementTest, productionOrigin, sanitizeLandingPath } from './measurementRules.js'
import { guideReadingPath, startGuideCouple } from './guideReadingMeasurement.js'

const tagId = 'G-FPZ7QKTXLJ'

function staticPageView(path, session) {
  const campaign = landingCampaignFields()
  if (session.test) {
    announceArrival()
    sendMeasurement('page_view', { page_path: path, ...campaign })
    return
  }
  // Keep the browser tag's native session/first-visit attribution. Its document
  // contains no form, outgoing links, private referrer, or browser history.
  const frame = document.createElement('iframe')
  frame.hidden = true
  frame.title = 'Analytics'
  frame.referrerPolicy = 'no-referrer'
  frame.src = '/assets/fl-measurement-frame.html'
  let recorded = false
  function fallback() {
    if (recorded) return
    recorded = true
    sendMeasurement('page_view', { page_path: path, ...campaign })
    announceArrival()
  }
  frame.onerror = fallback
  window.addEventListener('pagehide', fallback, { once: true })
  frame.onload = () => {
    const context = frame.contentWindow
    if (!context || recorded) return
    context.dataLayer = []
    const tag = function () { context.dataLayer.push(arguments) }
    const referrer = document.referrer ? new URL(document.referrer) : null
    const searchReferrer = session.source === 'organic_search' && referrer && classifySource(new URL(location.origin), referrer.href) === 'organic_search'
    const params = {
      send_page_view: false, page_location: productionOrigin + path, page_title: 'Fate Lab',
      page_referrer: searchReferrer ? referrer.origin + '/' : '',
      fl_traffic_source: session.source, fl_landing_path: session.landing_path, fl_landing_group: session.fl_landing_group,
      fl_search_engine: session.fl_search_engine, allow_google_signals: false, allow_ad_personalization_signals: false,
      client_id: session.clientId, ...browserAttributionFields(), ...campaign,
    }
    window.addEventListener('storage', () => {
      context['ga-disable-' + tagId] = isMeasurementTest(new URL(location.href))
    })
    const script = context.document.createElement('script')
    script.async = true
    script.referrerPolicy = 'no-referrer'
    script.onerror = fallback
    script.onload = () => {
      if (recorded) return
      if (isMeasurementTest(new URL(location.href))) return fallback()
      recorded = true
      tag('js', new Date())
      tag('config', tagId, params)
      tag('event', 'page_view', { engagement_time_msec: Math.max(1, Math.min(1800000, Math.round(performance.now()))) })
      readTagIdentity(tag)
      tag('get', tagId, 'session_id', announceArrival)
      setTimeout(announceArrival, 1000)
    }
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + tagId
    context.document.head.append(script)
  }
  document.body.append(frame)
}

function install() {
  if (location.origin !== productionOrigin) return
  observeContent(location.pathname)
  const session = measurementSession()
  const path = sanitizeLandingPath(location.pathname)
  if (!session || path === 'other') return
  staticPageView(path, session)
  window.flToolComplete = tool_name => sendMeasurement('seo_tool_complete', { tool_name, page_path: path })
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]')
    if (!link) return
    const target = link.origin === productionOrigin ? sanitizeLandingPath(link.pathname) : 'other'
    const fields = { page_path: path }
    if (target !== 'other') fields.link_path = target
    if (link.closest('.fl-coconala-banner')) {
      fields.guidePath = guideReadingPath(path)
      if (link.closest('article, footer') && fields.guidePath) fields.cta_position = 'guide_footer'
      sendMeasurement('coconala_banner_click', fields)
    } else if (link.closest('article') && target === '/couple' && guideReadingPath(path)) {
      startGuideCouple()
    } else if (link.matches('.affiliate-link')) sendMeasurement('affiliate_click', fields)
    else if (link.matches('.cta')) sendMeasurement('guide_to_fortune', fields)
    else if (link.hasAttribute('data-guide-coupon')) sendMeasurement('guide_to_coupons', fields)
    else if (link.closest('article') && target.startsWith('/tools/')) sendMeasurement('guide_to_tool', fields)
    else if (link.closest('.related')) sendMeasurement('related_guide_click', fields)
  })
}

install()
