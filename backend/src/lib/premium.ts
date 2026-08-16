import { getSupabaseAdmin } from './supabaseAdmin.js'

const activeStatuses = new Set(['active', 'trialing'])

export async function hasPremiumAccess(userId: string) {
  const db = getSupabaseAdmin()
  const now = new Date()
  const [{ data: stripe }, { data: apple }] = await Promise.all([
    db.from('stripe_subscriptions')
      .select('subscription_status,current_period_end')
      .eq('user_id', userId).maybeSingle(),
    db.from('app_store_subscriptions')
      .select('subscription_status,expires_at,revoked_at')
      .eq('user_id', userId).maybeSingle(),
  ])
  const stripeActive = !!stripe
    && activeStatuses.has(stripe.subscription_status)
    && (!stripe.current_period_end || new Date(stripe.current_period_end) > now)
  const appleActive = !!apple
    && activeStatuses.has(apple.subscription_status)
    && !apple.revoked_at
    && (!apple.expires_at || new Date(apple.expires_at) > now)
  return stripeActive || appleActive
}
