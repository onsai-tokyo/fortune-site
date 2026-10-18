import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY

// The Web mock build intentionally runs without Supabase variables. Keep the
// client importable in that mode; AppState gates all network auth calls on the
// presence of both real variables.
export const supabase = createClient(supabaseUrl ?? 'https://mock.invalid', supabaseAnonKey ?? 'mock-anon-key')

export interface Subscription {
  id: string
  user_id: string
  plan: string
  expires_at: string
  payjp_charge_id: string | null
  created_at: string
}

export interface UserPoints {
  user_id: string
  balance: number
  total_earned: number
  updated_at: string
}
