import { claimSignup, measurementId, signupPayload } from '../server/signupAnalytics.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Authorization, Origin')
  if (req.method !== 'POST') return res.status(405).end()
  if (req.headers.origin !== 'https://fate-lab.com' || req.headers.host !== 'fate-lab.com') return res.status(403).end()
  const payload = signupPayload(req.body)
  if (!payload) return res.status(400).end()
  const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1]
  if (!token || token.length > 8192) return res.status(401).end()
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const secret = process.env.GA4_API_SECRET
  if (!url || !anonKey || !secret) return res.status(503).end()
  try {
    if (!await claimSignup({ token, url, anonKey })) return res.status(204).end()
    // Only the server can emit sign_up. No identity, auth token or account data reaches Google.
    const endpoint = new URL('https://www.google-analytics.com/mp/collect')
    endpoint.searchParams.set('measurement_id', measurementId)
    endpoint.searchParams.set('api_secret', secret)
    await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(4000) })
    // Receipt stays claimed even on Google failure: at-most-once, never count a later login.
    return res.status(204).end()
  } catch { return res.status(503).end() }
}
