import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Subscription {
  id: string
  user_id: string
  plan: string
  expires_at: string
  payjp_charge_id: string | null
  created_at: string
}
