import { getSupabaseAdmin } from './supabaseAdmin.js'

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

export type AiChatReservation = 'ok' | 'user_limit' | 'global_limit'

export async function reserveAiChatQuestion(
  userId: string,
  userLimit: number,
  globalLimit: number,
  client: RpcClient = getSupabaseAdmin(),
): Promise<AiChatReservation> {
  if (userLimit <= 0) return 'user_limit'
  if (globalLimit <= 0) return 'global_limit'
  const { data, error } = await client.rpc('reserve_ai_chat_question', {
    target_user_id: userId,
    user_question_limit: userLimit,
    global_question_limit: globalLimit,
  })
  if (error) throw new Error(error.message ?? 'reserve_ai_chat_question failed')
  if (data === 'ok' || data === 'user_limit' || data === 'global_limit') return data
  throw new Error('reserve_ai_chat_question returned an invalid result')
}

export async function refundAiChatQuestion(
  userId: string,
  client: RpcClient = getSupabaseAdmin(),
): Promise<void> {
  const { error } = await client.rpc('refund_ai_chat_question', { target_user_id: userId })
  if (error) throw new Error(error.message ?? 'refund_ai_chat_question failed')
}
