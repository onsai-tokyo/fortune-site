import { paymentPolicy } from './paymentPolicy'

export const remoteMode = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
export const { purchasesOpen: paymentsAvailable, simulatePurchase } = paymentPolicy(remoteMode, import.meta.env.VITE_PAYMENTS_ENABLED)
export const BOOK_PREPARING = '相談のブックは準備中です'
