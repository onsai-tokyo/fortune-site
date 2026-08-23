import jwt from 'jsonwebtoken'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} が未設定です`)
  return value
}

const privateKey = () => required('APPLE_SIGN_IN_PRIVATE_KEY').replace(/\\n/g, '\n')

export function appleClientSecret() {
  return jwt.sign({}, privateKey(), {
    algorithm: 'ES256',
    audience: 'https://appleid.apple.com',
    issuer: required('APPLE_TEAM_ID'),
    subject: required('APPLE_BUNDLE_ID'),
    keyid: required('APPLE_SIGN_IN_KEY_ID'),
    expiresIn: 300,
    notBefore: 0,
    mutatePayload: false,
  })
}

async function appleTokenRequest(parameters: Record<string, string>) {
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required('APPLE_BUNDLE_ID'),
      client_secret: appleClientSecret(),
      ...parameters,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const payload = await response.json() as { refresh_token?: string; error?: string }
  if (!response.ok) throw new Error(`Apple token exchange failed: ${payload.error ?? response.status}`)
  return payload
}

export async function exchangeAppleAuthorizationCode(code: string) {
  const payload = await appleTokenRequest({ grant_type: 'authorization_code', code })
  if (!payload.refresh_token) throw new Error('Apple refresh token が返されませんでした')
  return payload.refresh_token
}

export async function revokeAppleToken(token: string) {
  const response = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required('APPLE_BUNDLE_ID'),
      client_secret: appleClientSecret(),
      token,
      token_type_hint: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Apple token revoke failed: ${response.status}`)
}
