import { getSupabaseAdmin } from './supabaseAdmin.js'
export const registrationID = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export async function partnerRegistrationRPC(name: string, args: Record<string, unknown>) {
  const { data, error } = await getSupabaseAdmin().rpc(name, args)
  if (error || !data || !['not_found','completed','deleted','cancelled','conflict','limit'].includes(data.state) ||
    (data.state === 'completed' && (!registrationID(data.partner?.id) || typeof data.partner?.display_name !== 'string' || !Number.isInteger(data.remaining) || data.remaining < 0 || data.remaining > 2))) {
    throw new Error('相手の登録状況を確認できませんでした')
  }
  return data as {state: string; partner?: Record<string,unknown>; remaining?: number}
}
