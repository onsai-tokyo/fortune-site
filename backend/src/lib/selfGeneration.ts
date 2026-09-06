import { getSupabaseAdmin } from './supabaseAdmin.js'
import { isStructuredReport } from './report/storedReport.js'
import type { StructuredReport } from './reportCards.js'
export class GenerationDependencyError extends Error {}
export type GenerationState = {state:'started'|'pending'|'completed'|'failed'|'not_found'|'conflict';result?:StructuredReport}
type RpcClient = {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>}
export async function generationRPC(name:string,args:Record<string,unknown>,client:RpcClient=getSupabaseAdmin()):Promise<GenerationState> {
 const {data,error}=await client.rpc(name,args)
 const state=data as GenerationState|null
 if(error || !state || !['started','pending','completed','failed','not_found','conflict'].includes(state.state) ||
   (state.state==='completed' && !isStructuredReport(state.result))) throw new GenerationDependencyError('Generation state unavailable')
 return state
}
