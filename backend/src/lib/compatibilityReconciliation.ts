export type ReconciliationOptions = {apply:boolean;limit:number}
export type ReconciliationSummary = {mode:'apply'|'dry_run';examined:number;wouldRefundPoints:number;reconciled:number;refundedPoints:number;hasMore:boolean;busy:boolean}
type RPC = {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>}
export function reconciliationOptions(args:string[]):ReconciliationOptions {
 let apply=false,limit=100,seenLimit=false
 for(let i=0;i<args.length;i++) {
  if(args[i]==='--apply' && !apply) apply=true
  else if(args[i]==='--limit' && !seenLimit && /^\d+$/.test(args[i+1]??'')) {limit=Number(args[++i]);seenLimit=true}
  else throw new Error('Invalid reconciliation options')
 }
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid reconciliation limit')
 return {apply,limit}
}
export async function reconcileCompatibility(db:RPC,options:ReconciliationOptions):Promise<ReconciliationSummary> {
 if(typeof options.apply!=='boolean'||!Number.isInteger(options.limit)||options.limit<1||options.limit>100)throw new Error('Invalid reconciliation options')
 const {data,error}=await db.rpc('reconcile_compatibility_operations',{p_apply:options.apply,p_limit:options.limit})
 if(error||!data||typeof data!=='object')throw new Error('Reconciliation acknowledgement unavailable')
 const value=data as ReconciliationSummary
 const counts=['examined','wouldRefundPoints','reconciled','refundedPoints'] as const
 if(value.mode!==(options.apply?'apply':'dry_run')||typeof value.hasMore!=='boolean'||typeof value.busy!=='boolean'||counts.some(key=>!Number.isSafeInteger(value[key])||value[key]<0)
   ||value.examined>options.limit||value.reconciled>value.examined||value.refundedPoints>3*value.reconciled||value.wouldRefundPoints>3*value.examined
   ||(!options.apply&&(value.reconciled!==0||value.refundedPoints!==0||value.busy))
   ||(options.apply&&(value.wouldRefundPoints!==0||value.examined!==value.reconciled))
   ||(value.busy&&(value.examined!==0||!value.hasMore)))throw new Error('Invalid reconciliation acknowledgement')
 // Whitelist aggregate fields; never print raw input, identities or provider error details.
 return {mode:value.mode,examined:value.examined,wouldRefundPoints:value.wouldRefundPoints,reconciled:value.reconciled,refundedPoints:value.refundedPoints,hasMore:value.hasMore,busy:value.busy}
}
