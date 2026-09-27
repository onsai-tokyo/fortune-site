import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { bookRPC, BOOK_PROMPT_VERSION, type BookSource } from '../lib/aiBooks.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { generateBookDocument } from '../lib/aiBookGeneration.js'
import { reconcileAppleBatch } from '../lib/appleReconciliation.js'
async function work() {
  const job=await bookRPC('ai_book_claim'); if(!job) return
  try {
    const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,timeout:80_000,maxRetries:0})
    const generated=await generateBookDocument(client,process.env.AI_BOOK_MODEL!,{question:job.question,theme:job.theme,sources:job.source_snapshot as BookSource[]})
    const saved=await bookRPC('ai_book_finish',{p_id:job.id,p_lease:job.lease_id,p_document:generated.document,
      p_metadata:{model:generated.model,promptVersion:BOOK_PROMPT_VERSION,inputTokens:generated.inputTokens,outputTokens:generated.outputTokens}})
    console.info(JSON.stringify({event:saved?'book_generation_saved':'book_lease_superseded',id:job.id,attempt:job.attempts}))
  } catch {
    console.warn(JSON.stringify({event:'book_generation_retry',id:job.id,attempt:job.attempts}))
    if(job.attempts>=3) await bookRPC('ai_book_fail',{p_id:job.id,p_lease:job.lease_id})
    else {
      const {error}=await getSupabaseAdmin().from('ai_books').update({lease_until:new Date().toISOString()}).eq('id',job.id).eq('lease_id',job.lease_id).eq('state','generating')
      if(error) throw new Error('BOOK_RETRY_SAVE_FAILED')
    }
  }
}
let stopping=false
let nextReconciliation=0, reconciliationCursor=0
process.on('SIGTERM',()=>{stopping=true}); process.on('SIGINT',()=>{stopping=true})
if(!process.env.AI_BOOK_MODEL || !process.env.ANTHROPIC_API_KEY) throw new Error('Configure AI_BOOK_MODEL and ANTHROPIC_API_KEY before starting the worker')
while(!stopping) {
  if (Date.now() >= nextReconciliation) {
    try { reconciliationCursor=await reconcileAppleBatch(reconciliationCursor) }
    catch { console.error('Apple reconciliation dependency unavailable') }
    nextReconciliation=Date.now()+60_000
  }
  try { await work() } catch { console.error('Book worker dependency unavailable') }
  if(process.argv.includes('--once')) break
  await new Promise(resolve=>setTimeout(resolve,3000))
}
