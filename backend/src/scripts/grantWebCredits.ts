import { config } from 'dotenv'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'

config({ override: true })

const [userId, orderId, quantityText] = process.argv.slice(2)
const quantity = Number(quantityText ?? '1')
if (!userId || !orderId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
  console.error('Usage: npm run books:grant-web -- <user-uuid> <order-id> <quantity 1..20>')
  process.exit(2)
}

const { error } = await getSupabaseAdmin().rpc('ai_book_grant_web', {
  p_user: userId,
  p_order_id: orderId,
  p_quantity: quantity,
})
if (error) throw error
console.log(JSON.stringify({ granted: true, userId, orderId, quantity }))
