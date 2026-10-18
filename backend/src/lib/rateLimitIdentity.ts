import { createSupabaseTokenVerifier } from './supabaseTokenVerifier.js'
const verifier = createSupabaseTokenVerifier()
export const verifySupabaseAccessTokenResult = verifier.verify
export async function verifySupabaseAccessToken(token: string, secret: string | undefined, url: string | undefined) {
  const result = await verifier.verify(token, secret, url)
  return result.status === 'valid' ? result.payload : undefined
}
// Unverified identities never receive an authenticated rate-limit bucket. Route auth
// separately preserves unavailable vs invalid, so dependency failure is not a logout.
export async function verifiedUserIdFromAuthorization(authorization: string | undefined, secret: string | undefined, url: string | undefined) {
  if (!authorization?.startsWith('Bearer ')) return undefined
  return (await verifySupabaseAccessToken(authorization.slice(7), secret, url))?.sub
}
export const clearSupabaseJwksCache = verifier.clear
export const clearSupabaseJwksCacheForTests = verifier.clear
