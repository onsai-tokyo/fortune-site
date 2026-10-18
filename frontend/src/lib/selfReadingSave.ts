import { verifySavedWebReading } from './readingCacheSync'
import { generationKey, loadWebGeneration, WebGenerationError, type WebGeneration, type StorageLike } from './selfGenerationRecovery'
export async function saveWebReading(options:{owner:string;generation:WebGeneration;storage:StorageLike;check:()=>void;authorize:(refresh:boolean)=>Promise<string>;fetcher:typeof fetch}):Promise<WebGeneration> {
 const {owner,storage,check}=options,key=generationKey(owner)
 check()
 let entry=loadWebGeneration(storage,owner)
 if(!entry||entry.id!==options.generation.id||!entry.result||JSON.stringify(entry.result)!==JSON.stringify(options.generation.result))throw new WebGenerationError('保存対象の鑑定を確認できませんでした')
 if(entry.save?.deleted)throw new WebGenerationError('この鑑定は削除済みです。次の操作で新しく生成してください',410)
 if(entry.save?.conversationId){
  const verified=await verifySavedWebReading(options)
  if(!verified||verified.save?.deleted)throw new WebGenerationError('鑑定は削除済みです。もう一度操作すると新しく生成します',410)
  return verified
 }
 const payload=entry.save?.payload??JSON.stringify({birthData:entry.input,calculatedData:entry.payload.calculatedData,reportText:entry.result.reportText,structuredReport:entry.result,sourceSection:'あなたについて'})
 const persist=(value:WebGeneration)=>{
  check()
  if(loadWebGeneration(storage,owner)?.id!==value.id)throw new WebGenerationError('保存操作が別の画面で変更されました')
  storage.setItem(key,JSON.stringify(value))
 }
 entry={...entry,save:{payload}};persist(entry)
 let refreshed=false
 while(true){
  check();const token=await options.authorize(refreshed);check()
  const response=await options.fetcher('/api/reading/conversations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'Idempotency-Key':entry.id},body:payload});check()
  if(response.status===401&&!refreshed){refreshed=true;continue}
  if(response.status===410){persist({...entry,save:{payload,deleted:true}});throw new WebGenerationError('鑑定は削除済みです。もう一度操作すると新しく生成します',410)}
  const raw:unknown=await response.json();check()
  if(!response.ok)throw new WebGenerationError('鑑定の保存が未完了です。同じ入力で保存を再試行してください',response.status)
  const value=raw as {id?:unknown;revisionId?:unknown}|null
  const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  if(!value||!uuid(value.id)||!uuid(value.revisionId))throw new WebGenerationError('鑑定の保存結果を確認できませんでした')
  entry={...entry,save:{payload,conversationId:value.id as string,revisionId:value.revisionId as string}};persist(entry);return entry
 }
}
