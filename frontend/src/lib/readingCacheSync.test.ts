import test from 'node:test'
import assert from 'node:assert/strict'
import { invalidateDeletedReading, verifySavedWebReading } from './readingCacheSync.ts'
import { generationKey, loadWebGeneration, type WebGeneration } from './selfGenerationRecovery.ts'
const id='11111111-1111-4111-8111-111111111111',conversation='22222222-2222-4222-8222-222222222222',revision='33333333-3333-4333-8333-333333333333'
function setup(){
 const entry:WebGeneration={version:1,id,input:{birthDate:'2000-01-01'},payload:{calculatedData:{}},result:{version:3,reportText:'body',cards:[{id:'test'}]}}
 entry.save={payload:JSON.stringify({birthData:entry.input,calculatedData:{},reportText:'body',structuredReport:entry.result,sourceSection:'あなたについて'}),conversationId:conversation,revisionId:revision}
 const values=new Map([[generationKey('a'),JSON.stringify(entry)],[generationKey('b'),JSON.stringify(entry)]]);let changed=false,broken=false
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(broken)throw Error('storage failed');values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}
 const requests:RequestInit[]=[],refresh:boolean[]=[];let status=200
 const options={owner:'a',storage,check:()=>{if(changed)throw Error('owner changed')},authorize:async(force:boolean)=>{refresh.push(force);return 'token'},fetcher:async(path:RequestInfo|URL,init?:RequestInit)=>{assert.equal(path,`/api/reading/${conversation}/cards`);requests.push(init!);return new Response(JSON.stringify(entry.result),{status})}}
 return {entry,values,storage,options,requests,refresh,setStatus:(value:number)=>{status=value},switchOwner:()=>{changed=true},failWrites:()=>{broken=true}}
}
test('confirmed remote deletion marks only matching owner snapshot and removes saved identity',async()=>{
 for(const status of [404,410]){
  const s=setup();s.setStatus(status);const deleted=await verifySavedWebReading(s.options)
  assert.equal(deleted?.save?.deleted,true);assert.equal(deleted?.save?.conversationId,undefined);assert.equal(loadWebGeneration(s.storage,'b')?.save?.conversationId,conversation)
  assert.equal(s.requests[0].method,'GET');assert.equal(s.requests[0].cache,'no-store')
 }
})
test('valid saved report is verified without writes; dependency failures never mean deleted',async()=>{
 const s=setup(),before=s.values.get(generationKey('a'));assert.deepEqual(await verifySavedWebReading(s.options),s.entry);assert.equal(s.values.get(generationKey('a')),before)
 for(const status of [403,409,500,503]){s.setStatus(status);await assert.rejects(verifySavedWebReading(s.options));assert.equal(s.values.get(generationKey('a')),before)}
 await assert.rejects(verifySavedWebReading({...s.options,fetcher:async()=>new Response('{}',{status:200})}));assert.equal(s.values.get(generationKey('a')),before)
})
test('401 refresh is bounded and does not invalidate on repeated authentication failure',async()=>{
 const s=setup();let calls=0
 await assert.rejects(verifySavedWebReading({...s.options,fetcher:async()=>{calls++;return new Response('{}',{status:401})}}))
 assert.equal(calls,2);assert.deepEqual(s.refresh,[false,true]);assert.equal(loadWebGeneration(s.storage,'a')?.save?.conversationId,conversation)
})
test('late owner change or replacement cannot invalidate another generation',async()=>{
 const s=setup(),original=s.options.fetcher;s.setStatus(404)
 await assert.rejects(verifySavedWebReading({...s.options,fetcher:async(...args)=>{const res=await original(...args);s.switchOwner();return res}}))
 assert.equal(loadWebGeneration(s.storage,'a')?.save?.conversationId,conversation)
 const other=setup();other.setStatus(404);const next={...other.entry,id:revision,save:{...other.entry.save!,conversationId:revision}}
 await assert.rejects(verifySavedWebReading({...other.options,fetcher:async()=>{other.values.set(generationKey('a'),JSON.stringify(next));return new Response('{}',{status:404})}}))
 assert.equal(loadWebGeneration(other.storage,'a')?.save?.conversationId,revision)
})
test('local invalidation ignores unrelated history and storage failure never silently succeeds',async()=>{
 const s=setup();assert.deepEqual(invalidateDeletedReading(s.storage,'a',revision),s.entry)
 s.failWrites();s.setStatus(404);await assert.rejects(verifySavedWebReading(s.options));assert.equal(loadWebGeneration(s.storage,'a')?.save?.conversationId,conversation)
})
