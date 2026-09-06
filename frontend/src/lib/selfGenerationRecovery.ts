type ObjectData=Record<string,unknown>
export type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>
export type WebGeneration={version:1;id:string;input:ObjectData;payload:ObjectData;result?:ObjectData;save?:{payload:string;conversationId?:string;revisionId?:string;deleted?:true}}
export const generationKey=(owner:string)=>`fatelab:self-generation:v1:${owner}`
const object=(value:unknown):value is ObjectData=>!!value&&typeof value==='object'&&!Array.isArray(value)
const report=(value:unknown):value is ObjectData=>object(value)&&[2,3].includes(value.version as number)&&typeof value.reportText==='string'&&!!value.reportText.trim()&&Array.isArray(value.cards)&&value.cards.length>0
const equal=(a:ObjectData,b:ObjectData)=>JSON.stringify(a)===JSON.stringify(b)
export function loadWebGeneration(storage:StorageLike,owner:string):WebGeneration|null {
 const raw=storage.getItem(generationKey(owner));if(raw===null)return null
 const value=JSON.parse(raw) as WebGeneration
 if(value.version!==1||typeof value.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)||!object(value.input)||!object(value.payload)||!object(value.payload.calculatedData)||(value.result!==undefined&&!report(value.result)))throw new Error('保存された生成状況を読み込めませんでした')
 if(value.save){
  const saved=value.save
  const uuid=(id:unknown)=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  if(typeof saved.payload!=='string'||!value.result||(saved.deleted!==undefined&&saved.deleted!==true)
   ||((saved.conversationId!==undefined||saved.revisionId!==undefined)&&(!uuid(saved.conversationId)||!uuid(saved.revisionId)))
   ||(saved.deleted&&(saved.conversationId||saved.revisionId)))throw new Error('保存操作を読み込めませんでした')
  const payload:unknown=JSON.parse(saved.payload)
  if(!object(payload)||JSON.stringify(payload.birthData)!==JSON.stringify(value.input)||JSON.stringify(payload.calculatedData)!==JSON.stringify(value.payload.calculatedData)
   ||JSON.stringify(payload.structuredReport)!==JSON.stringify(value.result)||payload.reportText!==value.result.reportText||payload.sourceSection!=='あなたについて')throw new Error('保存内容が鑑定結果と一致しません')
 }
 return value
}
export class WebGenerationError extends Error {constructor(message:string,readonly status?:number){super(message)}}
export type GenerationRequest=(path:string,body?:ObjectData)=>Promise<ObjectData>
export async function recoverWebGeneration(options:{owner:string;input:ObjectData;storage:StorageLike;check:()=>void;authorize:(refresh:boolean)=>Promise<string>;prepare:(request:GenerationRequest)=>Promise<ObjectData>;fetcher:typeof fetch;newID:()=>string}):Promise<WebGeneration> {
 const {owner,input,storage,check}=options,key=generationKey(owner)
 check()
 let operation=loadWebGeneration(storage,owner)
 const originalID=operation?.id
 const request:GenerationRequest=async(path,body)=>{
  let refreshed=false
  while(true){
   check();const token=await options.authorize(refreshed);check()
   const response=await options.fetcher(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(path.startsWith('/api/preview/generate?')&&operation?{'Idempotency-Key':operation.id}:{})},...(body?{body:JSON.stringify(body)}:{})});check()
   if(response.status===401&&!refreshed){refreshed=true;continue}
   const value:unknown=await response.json();check()
   if(!response.ok)throw new WebGenerationError(object(value)&&typeof value.error==='string'?value.error:'生成状況を確認できませんでした',response.status)
   if(!object(value))throw new WebGenerationError('応答を読み込めませんでした')
   return value
  }
 }
 const persist=(value:WebGeneration)=>{
  check();const current=loadWebGeneration(storage,owner)
  if(current&&current.id!==originalID&&current.id!==value.id)throw new WebGenerationError('別の画面で生成状況が更新されました')
  storage.setItem(key,JSON.stringify(value))
 }
 if(operation&&!equal(operation.input,input)&&!operation.save?.conversationId&&!operation.save?.deleted)throw new WebGenerationError('前の入力で生成状況を確認してから変更してください')
 if(operation?.save?.deleted)operation=null
 if(operation&&equal(operation.input,input)){
  if(operation.result)return operation
  const state=await request(`/api/preview/generations/${operation.id}`)
  if(state.state==='completed'){
   if(!report(state.result))throw new WebGenerationError('完了結果を読み込めませんでした')
   operation={...operation,result:state.result};persist(operation);return operation
  }
  if(state.state==='failed'){
   check();if(loadWebGeneration(storage,owner)?.id===operation.id)storage.removeItem(key)
   throw new WebGenerationError('前の生成は完了しませんでした。もう一度操作すると新しく生成します')
  }
  if(state.state==='pending')throw new WebGenerationError('鑑定を生成中です。少し待ってから再度状況を確認してください')
  if(state.state!=='not_found')throw new WebGenerationError('生成状況を確認できませんでした')
 }else{
  const payload=await options.prepare(request);check()
  operation={version:1,id:options.newID(),input,payload};persist(operation)
 }
 // Never retry generation for network/429/503 failures. The next invocation starts with GET.
 const result=await request('/api/preview/generate?format=json',operation.payload)
 if(!report(result))throw new WebGenerationError('鑑定書を受信できませんでした')
 operation={...operation,result};persist(operation);return operation
}
