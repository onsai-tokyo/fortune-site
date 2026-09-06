import test from 'node:test'
import assert from 'node:assert/strict'
import { generationKey, loadWebGeneration, recoverWebGeneration } from './selfGenerationRecovery.ts'
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222'
const input={birthDate:'2000-01-01'},payload={...input,calculatedData:{score:12}}
const result={version:3,reportText:'body',cards:[{id:'test'}],unknownMetadata:{keep:12}}
function setup(){
 const values=new Map<string,string>();let writesFail=false,epoch=0,prepared=0
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(writesFail)throw Error('storage unavailable');values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}
 const calls:{path:string;init?:RequestInit}[]=[],refresh:boolean[]=[]
 let replies:{status:number;body:unknown}[]=[]
 const options={owner:'ownerA',input,storage,check:()=>{if(epoch)throw Error('owner changed')},authorize:async(force:boolean)=>{refresh.push(force);return force?'fresh':'token'},prepare:async()=>{prepared++;return payload},fetcher:async(path:RequestInfo|URL,init?:RequestInit)=>{calls.push({path:String(path),init});const reply=replies.shift();assert.ok(reply,'unexpected request');return new Response(JSON.stringify(reply.body),{status:reply.status})},newID:()=>id}
 return {options,values,calls,refresh,prepared:()=>prepared,setReplies:(value:typeof replies)=>{replies=value;calls.length=0},failWrites:(value:boolean)=>{writesFail=value},switchOwner:()=>{epoch++}}
}
test('lost generation response recovers full report across restart with GET only',async()=>{
 const s=setup();s.setReplies([{status:503,body:{}}]);await assert.rejects(recoverWebGeneration(s.options));assert.equal(s.prepared(),1)
 assert.equal(loadWebGeneration(s.options.storage,'ownerA')?.id,id)
 s.setReplies([{status:200,body:{state:'completed',result}}]);const recovered=await recoverWebGeneration({...s.options})
 assert.deepEqual(recovered.result,result);assert.equal(s.prepared(),1);assert.deepEqual(s.calls.map(c=>c.init?.method),['GET'])
 s.setReplies([]);assert.deepEqual(await recoverWebGeneration(s.options),recovered);assert.equal(s.calls.length,0)
})
test('pending does not POST; not_found replays the exact operation and body',async()=>{
 const s=setup();s.setReplies([{status:503,body:{}}]);await assert.rejects(recoverWebGeneration(s.options));const original=s.calls[0]
 s.setReplies([{status:200,body:{state:'pending'}}]);await assert.rejects(recoverWebGeneration(s.options));assert.deepEqual(s.calls.map(c=>c.init?.method),['GET'])
 s.setReplies([]);await assert.rejects(recoverWebGeneration({...s.options,input:{birthDate:'changed'}}));assert.equal(s.calls.length,0)
 s.setReplies([{status:200,body:{state:'not_found'}},{status:200,body:result}]);await recoverWebGeneration(s.options)
 assert.equal(s.calls[1].init?.body,original.init?.body);assert.equal((s.calls[1].init?.headers as Record<string,string>)['Idempotency-Key'],id);assert.equal(s.prepared(),1)
})
test('401 refresh is bounded and reuses the same generation operation',async()=>{
 const s=setup();s.setReplies([{status:401,body:{}},{status:200,body:result}]);await recoverWebGeneration(s.options)
 assert.deepEqual(s.refresh,[false,true]);assert.equal(s.calls[0].init?.body,s.calls[1].init?.body)
 assert.equal((s.calls[1].init?.headers as Record<string,string>)['Idempotency-Key'],id)
 const rejected=setup();rejected.setReplies([{status:401,body:{}},{status:401,body:{}}]);await assert.rejects(recoverWebGeneration(rejected.options));assert.equal(rejected.calls.length,2)
})
test('storage failure blocks POST and result-write failure remains recoverable',async()=>{
 const s=setup();s.failWrites(true);s.setReplies([]);await assert.rejects(recoverWebGeneration(s.options));assert.equal(s.calls.length,0)
 s.failWrites(false);const original=s.options.fetcher;s.options.fetcher=async(...args)=>{const response=await original(...args);s.failWrites(true);return response}
 s.setReplies([{status:200,body:result}]);await assert.rejects(recoverWebGeneration(s.options));s.failWrites(false)
 assert.equal(loadWebGeneration(s.options.storage,'ownerA')?.result,undefined)
 s.options.fetcher=original;s.setReplies([{status:200,body:{state:'completed',result}}]);assert.deepEqual((await recoverWebGeneration(s.options)).result,result)
})
test('owner change discards late responses and corrupt storage is preserved',async()=>{
 const s=setup(),original=s.options.fetcher;s.options.fetcher=async(...args)=>{const response=await original(...args);s.switchOwner();return response}
 s.setReplies([{status:200,body:result}]);await assert.rejects(recoverWebGeneration(s.options));assert.equal(loadWebGeneration(s.options.storage,'ownerA')?.result,undefined);assert.equal(loadWebGeneration(s.options.storage,'ownerB'),null)
 const broken=setup();broken.values.set(generationKey('ownerA'),'broken');await assert.rejects(recoverWebGeneration(broken.options));assert.equal(broken.values.get(generationKey('ownerA')),'broken');assert.equal(broken.calls.length,0)
})
test('failed operation clears only after acknowledgement; next explicit call uses a new ID',async()=>{
 const s=setup();s.setReplies([{status:503,body:{}}]);await assert.rejects(recoverWebGeneration(s.options))
 s.setReplies([{status:200,body:{state:'failed'}}]);await assert.rejects(recoverWebGeneration(s.options));assert.equal(loadWebGeneration(s.options.storage,'ownerA'),null)
 s.setReplies([{status:200,body:result}]);assert.equal((await recoverWebGeneration({...s.options,newID:()=>id2})).id,id2)
})

test('partial success payload is not cached as a completed report',async()=>{
 const s=setup();s.setReplies([{status:200,body:{version:3,reportText:'partial',cards:[]}}]);await assert.rejects(recoverWebGeneration(s.options))
 assert.equal(loadWebGeneration(s.options.storage,'ownerA')?.result,undefined)
 s.setReplies([{status:200,body:{state:'completed',result}}]);assert.deepEqual((await recoverWebGeneration(s.options)).result,result)
})
