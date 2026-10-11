import { getSupabaseAdmin } from './supabaseAdmin.js'

// Display metadata only; premium authorization still uses hasPremiumAccess.
export function membershipDisplayFromRow(row: Record<string, unknown> | null, now = Date.now()) {
  if (!row || row.subscription_status !== 'active' || row.revoked_at
      || typeof row.expires_at !== 'string' || !(Date.parse(row.expires_at) > now)
      || typeof row.original_transaction_id !== 'string' || typeof row.product_id !== 'string'
      || !['Sandbox', 'Production'].includes(String(row.environment))) return null
  return { originalTransactionId: row.original_transaction_id, productId: row.product_id, environment: String(row.environment) }
}

export async function appleMembershipDisplay(userId: string) {
  try {
    const { data, error } = await getSupabaseAdmin().from('app_store_subscriptions')
      .select('original_transaction_id,product_id,environment,subscription_status,expires_at,revoked_at')
      .eq('user_id', userId).maybeSingle()
    return error ? null : membershipDisplayFromRow(data)
  } catch { return null }
}
