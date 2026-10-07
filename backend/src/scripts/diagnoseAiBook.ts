import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import {getSupabaseAdmin} from '../lib/supabaseAdmin.js'
import {generateBookDocument} from '../lib/aiBookGeneration.js'
import {bookFailure} from '../lib/aiBookFailure.js'
import {uuidPattern} from '../lib/aiBooks.js'
// Explicit operator diagnostic. Reads one existing failed job, does not consume
// credits, mutate its state, or log the question, source prose or generated text.
const id=process.argv[2]
if(!uuidPattern.test(id??''))throw new Error('Specify one book UUID')
const {data:job,error}=await getSupabaseAdmin().from('ai_books').select('state,question,theme,source_snapshot').eq('id',id).single()
if(error || !job || job.state!=='failed')throw new Error('Expected one failed book')
const started=Date.now()
try {
 const result=await generateBookDocument(new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,timeout:80_000,maxRetries:0}),process.env.AI_BOOK_MODEL!,{question:job.question,theme:job.theme,sources:job.source_snapshot})
 console.info(JSON.stringify({event:'book_diagnostic_passed',elapsedMs:Date.now()-started,model:result.model,inputTokens:result.inputTokens,outputTokens:result.outputTokens}))
} catch(error) {
 console.error(JSON.stringify({event:'book_diagnostic_failed',elapsedMs:Date.now()-started,...bookFailure(error)}))
 process.exitCode=1
}
