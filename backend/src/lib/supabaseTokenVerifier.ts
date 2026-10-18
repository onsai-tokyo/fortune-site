import { createPublicKey, type JsonWebKey } from 'node:crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'

export type Verification =
  | { status: 'valid'; payload: JwtPayload }
  | { status: 'invalid' }
  | { status: 'unavailable' }
type Key = ReturnType<typeof createPublicKey>
type Cache = { keys: Map<string, Key>; expires: number }

/** One issuer per verifier; negative lookup cooldown is issuer-wide, never per attacker kid. */
export function createSupabaseTokenVerifier(options: {
  fetch?: typeof fetch; now?: () => number; ttlMs?: number; cooldownMs?: number
} = {}) {
  const states = new Map<string, {
    cache?: Cache; flight?: Promise<Cache>; retryAt: number; failed: boolean
  }>()
  const now = options.now ?? Date.now
  const cooldown = options.cooldownMs ?? 30_000
  async function keyFor(issuer: string, kid: string): Promise<Key | undefined> {
    let state = states.get(issuer)
    if (!state) { state = { retryAt: 0, failed: false }; states.set(issuer, state) }
    const cached = state.cache
    if (cached && cached.expires > now() && cached.keys.has(kid)) return cached.keys.get(kid)
    if (!state.flight) {
      if (now() < state.retryAt) {
        if (state.failed) throw new Error('JWKS unavailable')
        return undefined
      }
      const hadCache = Boolean(cached)
      state.retryAt = now() + cooldown
      const target = state
      target.flight = (async () => {
        try {
          const response = await (options.fetch ?? globalThis.fetch)(`${issuer}/.well-known/jwks.json`, {
            headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5_000),
          })
          if (!response.ok) throw new Error('JWKS unavailable')
          const body = await response.json() as { keys?: (JsonWebKey & { kid?: string; alg?: string; use?: string })[] }
          if (!Array.isArray(body.keys)) throw new Error('Malformed JWKS')
          const keys = new Map<string, Key>()
          for (const key of body.keys) {
            if (key.kty !== 'EC' || key.crv !== 'P-256' || (key.alg && key.alg !== 'ES256') || (key.use && key.use !== 'sig')) continue
            if (typeof key.kid !== 'string' || !key.kid || keys.has(key.kid)) throw new Error('Malformed JWKS')
            keys.set(key.kid, createPublicKey({ key, format: 'jwk' }))
          }
          target.cache = { keys, expires: now() + (options.ttlMs ?? 3_600_000) }
          target.failed = false
          // A first successful load still allows one immediate rotation refresh.
          if (!hadCache) target.retryAt = 0
          return target.cache
        } catch {
          target.failed = true
          target.retryAt = now() + cooldown
          throw new Error('JWKS unavailable')
        } finally { target.flight = undefined }
      })()
    }
    const flight = state.flight
    if (!flight) throw new Error('JWKS unavailable')
    return (await flight).keys.get(kid)
  }
  return {
    clear() { states.clear() },
    async verify(token: string, secret: string | undefined, url: string | undefined): Promise<Verification> {
      if (!url) return { status: 'unavailable' }
      const issuer = `${url.replace(/\/$/, '')}/auth/v1`
      const header = jwt.decode(token, { complete: true })?.header
      let key: Key | string | undefined
      if (header?.alg === 'HS256') {
        if (!secret) return { status: 'unavailable' }
        key = secret
      } else if (header?.alg === 'ES256' && typeof header.kid === 'string' && header.kid.length > 0 && header.kid.length <= 256) {
        try { key = await keyFor(issuer, header.kid) } catch { return { status: 'unavailable' } }
      } else return { status: 'invalid' }
      if (!key) return { status: 'invalid' }
      try {
        const payload = jwt.verify(token, key, { algorithms: [header.alg], audience: 'authenticated', issuer })
        if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128 || typeof payload.exp !== 'number') return { status: 'invalid' }
        return { status: 'valid', payload }
      } catch { return { status: 'invalid' } }
    },
  }
}
