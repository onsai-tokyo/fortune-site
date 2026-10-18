import test from 'node:test'
import assert from 'node:assert/strict'
import { registrationKey, recoverPartnerRegistration } from './partnerRegistrationRecovery.ts'
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222'
const input={displayName:'A',birthDate:'2000-02-29',birthTime:'',birthplace:'東京',gender:'female' as const,relationshipLabel:'友人'}
const partner={id:id2,display_name:'A',relationship_label:'友人'},done={state:'completed',partner,remaining:1}
function setup(){
 const values=new Map<string,string>(),calls:{path:string;init?:RequestInit}[]=[],refresh:boolean[]=[]
 let replies:{status?:number;body?:unknown}[]=[],epoch=0,fail=false
 const options={owner:'a',input,storage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw Error('storage');values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}},check:()=>{if(epoch)throw Error('owner')},authorize:async(force:boolean)=>{refresh.push(force);return 'token'},newID:()=>id,lock:async<T>(_key:string,work:()=>Promise<T>)=>work(),fetcher:async(path:RequestInfo|URL,init?:RequestInit)=>{calls.push({path:String(path),init});const next=replies.shift();assert.ok(next);return new Response(JSON.stringify(next.body??{}),{status:next.status??200})}}
 return {options,values,calls,refresh,replies:(v:typeof replies)=>{replies=v;calls.length=0},change:()=>{epoch++},fail:()=>{fail=true}}
}
test('lost registration response recovers by owner status without duplicate POST',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverPartnerRegistration(s.options))
 s.replies([{body:done}]);assert.deepEqual(await recoverPartnerRegistration({...s.options,input:undefined}),partner);assert.deepEqual(s.calls.map(c=>c.init?.method),['GET']);assert.equal(s.calls[0].path,`/api/partners/registration/operations/${id}`)
 s.replies([{body:done}]);await recoverPartnerRegistration({...s.options,input:undefined});assert.equal(s.calls.length,1)
})
test('not_found retries identical payload and key; unknown state never posts',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverPartnerRegistration(s.options));const original=s.calls[0].init
 s.replies([{body:{state:'unknown'}}]);await assert.rejects(recoverPartnerRegistration(s.options));assert.equal(s.calls.length,1)
 s.replies([{body:{state:'not_found'}},{body:{partner,remaining:1}}]);await recoverPartnerRegistration(s.options)
 assert.equal(s.calls[1].path,'/api/partners');assert.equal(s.calls[1].init?.body,original?.body);assert.deepEqual(s.calls[1].init?.headers,original?.headers)
})
test('changed or corrupted pending data never overwrites uncertain registration',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverPartnerRegistration(s.options));const original=s.values.get(registrationKey('a'));s.replies([])
 await assert.rejects(recoverPartnerRegistration({...s.options,input:{...input,displayName:'B'}}));assert.equal(s.values.get(registrationKey('a')),original);assert.equal(s.calls.length,0)
 s.values.set(registrationKey('a'),'broken');await assert.rejects(recoverPartnerRegistration(s.options));assert.equal(s.values.get(registrationKey('a')),'broken')
})
test('401 refresh only once and uncertain errors retain operation',async()=>{
 const s=setup();s.replies([{status:401},{status:401}]);await assert.rejects(recoverPartnerRegistration(s.options));assert.deepEqual(s.refresh,[false,true]);assert.equal(s.calls[0].init?.body,s.calls[1].init?.body)
 for(const status of [400,409,410,503]){s.replies([{status}]);await assert.rejects(recoverPartnerRegistration(s.options));assert.equal(s.values.size,1)}
})
test('release requires completed or deleted status and cannot discard not_found',async()=>{
 for(const state of ['completed','deleted','cancelled']){
  const s=setup();s.replies([{status:503}]);await assert.rejects(recoverPartnerRegistration(s.options));s.replies([{body:{...done,state}}]);await recoverPartnerRegistration({...s.options,input:undefined,release:true});assert.equal(s.values.size,0);assert.equal(s.calls[0].init?.method,'GET')
 }
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverPartnerRegistration(s.options));s.replies([{body:{state:'not_found'}},{body:{state:'unknown'}}]);await assert.rejects(recoverPartnerRegistration({...s.options,release:true}));assert.equal(s.values.size,1);assert.equal(s.calls.length,2)
})
test('invalid dates and times fail before storage or network, unknown time remains empty',async()=>{
 const s=setup()
 for(const change of [{birthDate:'1900-02-29'},{birthDate:'2000-04-31'},{birthTime:'24:00'},{birthTime:'12:60'},{relationshipLabel:'invalid'}]) await assert.rejects(recoverPartnerRegistration({...s.options,input:{...input,...change}}))
 assert.equal(s.values.size,0);assert.equal(s.calls.length,0)
 s.replies([{body:{partner}}]);await recoverPartnerRegistration(s.options);assert.equal(JSON.parse(String(s.calls[0].init?.body)).birthTime,'')
})
test('storage and owner boundaries stop late private results and preserve other owners',async()=>{
 const s=setup();s.fail();await assert.rejects(recoverPartnerRegistration(s.options));assert.equal(s.calls.length,0)
 const t=setup();t.values.set(registrationKey('b'),'private');await assert.rejects(recoverPartnerRegistration({...t.options,fetcher:async()=>{t.change();return new Response(JSON.stringify({partner}))}}),/owner/);assert.equal(t.values.get(registrationKey('b')),'private')
})
test('parallel callers under the owner lock register once',async()=>{
 const s=setup();let tail=Promise.resolve()
 const lock=async<T>(key:string,work:()=>Promise<T>)=>{assert.equal(key,registrationKey('a'));const prior=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve});await prior;try{return await work()}finally{release()}}
 s.replies([{body:{partner}},{body:done}]);assert.deepEqual(await Promise.all([recoverPartnerRegistration({...s.options,lock}),recoverPartnerRegistration({...s.options,lock})]),[partner,partner]);assert.deepEqual(s.calls.map(c=>c.init?.method),['POST','GET'])
})
test('malformed completion and operation replacement are never cleared',async()=>{
 const s=setup();s.replies([{body:{partner:{id:'bad',display_name:'A'}}}]);await assert.rejects(recoverPartnerRegistration(s.options));assert.equal(s.values.size,1)
 const replacement=JSON.stringify({version:1,id:id2,payload:JSON.stringify(input)})
 await assert.rejects(recoverPartnerRegistration({...s.options,release:true,fetcher:async()=>{s.values.set(registrationKey('a'),replacement);return new Response(JSON.stringify(done))}}));assert.equal(s.values.get(registrationKey('a')),replacement)
})
test('unregistered release awaits cancellation acknowledgement before clearing',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverPartnerRegistration(s.options))
 s.replies([{body:{state:'not_found'}},{body:{state:'cancelled'}}]);assert.equal(await recoverPartnerRegistration({...s.options,release:true}),null);assert.equal(s.values.size,0)
 assert.deepEqual(s.calls.map(c=>c.init?.method),['GET','POST']);assert.equal(s.calls[1].path,`/api/partners/registration/operations/${id}/cancel`);assert.equal(s.calls[1].init?.body,'{}')
})
test('lost cancel reply retains input and recovers using GET only',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverPartnerRegistration(s.options))
 s.replies([{body:{state:'not_found'}},{status:503}]);await assert.rejects(recoverPartnerRegistration({...s.options,release:true}));assert.equal(s.values.size,1)
 s.replies([{body:{state:'cancelled'}}]);await recoverPartnerRegistration({...s.options,release:true});assert.equal(s.values.size,0);assert.equal(s.calls.length,1)
})
test('registration winning cancel is returned intact without another registration',async()=>{
 const s=setup();s.replies([{status:503}]);await assert.rejects(recoverPartnerRegistration(s.options))
 s.replies([{body:{state:'not_found'}},{body:done}]);assert.deepEqual(await recoverPartnerRegistration({...s.options,release:true}),partner);assert.equal(s.values.size,0);assert.equal(s.calls.length,2)
})
