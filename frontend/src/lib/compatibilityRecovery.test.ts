import test from 'node:test'
import assert from 'node:assert/strict'
import { compatibilityKey, recoverCompatibility } from './compatibilityRecovery.ts'
const id='11111111-1111-4111-8111-111111111111',partnerId='22222222-2222-4222-8222-222222222222'
const input={partnerId,conversationId:id,relationshipType:'friend',relationshipLabel:'友人'}
const report={version:3,reportText:'report',cards:[{id:'card'}]},completed={state:'completed',result:report,conversationId:id}
function setup(){
 const values=new Map<string,string>(),calls:RequestInit[]=[],refresh:boolean[]=[]
 let replies:{status?:number;body?:unknown}[]=[],changed=false,failWrite=false
 const options={owner:'a',input,storage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(failWrite)throw Error('disk');values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}},check:()=>{if(changed)throw Error('owner')},authorize:async(force:boolean)=>{refresh.push(force);return 'token'},newID:()=>id,lock:async<T>(_name:string,work:()=>Promise<T>)=>work(),fetcher:async(_path:RequestInfo|URL,init?:RequestInit)=>{calls.push(init!);const r=replies.shift();assert.ok(r);return new Response(JSON.stringify(r.body??{}),{status:r.status??200})}}
 return {options,values,calls,refresh,replies:(r:typeof replies)=>{replies=r;calls.length=0},change:()=>{changed=true},failWrite:()=>{failWrite=true}}
}
test('lost response recovers using GET without another charge request',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options))
 s.replies([{body:completed}]);assert.equal(await recoverCompatibility(s.options),id);assert.deepEqual(s.calls.map(c=>c.method),['GET'])
 s.replies([{body:completed}]);await recoverCompatibility(s.options);assert.equal(s.calls[0].method,'GET')
})
test('not_found reuses exact operation and input; pending and unknown never POST',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options));const original=s.calls[0]
 for(const state of ['pending','unexpected']){s.replies([{body:{state}}]);await assert.rejects(recoverCompatibility(s.options));assert.equal(s.calls.length,1)}
 s.replies([{body:{state:'not_found'}},{body:{...report,conversationId:id}}]);await recoverCompatibility(s.options)
 assert.equal(s.calls[1].body,original.body);assert.deepEqual(s.calls[1].headers,original.headers)
})
test('changed inputs and damaged cache cannot overwrite reservation',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options));s.replies([])
 await assert.rejects(recoverCompatibility({...s.options,input:{...input,relationshipLabel:'親友'}}));assert.equal(s.calls.length,0)
 s.values.set(compatibilityKey('a'),'broken');await assert.rejects(recoverCompatibility(s.options));assert.equal(s.values.get(compatibilityKey('a')),'broken')
})
test('failed/deleted clear only after GET and require next explicit action',async()=>{
 for(const state of ['failed','deleted']){const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options));s.replies([{body:{state}}]);await assert.rejects(recoverCompatibility(s.options));assert.equal(s.calls.length,1);assert.equal(s.values.size,0)}
})
test('401 refresh once preserves operation and payload',async()=>{
 const s=setup();s.replies([{status:401},{status:401}]);await assert.rejects(recoverCompatibility(s.options));assert.deepEqual(s.refresh,[false,true]);assert.equal(s.calls[0].body,s.calls[1].body);assert.equal(s.values.size,1)
})
test('write failure stops POST; owner change after auth stops network',async()=>{
 const s=setup();s.failWrite();await assert.rejects(recoverCompatibility(s.options));assert.equal(s.calls.length,0)
 const t=setup();await assert.rejects(recoverCompatibility({...t.options,authorize:async()=>{t.change();return 'token'}}));assert.equal(t.calls.length,0)
})
test('partial completion is retained for later status recovery',async()=>{
 const s=setup();s.replies([{body:{...report,cards:[],conversationId:id}}]);await assert.rejects(recoverCompatibility(s.options));assert.equal(s.values.size,1)
 s.replies([{body:completed}]);assert.equal(await recoverCompatibility(s.options),id)
})
test('other owner cache remains untouched and lock is owner scoped',async()=>{
 const s=setup();s.values.set(compatibilityKey('b'),'untouched');s.replies([{body:{...report,conversationId:id}}]);let lockName=''
 await recoverCompatibility({...s.options,lock:async(_name,work)=>{lockName=_name;return work()}})
 assert.equal(lockName,compatibilityKey('a'));assert.equal(s.values.get(compatibilityKey('b')),'untouched')
})
test('late response after account change cannot return a private reading',async()=>{
 const s=setup();await assert.rejects(recoverCompatibility({...s.options,fetcher:async()=>{s.change();return new Response(JSON.stringify({...report,conversationId:id}))}}),/owner/)
 assert.equal(s.values.size,1)
})
test('shared exclusive lock makes a concurrent caller inspect the first operation',async()=>{
 const s=setup();let tail=Promise.resolve()
 const lock=async<T>(_name:string,work:()=>Promise<T>)=>{const prior=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve});await prior;try{return await work()}finally{release()}}
 s.replies([{body:{...report,conversationId:id}},{body:completed}])
 assert.deepEqual(await Promise.all([recoverCompatibility({...s.options,lock}),recoverCompatibility({...s.options,lock})]),[id,id])
 assert.deepEqual(s.calls.map(c=>c.method),['POST','GET'])
})
test('explicit new-input action releases only confirmed terminal operations, without POST',async()=>{
 for(const state of ['completed','failed','deleted']){
  const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options))
  s.replies([{body:{...completed,state}}]);await recoverCompatibility({...s.options,releaseCheckedOperation:true})
  assert.equal(s.values.size,0);assert.deepEqual(s.calls.map(c=>c.method),['GET'])
 }
})
test('new-input action preserves pending, unknown, and malformed completion',async()=>{
 for(const body of [{state:'pending'},{state:'unknown'},{...completed,result:{...report,cards:[]}}]){
  const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options));const saved=s.values.get(compatibilityKey('a'))
  s.replies([{body}]);await assert.rejects(recoverCompatibility({...s.options,releaseCheckedOperation:true}))
  assert.equal(s.values.get(compatibilityKey('a')),saved);assert.deepEqual(s.calls.map(c=>c.method),['GET'])
 }
})
test('clear response cannot remove an operation replaced during its request',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options))
 const replacement=JSON.stringify({version:1,id:partnerId,input})
 await assert.rejects(recoverCompatibility({...s.options,releaseCheckedOperation:true,fetcher:async()=>{s.values.set(compatibilityKey('a'),replacement);return new Response(JSON.stringify(completed))}}))
 assert.equal(s.values.get(compatibilityKey('a')),replacement)
})
test('clearing an absent operation does not reserve or generate',async()=>{
 const s=setup();assert.equal(await recoverCompatibility({...s.options,releaseCheckedOperation:true}),'');assert.equal(s.values.size,0);assert.equal(s.calls.length,0)
})
test('not_found is released only after server cancellation acknowledgement',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options))
 s.replies([{body:{state:'not_found'}},{body:{state:'failed'}}]);await recoverCompatibility({...s.options,releaseCheckedOperation:true})
 assert.equal(s.values.size,0);assert.deepEqual(s.calls.map(c=>c.method),['GET','POST']);assert.equal(s.calls[1].body,'{}')
})
test('lost cancellation reply retains operation and is recovered by status only',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options))
 s.replies([{body:{state:'not_found'}},{status:503}]);await assert.rejects(recoverCompatibility({...s.options,releaseCheckedOperation:true}));assert.equal(s.values.size,1)
 s.replies([{body:{state:'failed'}}]);await recoverCompatibility({...s.options,releaseCheckedOperation:true});assert.equal(s.values.size,0);assert.equal(s.calls.length,1)
})
test('a delayed begin winning cancellation preserves pending and does not regenerate',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverCompatibility(s.options))
 s.replies([{body:{state:'not_found'}},{body:{state:'pending'}}]);await assert.rejects(recoverCompatibility({...s.options,releaseCheckedOperation:true}));assert.equal(s.values.size,1);assert.equal(s.calls.length,2)
})
