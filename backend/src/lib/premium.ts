import { getSupabaseAdmin } from './supabaseAdmin.js'

const activeStatuses = new Set(['active', 'trialing'])
export type PremiumAccess = 'premium' | 'standard' | 'unknown'
export class PremiumAccessUnavailable extends Error {
  constructor() { super('Premium access lookup unavailable'); this.name = 'PremiumAccessUnavailable' }
}
type LookupResult = { data: Record<string, unknown> | null; error: unknown }
export function premiumAccessFromResults(stripe: LookupResult, apple: LookupResult, now = Date.now()): PremiumAccess {
  function state(result: LookupResult, expiryKey: string, revocationKey?: string): PremiumAccess {
    if (result.error) return 'unknown'
    if (!result.data) return 'standard'
    const row = result.data
    if (typeof row.subscription_status !== 'string') return 'unknown'
    if (!activeStatuses.has(row.subscription_status)) return 'standard'
    if (revocationKey && row[revocationKey]) return 'standard'
    const end = row[expiryKey]
    if (end == null) return 'premium' // Preserve the existing open-ended entitlement contract.
    if (typeof end !== 'string' || !Number.isFinite(Date.parse(end))) return 'unknown'
    return Date.parse(end) > now ? 'premium' : 'standard'
  }
  const states = [state(stripe, 'current_period_end'), state(apple, 'expires_at', 'revoked_at')]
  if (states.includes('premium')) return 'premium'
  return states.includes('unknown') ? 'unknown' : 'standard'
}
export async function hasPremiumAccess(userId: string) {
  let db: ReturnType<typeof getSupabaseAdmin>
  try { db = getSupabaseAdmin() } catch { throw new PremiumAccessUnavailable() }
  const results = await Promise.allSettled([
    db.from('stripe_subscriptions').select('subscription_status,current_period_end').eq('user_id', userId).maybeSingle(),
    db.from('app_store_subscriptions').select('subscription_status,expires_at,revoked_at').eq('user_id', userId).maybeSingle(),
  ])
  const rows = results.map(result => result.status === 'fulfilled' ? result.value : { data: null, error: true })
  const access = premiumAccessFromResults(rows[0], rows[1])
  if (access === 'unknown') throw new PremiumAccessUnavailable()
  return access === 'premium'
}
