import test from 'node:test'
import assert from 'node:assert/strict'
import {deletePartner,deletionKey} from './partnerDeletion.ts'
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222'
const partner={id,display_name:'A'},other={id:id2,display_name:'B'}
function setup(){
 const values=new Map<string,string>(),calls:{path:string;method?:string}[]=[],refresh:boolean[]=[],locks:string[]=[]
 let replies:{status?:number;partners?:unknown;lost?:boolean}[]=[],changed=false,fail=false
 const options={owner:'a',partner,confirmed:true,storage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw Error('storage');values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}},check:()=>{if(changed)throw Error('owner')},authorize:async(force:boolean)=>{refresh.push(force);return 'token'},lock:async<T>(key:string,work:()=>Promise<T>)=>{locks.push(key);return work()},fetcher:async(path:RequestInfo|URL,init?:RequestInit)=>{calls.push({path:String(path),method:init?.method});const r=replies.shift();assert.ok(r);if(r.lost)throw Error('lost');return new Response(r.status===204?null:JSON.stringify({partners:r.partners}),{status:r.status??200})}}
 return{options,values,calls,refresh,locks,replies:(v:typeof replies)=>{replies=v;calls.length=0},change:()=>{changed=true},fail:()=>{fail=true}}
}
test('delete confirms absence before clearing and preserves other owner data',async()=>{
 const s=setup();s.values.set(deletionKey('b'),'private');s.replies([{partners:[partner,other]},{status:204},{partners:[other]}])
 assert.deepEqual(await deletePartner(s.options),[other]);assert.deepEqual(s.calls.map(c=>c.method),['GET','DELETE','GET']);assert.equal(s.calls[1].path,`/api/partners/${id}`);assert.equal(s.values.get(deletionKey('a')),undefined);assert.equal(s.values.get(deletionKey('b')),'private')
 assert.deepEqual(s.locks,['fatelab:compatibility:v1:a','fatelab:partner-registration:v1:a'])
})
test('lost DELETE response is resolved by GET without another DELETE',async()=>{
 const s=setup();s.replies([{partners:[partner]},{lost:true},{partners:[]}]);assert.deepEqual(await deletePartner(s.options),[]);assert.equal(s.calls.filter(c=>c.method==='DELETE').length,1)
})
test('uncertain verification is retained across restart and read-only recovery',async()=>{
 const s=setup();s.replies([{partners:[partner]},{status:204},{status:503}]);await assert.rejects(deletePartner(s.options));assert.equal(s.values.size,1)
 s.replies([{partners:[]}]);await deletePartner({...s.options,partner:undefined,confirmed:false});assert.equal(s.values.size,0);assert.deepEqual(s.calls.map(c=>c.method),['GET'])
})
test('present target is not erased on failed DELETE or read-only recovery',async()=>{
 const s=setup();s.replies([{partners:[partner]},{status:500},{partners:[partner]}]);await assert.rejects(deletePartner(s.options));assert.equal(s.values.size,1)
 s.replies([{partners:[partner]}]);await assert.rejects(deletePartner({...s.options,confirmed:false}));assert.equal(s.calls.length,1)
 s.replies([]);await assert.rejects(deletePartner({...s.options,partner:other}));assert.equal(s.calls.length,0)
})
test('absence before retry needs no DELETE; malformed list cannot mean deletion',async()=>{
 const s=setup();s.replies([{partners:[{id:'bad',display_name:'A'}]}]);await assert.rejects(deletePartner(s.options));assert.equal(s.values.size,1)
 s.replies([{partners:[]}]);await deletePartner(s.options);assert.equal(s.calls.length,1);assert.equal(s.values.size,0)
})
test('401 refresh is bounded; storage and owner failures stop work',async()=>{
 const s=setup();s.replies([{status:401},{status:401}]);await assert.rejects(deletePartner(s.options));assert.deepEqual(s.refresh,[false,true]);assert.equal(s.values.size,1)
 const t=setup();t.fail();await assert.rejects(deletePartner(t.options));assert.equal(t.calls.length,0)
 const u=setup();await assert.rejects(deletePartner({...u.options,fetcher:async()=>{u.change();return new Response(JSON.stringify({partners:[]}))}}),/owner/);assert.equal(u.values.size,1)
})
test('corrupt deletion data and operation replacement are preserved',async()=>{
 const s=setup();s.values.set(deletionKey('a'),'broken');await assert.rejects(deletePartner(s.options));assert.equal(s.values.get(deletionKey('a')),'broken')
 const t=setup(),replacement=JSON.stringify({version:1,partner:other});await assert.rejects(deletePartner({...t.options,fetcher:async()=>{t.values.set(deletionKey('a'),replacement);return new Response(JSON.stringify({partners:[]}))}}));assert.equal(t.values.get(deletionKey('a')),replacement)
})
test('without a prior target or confirmation no deletion operation starts',async()=>{
 const s=setup();await assert.rejects(deletePartner({...s.options,confirmed:false}));assert.equal(s.values.size,0);assert.equal(s.calls.length,0)
})
