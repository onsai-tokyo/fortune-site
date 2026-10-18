export interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string
    appearance: 'interaction-only'
    callback: (token: string) => void
    'error-callback': () => void
    'expired-callback': () => void
    'timeout-callback': () => void
  }): string
  remove(widget: string): void
}

declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<TurnstileApi> | undefined
const message = '人間確認が完了しませんでした。通信を確かめて、もう一度お試しください。'

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => {
      clearTimeout(timer)
      script.remove()
      loading = undefined
      reject(new Error(message))
    }
    const timer = window.setTimeout(fail, 15_000)
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => {
      clearTimeout(timer)
      if (window.turnstile) resolve(window.turnstile)
      else fail()
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return loading
}

/** A new widget produces a fresh, single-use token for each authentication attempt. */
export function challengeToken(api: TurnstileApi, container: HTMLElement, sitekey: string, timeoutMs = 90_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let widget: string | undefined
    let settled = false
    const finish = (token?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (widget !== undefined) api.remove(widget)
      container.remove()
      if (token) resolve(token)
      else reject(new Error(message))
    }
    const timer = setTimeout(() => finish(), timeoutMs)
    try {
      widget = api.render(container, {
        sitekey, appearance: 'interaction-only', callback: token => finish(token),
        'error-callback': () => finish(), 'expired-callback': () => finish(), 'timeout-callback': () => finish(),
      })
      if (settled) api.remove(widget)
    } catch { finish() }
  })
}

export async function requestCaptchaToken(sitekey?: string): Promise<string | undefined> {
  if (!sitekey) return undefined
  const api = await loadTurnstile()
  const container = document.createElement('div')
  container.setAttribute('aria-label', '人間確認')
  Object.assign(container.style, { position: 'fixed', bottom: '16px', right: '16px', zIndex: '10000', maxWidth: '100vw' })
  document.body.appendChild(container)
  return challengeToken(api, container, sitekey)
}
