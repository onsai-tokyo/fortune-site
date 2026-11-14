type CampaignEvent = 'threads_visit' | 'couple_reading_complete' | 'coupon_click'

const campaignKey = 'fl-threads-measurement-v2'
let session: { clientId: string; sessionId: number } | undefined

export function startThreadsMeasurement() {
  if (location.origin !== 'https://fate-lab.com') return
  const params = new URLSearchParams(location.search)
  const landing = location.pathname === '/threads-launch' || (location.pathname === '/couple' &&
    params.get('utm_source') === 'threads' &&
    params.get('utm_medium') === 'social' &&
    params.get('utm_campaign') === 'fatelab_launch')

  try {
    const saved = sessionStorage.getItem(campaignKey)
    if (saved) session = JSON.parse(saved)
  } catch { /* Storage can be unavailable in embedded browsers. */ }

  const now = Math.floor(Date.now() / 1000)
  if (session && now - session.sessionId < 1800) return
  session = undefined
  if (!landing) return

  const random = crypto.getRandomValues(new Uint32Array(1))[0]
  session = { clientId: `${random}.${now}`, sessionId: now }
  try { sessionStorage.setItem(campaignKey, JSON.stringify(session)) } catch { /* In-memory attribution still works. */ }
  trackThreadsEvent('threads_visit')
}

export function trackThreadsEvent(event: CampaignEvent) {
  if (!session || Date.now() / 1000 - session.sessionId >= 1800) return
  void fetch('/api/threads-event', {
    method: 'POST',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...session }),
    keepalive: true,
  }).catch(() => { /* Measurement must not interrupt the reading. */ })
}
