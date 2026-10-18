import { config } from 'dotenv'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'

config({ override: true })

const admin = getSupabaseAdmin()
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
let page = 1
let removed = 0

while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw error
  if (!data.users.length) break
  for (const user of data.users) {
    const isAnonymous = user.is_anonymous === true || !user.email
    const lastSeen = user.last_sign_in_at ?? user.created_at
    if (!isAnonymous || lastSeen >= cutoff) continue
    const [{ count: books }, { count: grants }] = await Promise.all([
      admin.from('ai_books').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      admin.from('ai_book_grants').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    if ((books ?? 0) > 0 || (grants ?? 0) > 0) continue
    const result = await admin.auth.admin.deleteUser(user.id)
    if (result.error) throw result.error
    removed++
  }
  if (data.users.length < 1000) break
  page++
}

console.log(JSON.stringify({ cutoff, removed }))
