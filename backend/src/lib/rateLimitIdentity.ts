import jwt, { JwtPayload } from 'jsonwebtoken'

export function verifySupabaseAccessToken(
  token: string,
  jwtSecret: string | undefined,
  supabaseUrl: string | undefined,
): JwtPayload | undefined {
  if (!jwtSecret || !supabaseUrl) return undefined
  try {
    const issuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`
    return jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      audience: 'authenticated',
      issuer,
    }) as JwtPayload
  } catch {
    return undefined
  }
}

export function verifiedUserIdFromAuthorization(
  authorization: string | undefined,
  jwtSecret: string | undefined,
  supabaseUrl: string | undefined,
): string | undefined {
  if (!authorization?.startsWith('Bearer ')) return undefined
  const token = authorization.slice(7)
  const payload = verifySupabaseAccessToken(token, jwtSecret, supabaseUrl)
  return typeof payload?.sub === 'string' && payload.sub.length <= 128 ? payload.sub : undefined
}
