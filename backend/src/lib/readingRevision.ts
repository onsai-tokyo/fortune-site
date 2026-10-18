import { getSupabaseUser } from './supabaseUser.js'
import { digest } from './artifactIdentity.js'
import { isStructuredReport, calculatedDataWithReport } from './report/storedReport.js'
export class ReadingSaveError extends Error {
 constructor(readonly status:number, readonly code:string) { super(code) }
}
export function readingSnapshot(input: Record<string, unknown>, kind: 'self'|'compatibility'='self', partnerProfileId: string|null=null) {
 const {birthData,calculatedData,reportText,structuredReport,sourceSection,sourceYear}=input
 if (!birthData || typeof birthData!=='object' || Array.isArray(birthData) || !calculatedData || typeof calculatedData!=='object' || Array.isArray(calculatedData) || typeof reportText!=='string' || !reportText.trim()) throw new ReadingSaveError(400,'INVALID_READING')
 if (reportText.length>60000) throw new ReadingSaveError(413,'READING_TOO_LARGE')
 if (structuredReport!==undefined && !isStructuredReport(structuredReport)) throw new ReadingSaveError(400,'INVALID_REPORT_SNAPSHOT')
 if (isStructuredReport(structuredReport) && structuredReport.reportText!==reportText) throw new ReadingSaveError(400,'REPORT_TEXT_MISMATCH')
 const report=isStructuredReport(structuredReport)?structuredReport:null
 return {birthData,calculatedData:report?calculatedDataWithReport(calculatedData as Record<string,unknown>,report):calculatedData,
   reportText,kind,partnerProfileId,sourceSection:typeof sourceSection==='string'?sourceSection.slice(0,80):null,
   sourceYear:typeof sourceYear==='number'&&Number.isInteger(sourceYear)?sourceYear:null,
   // These are declarations from the saved report, not evidence of model approval.
   declaredVersions: report ? {schemaVersion:report.version,generatorVersion:report.generatorVersion??null,generator:report.generator??null} : null}
}
export async function saveReadingSnapshot(accessToken:string,payload:ReturnType<typeof readingSnapshot>,title:string,opId?:string) {
 const operation=opId??'content:'+digest(payload)
 if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(operation)) throw new ReadingSaveError(400,'INVALID_OPERATION_ID')
 const {data,error}=await getSupabaseUser(accessToken).rpc('save_reading_revision',{p_op_id:operation,p_payload:payload,p_title:title})
 if(error) throw new ReadingSaveError(503,'DEPENDENCY_NOT_READY')
 if(data?.deleted) throw new ReadingSaveError(410,'READING_DELETED')
 if(data?.conflict) throw new ReadingSaveError(409,'OPERATION_PAYLOAD_CONFLICT')
 if(!data || typeof data.id!=='string' || typeof data.revisionId!=='string') throw new ReadingSaveError(503,'DEPENDENCY_NOT_READY')
 return data as {id:string;revisionId:string;readingId?:string;reused:boolean}
}
