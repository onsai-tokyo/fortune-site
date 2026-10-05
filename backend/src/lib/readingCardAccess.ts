import {getSupabaseAdmin} from './supabaseAdmin.js'
import {hasPremiumAccess} from './premium.js'
import {cardPurchasesEnabled,readingCardBalance,readingTargetKey,readingPurchaseIdentity} from './readingCardPurchases.js'
import {projectReadingCard} from './readingAccessPolicy.js'
import type {ReportCard,StructuredReport} from './reportCards.js'

type Row=Parameters<typeof readingTargetKey>[0]
export async function readingCardProjector(user:string,row:Row) {
 if(!cardPurchasesEnabled())return (card:ReportCard):ReportCard=>card
 const premium=await hasPremiumAccess(user)
 const {owned}=await readingCardBalance(user,readingTargetKey(await readingPurchaseIdentity(user,row)))
 return (card:ReportCard):ReportCard=>projectReadingCard({...card,scope:card.scope??(row.kind==='compatibility'||(row.birth_data as {_sourceKind?:string}|undefined)?._sourceKind==='compatibility'?'couple':'self')},premium,owned)
}
export function projectedReport(report:StructuredReport,project:(card:ReportCard)=>ReportCard):StructuredReport {
 const cards=report.cards.map(project)
 // Never return the original concatenated report after projecting locked cards.
 return {version:report.version,generator:report.generator,generatorVersion:report.generatorVersion,chartSections:report.chartSections,cards,reportText:cards.flatMap(c=>[c.title,c.summary,...(c.sections?.map(s=>s.body)??c.pages.map(p=>p.text))]).filter(Boolean).join('\n\n')}
}

/** Redact legacy concatenated text as well as structured cards at read time.
 * The saved original is retained; this never overwrites a customer's report. */
export async function publicReadingConversation<T extends Row & {report_text?:unknown;calculated_data?:unknown}>(user:string,row:T):Promise<T> {
 if(!cardPurchasesEnabled())return row
 const {storedReportFromCalculatedData}=await import('./report/storedReport.js')
 const {buildStructuredReport}=await import('./reportCards.js')
 const report=storedReportFromCalculatedData(row.calculated_data)??buildStructuredReport(String(row.report_text??''))
 const projected=projectedReport(report,await readingCardProjector(user,row))
 // Raw calculation objects may also contain embedded prose/old report snapshots.
 return {...row,report_text:projected.reportText,calculated_data:{_structuredReport:projected}}
}

export async function projectSavedReading(user:string,conversationID:string,report:StructuredReport) {
 if(!cardPurchasesEnabled())return report
 const {data,error}=await getSupabaseAdmin().from('reading_conversations').select('birth_data,kind,partner_profile_id,reading_revision_id').eq('user_id',user).eq('id',conversationID).maybeSingle()
 if(error||!data)throw new Error('READING_CARD_SOURCE_UNAVAILABLE')
 return projectedReport(report,await readingCardProjector(user,data))
}
export async function projectSelfGeneration<T extends {result?:StructuredReport}>(user:string,operationID:string,state:T):Promise<T> {
 if(!cardPurchasesEnabled() || !state.result)return state
 const {data,error}=await getSupabaseAdmin().rpc('reading_card_generation_input',{p_user:user,p_operation:operationID})
 if(error||!data)throw new Error('READING_CARD_SOURCE_UNAVAILABLE')
 return {...state,result:projectedReport(state.result,await readingCardProjector(user,{kind:'self',birth_data:data}))}
}

/** Clients receive redacted cards but the library must retain the full original.
 * iOS reuses its generation operation ID for the following save operation. */
export async function restoreGeneratedSnapshot(user:string,operationID:string|undefined,input:Record<string,unknown>) {
 if(!cardPurchasesEnabled())return input
 const {uuidPattern}=await import('./aiBooks.js')
 const {ReadingSaveError}=await import('./readingRevision.js')
 if(!operationID || !uuidPattern.test(operationID))throw new ReadingSaveError(422,'GENERATION_REQUIRED')
 const db=getSupabaseAdmin()
 const {data:state,error}=await db.rpc('get_self_generation',{p_user:user,p_op:operationID})
 const {isStructuredReport}=await import('./report/storedReport.js')
 if(error)throw new ReadingSaveError(503,'GENERATION_UNAVAILABLE')
 if(state?.state!=='completed'||!isStructuredReport(state.result))throw new ReadingSaveError(422,'GENERATION_REQUIRED')
 const {data:birth,error:birthError}=await db.rpc('reading_card_generation_input',{p_user:user,p_operation:operationID})
 if(birthError||!birth)throw new ReadingSaveError(503,'GENERATION_UNAVAILABLE')
 if(readingTargetKey({kind:'self',birth_data:birth})!==readingTargetKey({kind:'self',birth_data:input.birthData}))
  throw new ReadingSaveError(422,'GENERATION_BIRTH_MISMATCH')
 return {...input,reportText:state.result.reportText,structuredReport:state.result}
}
