// Operator-only CLI. No review credentials or drafts in public API responses.
import 'dotenv/config'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { bookRPC, uuidPattern } from '../lib/aiBooks.js'
const [action,id]=process.argv.slice(2)
if(action==='list') {
  const {data,error}=await getSupabaseAdmin().from('ai_books').select('id,title,created_at').eq('state','review').order('created_at')
  if(error) throw new Error('Review list unavailable'); console.log(JSON.stringify(data,null,2))
} else if(id && uuidPattern.test(id) && ['show','approve','reject'].includes(action)) {
  if(action==='show') {
    const {data,error}=await getSupabaseAdmin().from('ai_books').select('id,question,document,source_snapshot,metadata').eq('id',id).eq('state','review').single()
    if(error) throw new Error('Review not found'); console.log(JSON.stringify(data,null,2))
  } else console.log(await bookRPC('ai_book_review',{p_id:id,p_approve:action==='approve'}))
} else throw new Error('Usage: reviewAiBook.ts list | show/approve/reject <uuid>')
