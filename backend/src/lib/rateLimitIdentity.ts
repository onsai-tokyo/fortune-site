import jwt, { JwtPayload } from 'jsonwebtoken'

export function verifiedUserIdFromAuthorization(
  authorization: string | undefined,
  jwtSecret: string | undefined,
  supabaseUrl: string | undefined,
): string | undefined {
  if (!authorization?.startsWith('Bearer ') || !jwtSecret || !supabaseUrl) return undefined
  const token = authorization.slice(7)
  try {
    const issuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      audience: 'authenticated',
      issuer,
    }) as JwtPayload
    return typeof payload.sub === 'string' && payload.sub.length <= 128 ? payload.sub : undefined
  } catch {
    return undefined
  }
}
