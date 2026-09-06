import type { ReconciliationOptions } from './compatibilityReconciliation.js'
export type QuestionReconciliationSummary={mode:'apply'|'dry_run';examined:number;wouldReleaseFree:number;wouldReleaseMonthly:number;reconciled:number;releasedFree:number;releasedMonthly:number;hasMore:boolean;busy:boolean}
type RPC={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>}
export async function reconcileQuestions(db:RPC,options:ReconciliationOptions):Promise<QuestionReconciliationSummary> {
 if(typeof options.apply!=='boolean'||!Number.isInteger(options.limit)||options.limit<1||options.limit>100)throw new Error('Invalid reconciliation options')
 const {data,error}=await db.rpc('reconcile_reading_questions',{p_apply:options.apply,p_limit:options.limit})
 if(error||!data||typeof data!=='object')throw new Error('Question reconciliation acknowledgement unavailable')
 const value=data as QuestionReconciliationSummary
 const fields=['examined','wouldReleaseFree','wouldReleaseMonthly','reconciled','releasedFree','releasedMonthly'] as const
 if(value.mode!==(options.apply?'apply':'dry_run')||typeof value.hasMore!=='boolean'||typeof value.busy!=='boolean'||fields.some(key=>!Number.isSafeInteger(value[key])||value[key]<0)
  ||value.examined>options.limit||value.reconciled>value.examined||value.releasedFree>value.reconciled||value.releasedMonthly>value.reconciled
  ||value.wouldReleaseFree>value.examined||value.wouldReleaseMonthly>value.examined
  ||(!options.apply&&(value.reconciled!==0||value.releasedFree!==0||value.releasedMonthly!==0||value.busy))
  ||(options.apply&&(value.wouldReleaseFree!==0||value.wouldReleaseMonthly!==0||value.reconciled!==value.examined))
  ||(value.busy&&(value.examined!==0||!value.hasMore)))throw new Error('Invalid question reconciliation acknowledgement')
 return {mode:value.mode,examined:value.examined,wouldReleaseFree:value.wouldReleaseFree,wouldReleaseMonthly:value.wouldReleaseMonthly,reconciled:value.reconciled,releasedFree:value.releasedFree,releasedMonthly:value.releasedMonthly,hasMore:value.hasMore,busy:value.busy}
}
