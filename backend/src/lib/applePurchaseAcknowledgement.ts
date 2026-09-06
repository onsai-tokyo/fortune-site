import type { SupabaseClient } from '@supabase/supabase-js'

export class PurchaseMirrorUnconfirmed extends Error {}

/** A verified signature alone does not prove that this user's entitlement was saved. */
export async function confirmPurchaseMirror(db: Pick<SupabaseClient, 'from'>,
  expected: { userId: string; transactionId: string; originalTransactionId: string; productId: string; environment: string }) {
  const { data, error } = await db.from('app_store_subscriptions')
    .select('user_id,latest_transaction_id,original_transaction_id,product_id,environment')
    .eq('user_id', expected.userId.toLowerCase()).maybeSingle()
  if (error || !data || data.user_id?.toLowerCase() !== expected.userId.toLowerCase()
      || data.latest_transaction_id !== expected.transactionId
      || data.original_transaction_id !== expected.originalTransactionId
      || data.product_id !== expected.productId || data.environment !== expected.environment) {
    throw new PurchaseMirrorUnconfirmed('Purchase mirror does not match verified transaction')
  }
  return { verified: true as const, delivery: 'mirrored' as const,
    transactionId: expected.transactionId, ownerId: expected.userId.toLowerCase() }
}
