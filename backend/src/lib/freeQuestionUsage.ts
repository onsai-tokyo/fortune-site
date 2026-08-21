import { getSupabaseAdmin } from './supabaseAdmin.js'

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }> }

export async function consumeFreeQuestion(userId: string, limit: number, client: RpcClient = getSupabaseAdmin()): Promise<number> {
  const { data, error } = await client.rpc('consume_free_reading_question', { target_user_id: userId, question_limit: limit })
  if (error) throw new Error(error.message ?? 'consume_free_reading_question failed')
  return Number(data)
}

export async function refundFreeQuestion(userId: string, client: RpcClient = getSupabaseAdmin()): Promise<void> {
  const { error } = await client.rpc('refund_free_reading_question', { target_user_id: userId })
  if (error) throw new Error(error.message ?? 'refund_free_reading_question failed')
}
