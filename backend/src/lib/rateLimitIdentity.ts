import { createPublicKey, type JsonWebKey } from 'node:crypto'
import jwt, { type JwtHeader, type JwtPayload } from 'jsonwebtoken'

const JWKS_CACHE_MS = 60 * 60 * 1000
const jwksCache = new Map<string, { expiresAt: number; keys: Map<string, ReturnType<typeof createPublicKey>> }>()
type SupabaseJwk = JsonWebKey & { kid?: string }

function issuerFor(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`
}

async function es256Key(token: string, supabaseUrl: string) {
  const header = (jwt.decode(token, { complete: true })?.header as JwtHeader | undefined)
  if (header?.alg !== 'ES256' || !header.kid) return undefined
  const issuer = issuerFor(supabaseUrl)
  let cached = jwksCache.get(issuer)
  if (!cached || cached.expiresAt <= Date.now()) {
    const response = await fetch(`${issuer}/.well-known/jwks.json`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return undefined
    const body = await response.json() as { keys?: SupabaseJwk[] }
    const keys = new Map<string, ReturnType<typeof createPublicKey>>()
    for (const key of body.keys ?? []) {
      if (key.kid && key.kty === 'EC' && key.crv === 'P-256') {
        keys.set(key.kid, createPublicKey({ key, format: 'jwk' }))
      }
    }
    cached = { expiresAt: Date.now() + JWKS_CACHE_MS, keys }
    jwksCache.set(issuer, cached)
  }
  return cached.keys.get(header.kid)
}

export async function verifySupabaseAccessToken(
  token: string,
  jwtSecret: string | undefined,
  supabaseUrl: string | undefined,
): Promise<JwtPayload | undefined> {
  if (!supabaseUrl) return undefined
  try {
    const header = jwt.decode(token, { complete: true })?.header
    const issuer = issuerFor(supabaseUrl)
    if (header?.alg === 'HS256' && jwtSecret) {
      return jwt.verify(token, jwtSecret, { algorithms: ['HS256'], audience: 'authenticated', issuer }) as JwtPayload
    }
    if (header?.alg === 'ES256') {
      const key = await es256Key(token, supabaseUrl)
      if (!key) return undefined
      return jwt.verify(token, key, { algorithms: ['ES256'], audience: 'authenticated', issuer }) as JwtPayload
    }
    return undefined
  } catch {
    return undefined
  }
}

export async function verifiedUserIdFromAuthorization(
  authorization: string | undefined,
  jwtSecret: string | undefined,
  supabaseUrl: string | undefined,
): Promise<string | undefined> {
  if (!authorization?.startsWith('Bearer ')) return undefined
  const token = authorization.slice(7)
  const payload = await verifySupabaseAccessToken(token, jwtSecret, supabaseUrl)
  return typeof payload?.sub === 'string' && payload.sub.length <= 128 ? payload.sub : undefined
}

export function clearSupabaseJwksCacheForTests() {
  jwksCache.clear()
}
