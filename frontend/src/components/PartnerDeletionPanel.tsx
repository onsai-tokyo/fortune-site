import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { deletePartner, deletionKey, loadPartnerDeletion, type PartnerSummary } from '../lib/partnerDeletion'
export function PartnerDeletionPanel({owner,partners,onChanged}:{owner:string;partners:PartnerSummary[];onChanged:(partners:PartnerSummary[])=>void}){
 const epoch=useRef(0),active=useRef(false)
 const [pending,setPending]=useState<PartnerSummary|null>(null),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState('')
 useEffect(()=>{
  const restore=()=>{if(active.current)return;try{setPending(loadPartnerDeletion(localStorage,owner)?.partner??null);setBlocked(false)}catch(reason){setBlocked(true);setError(reason instanceof Error?reason.message:'削除状態を確認できません')}}
  restore()
  const changed=(e:StorageEvent)=>{if(e.key===deletionKey(owner)||e.key===null)restore()}
  const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||session?.user.id!==owner){epoch.current++;setPending(null);setBlocked(true)}})
  window.addEventListener('storage',changed);window.addEventListener('focus',restore)
  return()=>{epoch.current++;data.subscription.unsubscribe();window.removeEventListener('storage',changed);window.removeEventListener('focus',restore)}
 },[owner])
 async function run(partner?:PartnerSummary){
  if(active.current)return
  if(partner&&!window.confirm(`${partner.display_name}さんの登録を削除しますか？保存済みの鑑定は残ります。生成中の相性鑑定は完了できなくなる場合があります。`))return
  const captured=epoch.current,check=()=>{if(captured!==epoch.current)throw new Error('ログイン状態が変更されました')}
  active.current=true;setBusy(true);setError('')
  try{
   if(!navigator.locks)throw new Error('このブラウザでは削除状況を安全に保存できません')
   const updated=await deletePartner({owner,partner,confirmed:!!partner,storage:localStorage,check,fetcher:fetch,lock:async(key,work)=>await navigator.locks.request(key,work),authorize:async(refresh)=>{
    const result=refresh?await supabase.auth.refreshSession():await supabase.auth.getSession();check()
    const session=result.data.session;if(result.error||!session||session.user.id!==owner)throw new Error('ログイン状態を確認してください')
    return session.access_token
   }})
   check();onChanged(updated)
  }catch(reason){if(captured===epoch.current)setError(reason instanceof Error?reason.message:'削除状態を確認できません')}
  finally{active.current=false;if(captured===epoch.current){setBusy(false);try{setPending(loadPartnerDeletion(localStorage,owner)?.partner??null)}catch{setBlocked(true)}}}
 }
 return <div className="border-t border-white/10 pt-4 space-y-3">
  <h3 className="text-white font-semibold">登録した相手の管理</h3>
  {error&&<p role="alert" className="text-red-300 text-sm">{error}</p>}
  {pending?<div className="space-y-2">
   <p className="text-white/60 text-sm">{pending.display_name}さんの削除状況を確認してください。</p>
   <button disabled={busy||blocked} onClick={()=>void run()} className="block text-accent disabled:opacity-40">削除状況だけを確認する</button>
   <button disabled={busy||blocked} onClick={()=>void run(pending)} className="block text-white/60 text-sm disabled:opacity-40">対象を確認して削除を再試行する</button>
  </div>:partners.map(partner=><div key={partner.id} className="flex items-center justify-between gap-3"><span className="text-white/60 text-sm">{partner.display_name}</span><button disabled={busy||blocked} onClick={()=>void run(partner)} className="text-red-300 text-sm disabled:opacity-40">登録を削除</button></div>)}
 </div>
}
