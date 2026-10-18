import test from 'node:test'
import assert from 'node:assert/strict'
import { saveWebReading } from './selfReadingSave.ts'
import { generationKey, loadWebGeneration, recoverWebGeneration, type WebGeneration } from './selfGenerationRecovery.ts'
const id='11111111-1111-4111-8111-111111111111',conversation='22222222-2222-4222-8222-222222222222',revision='33333333-3333-4333-8333-333333333333'
function setup(){
 const generation:WebGeneration={version:1,id,input:{birthDate:'2000-01-01'},payload:{calculatedData:{score:12}},result:{version:3,reportText:'body',cards:[{id:'test'}],unknownMetadata:{nested:{score:12}}}}
 const values=new Map([[generationKey('a'),JSON.stringify(generation)]]);let broken=false,changed=false
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(broken)throw Error('storage failed');values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}
 let replies:{status:number;body:unknown}[]=[];const calls:RequestInit[]=[],refresh:boolean[]=[]
 const options={owner:'a',generation,storage,check:()=>{if(changed)throw Error('owner changed')},authorize:async(force:boolean)=>{refresh.push(force);return 'token'},fetcher:async(path:RequestInfo|URL,init?:RequestInit)=>{assert.equal(path,'/api/reading/conversations');calls.push(init!);const next=replies.shift();assert.ok(next,'unexpected request');return new Response(JSON.stringify(next.body),{status:next.status})}}
 return {options,values,calls,refresh,setReplies:(value:typeof replies)=>{replies=value;calls.length=0},failWrites:(value:boolean)=>{broken=value},switchOwner:()=>{changed=true}}
}
test('lost save response replays exact payload and ID then caches both persisted identities',async()=>{
 const s=setup();s.setReplies([{status:503,body:{}}]);await assert.rejects(saveWebReading(s.options));const first=s.calls[0]
 const body=JSON.parse(String(first.body));assert.deepEqual(body.structuredReport,s.options.generation.result);assert.deepEqual(body.calculatedData,{score:12});assert.equal(body.sourceSection,'あなたについて')
 s.setReplies([{status:201,body:{id:conversation,revisionId:revision}}]);const saved=await saveWebReading({...s.options,generation:loadWebGeneration(s.options.storage,'a')!})
 assert.equal(s.calls[0].body,first.body);assert.equal((s.calls[0].headers as Record<string,string>)['Idempotency-Key'],id)
 assert.equal(saved.save?.conversationId,conversation);assert.equal(saved.save?.revisionId,revision)
 s.setReplies([]);let verified=0;assert.deepEqual(await saveWebReading({...s.options,fetcher:async(path)=>{verified++;assert.equal(path,`/api/reading/${conversation}/cards`);return new Response(JSON.stringify(s.options.generation.result),{status:200})}}),saved);assert.equal(verified,1)
})
test('missing revision acknowledgement retains durable save intent',async()=>{
 const s=setup();s.setReplies([{status:200,body:{id:conversation}}]);await assert.rejects(saveWebReading(s.options))
 assert.ok(loadWebGeneration(s.options.storage,'a')?.save?.payload);assert.equal(loadWebGeneration(s.options.storage,'a')?.save?.conversationId,undefined)
})
test('write failure blocks save POST and acknowledgement-write failure can be replayed',async()=>{
 const s=setup();s.failWrites(true);await assert.rejects(saveWebReading(s.options));assert.equal(s.calls.length,0)
 s.failWrites(false);const original=s.options.fetcher;s.options.fetcher=async(...args)=>{const response=await original(...args);s.failWrites(true);return response}
 s.setReplies([{status:200,body:{id:conversation,revisionId:revision}}]);await assert.rejects(saveWebReading(s.options));s.failWrites(false)
 assert.equal(loadWebGeneration(s.options.storage,'a')?.save?.conversationId,undefined)
 s.options.fetcher=original;s.setReplies([{status:200,body:{id:conversation,revisionId:revision}}]);assert.equal((await saveWebReading(s.options)).save?.conversationId,conversation)
})
test('owner switch discards late save response and a different owner cannot save this snapshot',async()=>{
 const s=setup(),original=s.options.fetcher;s.options.fetcher=async(...args)=>{const response=await original(...args);s.switchOwner();return response}
 s.setReplies([{status:200,body:{id:conversation,revisionId:revision}}]);await assert.rejects(saveWebReading(s.options));assert.equal(loadWebGeneration(s.options.storage,'a')?.save?.conversationId,undefined)
 const other=setup();await assert.rejects(saveWebReading({...other.options,owner:'b'}));assert.equal(other.calls.length,0)
})
test('401 refresh is bounded and retains save payload and operation',async()=>{
 const s=setup();s.setReplies([{status:401,body:{}},{status:200,body:{id:conversation,revisionId:revision}}]);await saveWebReading(s.options)
 assert.deepEqual(s.refresh,[false,true]);assert.equal(s.calls[0].body,s.calls[1].body)
 const rejected=setup();rejected.setReplies([{status:401,body:{}},{status:401,body:{}}]);await assert.rejects(saveWebReading(rejected.options));assert.equal(rejected.calls.length,2)
})
test('unsaved completed result cannot be replaced by different input',async()=>{
 const s=setup()
 await assert.rejects(recoverWebGeneration({...s.options,input:{birthDate:'2001-01-01'},prepare:async()=>{throw Error('unexpected calculation')},newID:()=>conversation}))
 assert.equal(loadWebGeneration(s.options.storage,'a')?.id,id);assert.equal(s.calls.length,0)
})
test('410 creates tombstone and only next explicit generation starts a new operation',async()=>{
 const s=setup();s.setReplies([{status:410,body:{}}]);await assert.rejects(saveWebReading(s.options));assert.equal(s.calls.length,1)
 assert.equal(loadWebGeneration(s.options.storage,'a')?.save?.deleted,true)
 let requests=0
 const next=await recoverWebGeneration({...s.options,input:s.options.generation.input,prepare:async()=>s.options.generation.payload,newID:()=>conversation,fetcher:async(path)=>{requests++;assert.equal(path,'/api/preview/generate?format=json');return new Response(JSON.stringify(s.options.generation.result),{status:200})}})
 assert.equal(next.id,conversation);assert.equal(requests,1);assert.equal(next.save,undefined)
})
test('tampered stored save payload is retained but never sent',async()=>{
 const s=setup();s.setReplies([{status:503,body:{}}]);await assert.rejects(saveWebReading(s.options))
 const stored=JSON.parse(s.values.get(generationKey('a'))!);stored.save.payload=JSON.stringify({reportText:'different'});s.values.set(generationKey('a'),JSON.stringify(stored))
 s.setReplies([]);await assert.rejects(saveWebReading(s.options));assert.equal(s.calls.length,0);assert.ok(s.values.has(generationKey('a')))
})
test('generation-to-save restart flow never regenerates after an uncertain save',async()=>{
 const s=setup();s.values.clear();const calls:string[]=[];let saves=0
 const fetcher:typeof fetch=async(path)=>{
  calls.push(String(path))
  if(String(path).startsWith('/api/preview/generate?'))return new Response(JSON.stringify(s.options.generation.result),{status:200})
  assert.equal(path,'/api/reading/conversations');saves++
  return new Response(JSON.stringify(saves===1?{}:{id:conversation,revisionId:revision}),{status:saves===1?503:200})
 }
 const options={...s.options,input:s.options.generation.input,prepare:async()=>s.options.generation.payload,newID:()=>id,fetcher}
 const generated=await recoverWebGeneration(options)
 await assert.rejects(saveWebReading({...s.options,generation:generated,fetcher}))
 const restored=await recoverWebGeneration({...options,prepare:async()=>{throw Error('unexpected recalculation')}})
 const saved=await saveWebReading({...s.options,generation:restored,fetcher})
 assert.equal(saved.save?.revisionId,revision)
 assert.deepEqual(calls,['/api/preview/generate?format=json','/api/reading/conversations','/api/reading/conversations'])
})
