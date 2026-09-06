import { useEffect, useRef, useState } from 'react'
import { loadPartnerRegistration, recoverPartnerRegistration, registrationKey, partnerRelationshipLabels, type PartnerInput, type RegisteredPartner } from '../lib/partnerRegistrationRecovery'
import { supabase } from '../lib/supabase'
const empty: PartnerInput = {displayName:'',birthDate:'',birthTime:'',birthplace:'',gender:'female',relationshipLabel:'友人'}
const field='w-full bg-navy-light border border-white/15 rounded-lg p-2 text-white'
export function PartnerRegistrationForm({owner,partnerIDs,onRegistered}:{owner:string;partnerIDs:string[];onRegistered:(partner:RegisteredPartner)=>void}) {
  const epoch=useRef(0),active=useRef(false)
  const [input,setInput]=useState<PartnerInput>({...empty})
  const [pending,setPending]=useState(false),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false)
  const [error,setError]=useState(''),[saved,setSaved]=useState<RegisteredPartner|null>(null)
  useEffect(()=>{
    let disposed=false
    const restore=()=>{if(disposed || active.current)return;try{setPending(!!loadPartnerRegistration(localStorage,owner));setBlocked(false)}catch(reason){setBlocked(true);setError(reason instanceof Error?reason.message:'登録状態を確認できません')}}
    restore()
    const changed=(event:StorageEvent)=>{if(event.key===registrationKey(owner)||event.key===null){setSaved(null);restore()}}
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'||session?.user.id!==owner){epoch.current++;setInput({...empty});setSaved(null);setBlocked(true)}
    })
    window.addEventListener('storage',changed);window.addEventListener('focus',restore)
    return()=>{disposed=true;epoch.current++;data.subscription.unsubscribe();window.removeEventListener('storage',changed);window.removeEventListener('focus',restore)}
  },[owner])
  async function run(release=false){
    if(active.current)return
    const captured=epoch.current
    const check=()=>{if(epoch.current!==captured)throw new Error('ログイン状態が変更されました')}
    active.current=true;setBusy(true);setError('')
    try{
      if(!navigator.locks)throw new Error('このブラウザでは登録状況を安全に保存できません')
      const prior=loadPartnerRegistration(localStorage,owner)
      const partner=await recoverPartnerRegistration({owner,input:prior?undefined:input,release,storage:localStorage,check,newID:()=>crypto.randomUUID(),fetcher:fetch,lock:async(key,work)=>await navigator.locks.request(key,work),authorize:async(refresh)=>{
        const response=refresh?await supabase.auth.refreshSession():await supabase.auth.getSession();check()
        const session=response.data.session
        if(response.error||!session||session.user.id!==owner)throw new Error('ログイン状態を確認してください')
        return session.access_token
      }})
      check()
      if(release){if(partner)onRegistered(partner);setSaved(null);setInput({...empty})}
      else if(partner){setSaved(partner);setInput({...empty});onRegistered(partner)}
    }catch(reason){if(epoch.current===captured)setError(reason instanceof Error?reason.message:'登録を確認できませんでした')}
    finally{active.current=false;if(epoch.current===captured){setBusy(false);try{setPending(!!loadPartnerRegistration(localStorage,owner))}catch{setBlocked(true)}}}
  }
  return <div className="border-t border-white/10 pt-4 space-y-3">
    <h3 className="text-white font-semibold">相手を登録する</h3>
    <p className="text-white/50 text-sm">相手は2人まで登録できます。登録だけではポイントを消費しません。</p>
    {error&&<p role="alert" className="text-red-300 text-sm">{error}</p>}
    {saved&&partnerIDs.includes(saved.id)&&<p role="status" className="text-white/70 text-sm">{saved.display_name}さんを登録しました。相手の選択欄から選べます。</p>}
    {pending?<div className="space-y-2">
      <button disabled={busy||blocked} onClick={()=>void run()} className="block text-accent disabled:opacity-40">前の登録を確認・再開する</button>
      <button disabled={busy||blocked} onClick={()=>void run(true)} className="block text-white/60 text-sm disabled:opacity-40">前の登録を終了して、次の入力へ進む</button>
      <p className="text-white/40 text-xs">まだ登録されていなければ取り消します。登録済みの相手は削除しません。</p>
    </div>:<form className="space-y-3" onSubmit={event=>{event.preventDefault();void run()}}>
      <fieldset disabled={busy||blocked} className="space-y-3 disabled:opacity-40">
        <label className="block text-white/60 text-sm">表示名<input required maxLength={40} autoComplete="off" className={field} value={input.displayName} onChange={e=>setInput({...input,displayName:e.target.value})}/></label>
        <label className="block text-white/60 text-sm">生年月日<input required type="date" min="0001-01-01" max="9999-12-31" className={field} value={input.birthDate} onChange={e=>setInput({...input,birthDate:e.target.value})}/></label>
        <label className="block text-white/60 text-sm">出生時刻（不明なら空欄）<input type="time" className={field} value={input.birthTime} onChange={e=>setInput({...input,birthTime:e.target.value})}/></label>
        <label className="block text-white/60 text-sm">出生地<input required maxLength={80} className={field} value={input.birthplace} onChange={e=>setInput({...input,birthplace:e.target.value})}/></label>
        <label className="block text-white/60 text-sm">性別<select className={field} value={input.gender} onChange={e=>setInput({...input,gender:e.target.value as PartnerInput['gender']})}><option value="female">女性</option><option value="male">男性</option></select></label>
        <label className="block text-white/60 text-sm">関係性<select className={field} value={input.relationshipLabel} onChange={e=>setInput({...input,relationshipLabel:e.target.value})}>{partnerRelationshipLabels.map(label=><option key={label}>{label}</option>)}</select></label>
        <button className="w-full bg-accent rounded-lg py-3 text-white">{busy?'登録を確認中…':'相手を登録する'}</button>
      </fieldset>
    </form>}
  </div>
}
