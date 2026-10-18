import { getSupabaseAdmin } from './supabaseAdmin.js'
export type QuestionResult = {answer:string;suggestions:string[];referencedSystems:string[];questionId:string;answerId:string}
export type QuestionOperation = {state:'started'|'pending'|'completed'|'failed'|'conflict'|'busy'|'not_found'|'deleted';result?:QuestionResult;code?:string}
export class QuestionDependencyError extends Error {}
type Client = {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>}
export async function questionRPC(name:string,args:Record<string,unknown>,client:Client=getSupabaseAdmin()):Promise<QuestionOperation> {
 const {data,error}=await client.rpc(name,args)
 if(error || !data || typeof data!=='object') throw new QuestionDependencyError('Question operation unavailable')
 const op=data as QuestionOperation
 if(!['started','pending','completed','failed','conflict','busy','not_found','deleted'].includes(op.state)) throw new QuestionDependencyError('Invalid operation acknowledgement')
 if(op.state==='completed' && (!op.result || typeof op.result.answer!=='string' || !Array.isArray(op.result.suggestions) || !Array.isArray(op.result.referencedSystems) || typeof op.result.answerId!=='string' || typeof op.result.questionId!=='string')) throw new QuestionDependencyError('Invalid completion acknowledgement')
 return op
}
