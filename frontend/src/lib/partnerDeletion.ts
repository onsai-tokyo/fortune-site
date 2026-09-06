import type { StorageLike } from './selfGenerationRecovery'
import { compatibilityKey } from './compatibilityRecovery'
import { registrationKey } from './partnerRegistrationRecovery'
export type PartnerSummary = {id:string;display_name:string}
type PendingDeletion = {version:1;partner:PartnerSummary}
export const deletionKey=(owner:string)=>`fatelab:partner-deletion:v1:${owner}`
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const valid=(p:PartnerSummary)=>p&&uuid(p.id)&&typeof p.display_name==='string'&&!!p.display_name.trim()
export function loadPartnerDeletion(storage:StorageLike,owner:string):PendingDeletion|null{
 const raw=storage.getItem(deletionKey(owner));if(!raw)return null
 try{const p=JSON.parse(raw) as PendingDeletion;if(p.version===1&&valid(p.partner))return p}catch{/* Preserve uncertain deletion. */}
 throw new Error('前の削除情報を確認できません。保存情報を消さずに確認してください')
}
export async function deletePartner(options:{owner:string;partner?:PartnerSummary;confirmed:boolean;storage:StorageLike;check:()=>void;authorize:(refresh:boolean)=>Promise<string>;fetcher:typeof fetch;lock:<T>(key:string,work:()=>Promise<T>)=>Promise<T>}):Promise<PartnerSummary[]>{
 const {owner,storage,check}=options
 if(!owner)throw new Error('ログインしてください')
 // Fixed order; generation takes only compatibility, registration takes only registration.
 return options.lock(compatibilityKey(owner),()=>options.lock(registrationKey(owner),async()=>{
  check();let pending=loadPartnerDeletion(storage,owner)
  if(pending&&options.partner&&pending.partner.id!==options.partner.id)throw new Error('前の削除対象を先に確認してください')
  if(!pending){
   if(!options.confirmed||!options.partner||!valid(options.partner))throw new Error('削除する相手を確認してください')
   pending={version:1,partner:{...options.partner}};storage.setItem(deletionKey(owner),JSON.stringify(pending))
  }
  const entry=pending
  const current=()=>{check();if(JSON.stringify(loadPartnerDeletion(storage,owner))!==JSON.stringify(entry))throw new Error('別の画面で削除操作が変更されました')}
  let refreshed=false
  const request=async(path:string,method:string)=>{
   for(;;){
    current();const token=await options.authorize(refreshed);current()
    const response=await options.fetcher(path,{method,cache:'no-store',headers:{Authorization:`Bearer ${token}`}});current()
    if(response.status===401&&!refreshed){refreshed=true;continue}
    return response
   }
  }
  const list=async()=>{
   const response=await request('/api/partners','GET')
   if(!response.ok)throw new Error('削除状況を確認できません。同じ対象を再確認してください')
   const body=await response.json();current()
   if(!Array.isArray(body?.partners)||!body.partners.every(valid))throw new Error('相手一覧の形式を確認できませんでした')
   return body.partners as PartnerSummary[]
  }
  let partners=await list()
  if(partners.some(p=>p.id===entry.partner.id)&&options.confirmed){
   try{await request(`/api/partners/${entry.partner.id}`,'DELETE')}catch{current()}
   // Including lost/failed DELETE replies, absence must be verified before clearing the UI.
   partners=await list()
  }
  if(partners.some(p=>p.id===entry.partner.id))throw new Error('相手はまだ登録されています。削除する場合は、もう一度対象を確認してください')
  current();storage.removeItem(deletionKey(owner));return partners
 }))
}
