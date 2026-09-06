import { generationKey, loadWebGeneration, WebGenerationError, type StorageLike, type WebGeneration } from './selfGenerationRecovery'
export function invalidateDeletedReading(storage:StorageLike,owner:string,conversationId:string):WebGeneration|null {
 const current=loadWebGeneration(storage,owner)
 if(!current?.save||current.save.conversationId!==conversationId)return current
 const deleted:WebGeneration={...current,save:{payload:current.save.payload,deleted:true}}
 storage.setItem(generationKey(owner),JSON.stringify(deleted));return deleted
}
export async function verifySavedWebReading(options:{owner:string;storage:StorageLike;check:()=>void;authorize:(refresh:boolean)=>Promise<string>;fetcher:typeof fetch}):Promise<WebGeneration|null> {
 const {owner,storage,check}=options
 check();const entry=loadWebGeneration(storage,owner)
 if(!entry?.save?.conversationId)return entry
 const conversationId=entry.save.conversationId
 let refreshed=false
 while(true){
  check();const token=await options.authorize(refreshed);check()
  const response=await options.fetcher(`/api/reading/${conversationId}/cards`,{method:'GET',cache:'no-store',headers:{Authorization:`Bearer ${token}`}});check()
  if(response.status===401&&!refreshed){refreshed=true;continue}
  const current=loadWebGeneration(storage,owner)
  if(current?.id!==entry.id||current.save?.conversationId!==conversationId)throw new WebGenerationError('保存状況が別の画面で変更されました')
  if(response.status===404||response.status===410)return invalidateDeletedReading(storage,owner,conversationId)
  if(!response.ok)throw new WebGenerationError('保存済み鑑定の状態を確認できませんでした。時間をおいて再確認してください',response.status)
  const report=await response.json() as {version?:unknown;reportText?:unknown;cards?:unknown}|null;check()
  if(!report||![2,3].includes(report.version as number)||!Array.isArray(report.cards)||report.reportText!==entry.result?.reportText)throw new WebGenerationError('保存済み鑑定の応答を確認できませんでした')
  const latest=loadWebGeneration(storage,owner)
  if(latest?.id!==entry.id||latest.save?.conversationId!==conversationId)throw new WebGenerationError('保存状況が別の画面で変更されました')
  return current
 }
}
