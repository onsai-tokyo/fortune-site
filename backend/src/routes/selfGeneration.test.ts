import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { previewRouter } from './preview.js'
class ResponseStub extends EventEmitter {
 destroyed=false;writableEnded=false;headersSent=false;statusCode=200;text='';body:any;disconnect=false
 status(n:number){this.statusCode=n;return this}
 json(value:any){this.body=value;return this}
 setHeader(){} flushHeaders(){this.headersSent=true}
 write(text:string){this.text+=text;if(this.disconnect){this.destroyed=true;this.emit('close')}return true}
 end(text=''){this.text+=text;this.writableEnded=true}
}
test('self generation replays and persists after disconnect without failing uncertain completion',async()=>{
 const oldFetch=globalThis.fetch,names=['SUPABASE_URL','SUPABASE_SERVICE_KEY','AI_REPORT_ENABLED'],old=names.map(n=>process.env[n])
 process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='synthetic';process.env.AI_REPORT_ENABLED='false'
 const owner='11111111-1111-4111-8111-111111111111',op='22222222-2222-4222-8222-222222222222'
 let mode='replay';const calls:{path:string,body:any}[]=[]
 globalThis.fetch=async(input,init)=>{
  const path=new URL(String(input)).pathname,body=JSON.parse(String(init?.body));calls.push({path,body});assert.equal(body.p_user,owner)
  let data:any
  if(path.endsWith('/begin_self_generation'))data=mode==='replay'?{state:'completed',result:{version:3,reportText:'saved',cards:[]}}:{state:mode==='pending'?'pending':'started'}
  else if(path.endsWith('/settle_self_generation')){assert.ok(body.p_result?.reportText);assert.ok(body.p_result.cards.length);data={state:'completed',result:body.p_result}}
  else throw Error('Unexpected request '+path)
  return new Response(JSON.stringify(data),{status:mode==='uncertain'&&path.endsWith('/settle_self_generation')?503:200,headers:{'Content-Type':'application/json'}})
 }
 try{
  const handler=(previewRouter as any).stack.find((e:any)=>e.route?.path==='/generate').route.stack.at(-1).handle
  const request={userId:owner,header:()=>op,query:{format:'sse'},body:{birthDate:'2000-01-01',gender:'female',birthplace:'東京都',birthTime:''},headers:{}}
  let res=new ResponseStub();await handler(request,res);assert.match(res.text,/saved/);assert.match(res.text,/\[DONE\]/);assert.equal(calls.length,1)
  mode='pending';calls.length=0;res=new ResponseStub();await handler(request,res);assert.equal(res.statusCode,409);assert.equal(calls.length,1)
  mode='disconnect';calls.length=0;res=new ResponseStub();res.disconnect=true;await handler(request,res);assert.equal(calls.length,2);assert.ok(res.destroyed);assert.doesNotMatch(res.text,/"type":"complete"/)
  mode='uncertain';calls.length=0;res=new ResponseStub();await handler(request,res);assert.equal(calls.length,2);assert.doesNotMatch(res.text,/"type":"complete"/)
 }finally{globalThis.fetch=oldFetch;names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i]})}
})
