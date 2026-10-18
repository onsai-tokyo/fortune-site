import test from 'node:test'
import assert from 'node:assert/strict'
import { readingSnapshot, saveReadingSnapshot, ReadingSaveError } from './readingRevision.js'
const input={birthData:{date:'2000-01-01'},calculatedData:{score:20},reportText:'body'}
test('saved snapshot keeps complete structured report and declared versions without inventing legacy versions',()=>{
 const report={version:3,reportText:'body',cards:[],generatorVersion:'synthetic-v1',extraEvidence:{id:'e1'}}
 const snapshot=readingSnapshot({...input,structuredReport:report})
 assert.deepEqual((snapshot.calculatedData as Record<string,unknown>)._structuredReport,report)
 assert.equal(snapshot.declaredVersions?.generatorVersion,'synthetic-v1')
 assert.equal(readingSnapshot(input).declaredVersions,null)
 assert.throws(()=>readingSnapshot({...input,structuredReport:{...report,reportText:'other'}}),ReadingSaveError)
})
test('RPC uses operation ID and returns typed conflict, deleted and dependency errors without mutable fallback',async()=>{
 const oldFetch=globalThis.fetch, oldURL=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_ANON_KEY
 process.env.SUPABASE_URL='https://synthetic.invalid'; process.env.SUPABASE_ANON_KEY='synthetic'
 const calls:{url:string;body:any}[]=[]; let reply:any={id:'c1',revisionId:'r1',reused:false}; let status=200
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),body:JSON.parse(String(init?.body))});return new Response(JSON.stringify(reply),{status,headers:{'Content-Type':'application/json'}})}
 try {
  assert.equal((await saveReadingSnapshot('token',readingSnapshot(input),'title','op1')).id,'c1')
  assert.equal(calls[0].body.p_op_id,'op1')
  for(const [body,http,expected] of [[{conflict:true},200,409],[{deleted:true},200,410],[{},200,503],[{code:'PGRST202'},404,503]] as const){
   reply=body;status=http
   await assert.rejects(saveReadingSnapshot('token',readingSnapshot(input),'title','op1'),(e:any)=>e.status===expected)
  }
  assert.ok(calls.every(c=>c.url.endsWith('/rpc/save_reading_revision')))
 } finally {
  globalThis.fetch=oldFetch
  if(oldURL===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=oldURL
  if(oldKey===undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY=oldKey
 }
})
