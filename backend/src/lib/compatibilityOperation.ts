import { getSupabaseAdmin } from './supabaseAdmin.js'
import { isStructuredReport } from './report/storedReport.js'
import { GenerationDependencyError } from './selfGeneration.js'
import type { StructuredReport } from './reportCards.js'
export type CompatibilityState = {state:'started'|'pending'|'completed'|'failed'|'not_found'|'conflict'|'deleted'|'source_not_found'|'partner_not_found'|'insufficient_points';input?:{self:Record<string,any>;partner:Record<string,any>};result?:StructuredReport;conversationId?:string;revisionId?:string}
type RpcClient = {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>}
export async function compatibilityRPC(name:string,args:Record<string,unknown>,client:RpcClient=getSupabaseAdmin()):Promise<CompatibilityState> {
 const validID=(value:unknown)=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
 const {data,error}=await client.rpc(name,args)
 const value=data as CompatibilityState|null
 if(error || !value || !['started','pending','completed','failed','not_found','conflict','deleted','source_not_found','partner_not_found','insufficient_points'].includes(value.state) ||
   (value.state==='completed' && (!isStructuredReport(value.result)||!value.result.reportText.trim()||!value.result.cards.length||!validID(value.conversationId)||!validID(value.revisionId))) ||
   (value.state==='started' && (!value.input?.self?.birth_data || !value.input?.partner?.id))) throw new GenerationDependencyError('Compatibility state unavailable')
 return value
}
