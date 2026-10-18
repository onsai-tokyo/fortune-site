import test from 'node:test'
import assert from 'node:assert/strict'
import {recoverPartnerRegistration,registrationKey} from './partnerRegistrationRecovery.ts'
import {deletePartner,deletionKey} from './partnerDeletion.ts'
const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222'
const input={displayName:'A',birthDate:'2000-02-29',birthTime:'',birthplace:'東京',gender:'female' as const,relationshipLabel:'友人'}
// Stateful fake API tests integration between the two recovery clients, never live data.
function setup(){
 const storageData=new Map<string,string>(),partners=new Map<string,{id:string;display_name:string;relationship_label:string}>(),operations=new Map<string,string>(),calls:{path:string;method:string}[]=[],tails=new Map<string,Promise<void>>()
 let loseRegistration=true,loseDeletion=true
 const storage={getItem:(k:string)=>storageData.get(k)??null,setItem:(k:string,v:string)=>{storageData.set(k,v)},removeItem:(k:string)=>{storageData.delete(k)}}
 const fetcher=async(path:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(path),method=init?.method??'GET';calls.push({path:url,method})
  const json=(v:unknown)=>new Response(JSON.stringify(v))
  if(url==='/api/partners'&&method==='POST'){
   const op=(init?.headers as Record<string,string>)['Idempotency-Key'],body=JSON.parse(String(init?.body))
   if(!operations.has(op)){operations.set(op,op);partners.set(op,{id:op,display_name:body.displayName,relationship_label:body.relationshipLabel})}
   if(loseRegistration){loseRegistration=false;throw Error('reply lost after commit')}
   return json({partner:partners.get(op),remaining:2-partners.size})
  }
  if(url.startsWith('/api/partners/registration/operations/')){
   const op=url.split('/').pop()!,id=operations.get(op)
   return json(!id?{state:'not_found'}:partners.has(id)?{state:'completed',partner:partners.get(id),remaining:2-partners.size}:{state:'deleted'})
  }
  if(url==='/api/partners'&&method==='GET')return json({partners:[...partners.values()]})
  if(method==='DELETE'){
   partners.delete(url.split('/').pop()!)
   if(loseDeletion){loseDeletion=false;throw Error('reply lost after delete')}
   return new Response(null,{status:204})
  }
  throw Error('Unexpected '+method+' '+url)
 }
 const common={owner:'a',storage,fetcher,check:()=>{},authorize:async()=> 'token',lock:async<T>(key:string,work:()=>Promise<T>)=>{
  const previous=tails.get(key)??Promise.resolve();let release!:()=>void
  const next=new Promise<void>(resolve=>{release=resolve});tails.set(key,next);await previous
  try{return await work()}finally{release();if(tails.get(key)===next)tails.delete(key)}
 }}
 return{common,storageData,partners,operations,calls}
}
test('registration response loss, deletion response loss, and replacement register never resurrect old partner',async()=>{
 const s=setup();const register={...s.common,input,newID:()=>first}
 await assert.rejects(recoverPartnerRegistration(register));assert.equal(s.partners.size,1)
 const restored=await recoverPartnerRegistration({...register,input:undefined});assert.equal(restored?.id,first)
 const result=await deletePartner({...s.common,partner:restored!,confirmed:true});assert.deepEqual(result,[])
 assert.equal(s.storageData.has(deletionKey('a')),false);assert.equal(s.storageData.has(registrationKey('a')),true)
 await assert.rejects(recoverPartnerRegistration({...register,input:undefined}),/終了/)
 assert.equal(s.storageData.has(registrationKey('a')),false);assert.equal(s.partners.size,0)
 const replacement=await recoverPartnerRegistration({...register,input:{...input,displayName:'B'},newID:()=>second})
 assert.equal(replacement?.id,second);assert.equal(s.partners.has(first),false);assert.equal(s.operations.get(first),first)
 assert.equal(s.calls.filter(call=>call.method==='POST').length,2);assert.equal(s.calls.filter(call=>call.method==='DELETE').length,1)
})
test('queued registration recovery and deletion share a lock without duplicating or deadlocking',async()=>{
 const s=setup(),register={...s.common,input,newID:()=>first}
 await assert.rejects(recoverPartnerRegistration(register))
 const results=await Promise.all([recoverPartnerRegistration({...register,input:undefined}),deletePartner({...s.common,partner:{id:first,display_name:'A'},confirmed:true})])
 assert.equal(results[0]?.id,first);assert.deepEqual(results[1],[]);assert.equal(s.partners.size,0)
 assert.equal(s.calls.filter(call=>call.method==='POST').length,1)
})
