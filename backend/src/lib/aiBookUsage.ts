import {getSupabaseAdmin} from './supabaseAdmin.js'
export interface BookUsageEvent {
 callIndex:number; phase:'started'|'response'|'error'|'attempt_succeeded'|'attempt_failed';
 providerModel?:string; inputTokens?:number;outputTokens?:number;cacheCreationInputTokens?:number;cacheReadInputTokens?:number;failureCode?:string
}
export type BookUsageObserver=(event:BookUsageEvent)=>Promise<void>
export function bookUsageRecorder(job:{id:string;lease_id:string;attempts:number},model:string,promptVersion:string):BookUsageObserver {
 return async event=>{
  const {error}=await getSupabaseAdmin().from('ai_book_usage_events').insert({
   book_id:job.id,lease_id:job.lease_id,attempt:job.attempts,call_index:event.callIndex,phase:event.phase,model,prompt_version:promptVersion,
   provider_model:event.providerModel,input_tokens:event.inputTokens,output_tokens:event.outputTokens,
   cache_creation_input_tokens:event.cacheCreationInputTokens,cache_read_input_tokens:event.cacheReadInputTokens,failure_code:event.failureCode,
  })
  if(error && error.code!=='23505')throw new Error('BOOK_USAGE_UNAVAILABLE')
 }
}
