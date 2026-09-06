import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { partnersRouter } from './partners.js'
class ResponseStub extends EventEmitter {
 destroyed=false;writableEnded=false;headersSent=false;statusCode=200;text='';body:any;disconnect=false
 status(n:number){this.statusCode=n;return this}
 json(value:any){this.body=value;return this}
 setHeader(){} flushHeaders(){this.headersSent=true}
 write(text:string){this.text+=text;if(this.disconnect){this.destroyed=true;this.emit('close')}return true}
 end(text=''){this.text+=text;this.writableEnded=true}
}
test('compatibility route uses one reservation and atomic completion, including disconnect and unknown commit',async()=>{
 const names=['SUPABASE_URL','SUPABASE_SERVICE_KEY','SUPABASE_ANON_KEY','ANTHROPIC_API_KEY','DETERMINISTIC_SCOPE'],old=names.map(n=>process.env[n]),oldFetch=globalThis.fetch
 process.env.SUPABASE_URL='https://synthetic.invalid';names.slice(1).forEach(n=>process.env[n]='synthetic');process.env.DETERMINISTIC_SCOPE='compatibility'
 const owner='11111111-1111-4111-8111-111111111111',op='22222222-2222-4222-8222-222222222222',partnerID='33333333-3333-4333-8333-333333333333'
 const done={state:'completed',result:{version:3,reportText:'saved',cards:[{id:'synthetic'}]},conversationId:op,revisionId:op}
 const input={self:{birth_data:{birthDate:'1990-01-01',gender:'female',birthplace:'東京都'},calculated_data:{shichuDay:'癸卯',lifePathNumber:1,sukuyo:'角宿',nayin:'澗下水',sanmeiStar:'鳳閣星',chusatsu:'申酉天中殺',honmeiName:'五黄土星'}},partner:{id:partnerID,birth_date:'2000-01-01',birthplace:'東京都',gender:'female',display_name:'synthetic'}}
 let mode='replay';const calls:{path:string,body:any}[]=[]
 globalThis.fetch=async(url,init)=>{
  const path=new URL(String(url)).pathname,body=init?.body?JSON.parse(String(init.body)):{};calls.push({path,body})
  const response=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
  if(path.endsWith('/get_compatibility_operation')){assert.equal(body.p_user,owner);return response(mode==='replay'?done:{state:'not_found'})}
  if(path.endsWith('/stripe_subscriptions')||path.endsWith('/app_store_subscriptions'))return response(mode==='premium_unknown'?{message:'unavailable'}:null,mode==='premium_unknown'?503:200)
  if(path.endsWith('/begin_compatibility_operation')){assert.equal(body.p_user,owner);assert.equal(body.p_partner,partnerID);return response(mode==='replay'?done:mode==='pending'?{state:'pending'}:mode==='insufficient'?{state:'insufficient_points'}:{state:'started',input:mode==='failure'?{...input,partner:{...input.partner,birth_date:'invalid'}}:input})}
  if(path.endsWith('/complete_compatibility_operation')){assert.ok(body.p_payload.calculatedData._structuredReport.cards.length);assert.equal(body.p_op,op);return response({...done,result:body.p_payload.calculatedData._structuredReport},mode==='uncertain'?503:200)}
  if(path.endsWith('/fail_compatibility_operation'))return response({state:'failed'})
  throw Error('Unexpected network/points operation '+path)
 }
 try{
  const handler=(partnersRouter as any).stack.find((e:any)=>e.route?.path==='/:id/compatibility').route.stack.at(-1).handle
  const req={userId:owner,accessToken:'token',header:()=>op,params:{id:partnerID},body:{conversationId:op,relationshipType:'friend',relationshipLabel:'友人'},query:{format:'sse'},headers:{}}
  let res=new ResponseStub();await handler(req,res);assert.match(res.text,/saved/);assert.equal(calls.length,2)
  for(const [next,code] of [['pending',409],['insufficient',402],['premium_unknown',503]] as const){mode=next;calls.length=0;res=new ResponseStub();await handler(req,res);assert.equal(res.statusCode,code);assert.ok(!calls.some(x=>x.path.includes('complete_')||x.path.includes('fail_')))}
  mode='disconnect';calls.length=0;res=new ResponseStub();res.disconnect=true;await handler(req,res);assert.ok(calls.some(x=>x.path.endsWith('/complete_compatibility_operation')));assert.ok(!calls.some(x=>x.path.includes('fail_')));assert.doesNotMatch(res.text,/"type":"complete"/)
  mode='uncertain';calls.length=0;res=new ResponseStub();await handler(req,res);assert.ok(calls.some(x=>x.path.endsWith('/complete_compatibility_operation')));assert.ok(!calls.some(x=>x.path.includes('fail_')));assert.doesNotMatch(res.text,/"type":"complete"/)
  mode='failure';calls.length=0;res=new ResponseStub();await handler(req,res);assert.equal(calls.filter(x=>x.path.endsWith('/fail_compatibility_operation')).length,1);assert.ok(!calls.some(x=>x.path.includes('complete_')))
 }finally{globalThis.fetch=oldFetch;names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i]})}
})


test('compatibility acknowledgements reject incomplete or malformed persisted identities',async()=>{
 const {compatibilityRPC}=await import('../lib/compatibilityOperation.js')
 const id='22222222-2222-4222-8222-222222222222'
 const valid={state:'completed',result:{version:3,reportText:'body',cards:[{id:'synthetic'}]},conversationId:id,revisionId:id}
 for(const data of [null,{}, {...valid,conversationId:12},{...valid,revisionId:'bad'},{...valid,result:{...valid.result,cards:[]}}]) {
   await assert.rejects(compatibilityRPC('complete_compatibility_operation',{}, {rpc:async()=>({data,error:null})}))
 }
 assert.deepEqual(await compatibilityRPC('complete_compatibility_operation',{}, {rpc:async()=>({data:valid,error:null})}),valid)
})

test('cancel route derives owner from authentication and fails closed on dependency errors',async()=>{
 const names=['SUPABASE_URL','SUPABASE_SERVICE_KEY'],old=names.map(n=>process.env[n]),oldFetch=globalThis.fetch
 process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='synthetic'
 const id='22222222-2222-4222-8222-222222222222';let calls=0,unavailable=false
 globalThis.fetch=async(url,init)=>{
  calls++;assert.ok(String(url).endsWith('/rpc/cancel_unstarted_compatibility_operation'))
  assert.deepEqual(JSON.parse(String(init?.body)),{p_user:id,p_op:id})
  return new Response(JSON.stringify(unavailable?{message:'unavailable'}:{state:'failed'}),{status:unavailable?503:200,headers:{'Content-Type':'application/json'}})
 }
 try {
  const handler=(partnersRouter as any).stack.find((e:any)=>e.route?.path==='/compatibility/operations/:opId/cancel').route.stack.at(-1).handle
  let res=new ResponseStub();await handler({userId:id,params:{opId:'invalid'},body:{userId:'foreign'}},res);assert.equal(res.statusCode,400);assert.equal(calls,0)
  res=new ResponseStub();await handler({userId:id,params:{opId:id},body:{userId:'foreign'}},res);assert.deepEqual(res.body,{state:'failed'})
  unavailable=true;res=new ResponseStub();await handler({userId:id,params:{opId:id}},res);assert.equal(res.statusCode,503)
 }finally{globalThis.fetch=oldFetch;names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})

test('partner registration validates input, reuses client operation and keeps uncertain writes recoverable',async()=>{
 const names=['SUPABASE_URL','SUPABASE_SERVICE_KEY'],old=names.map(n=>process.env[n]),oldFetch=globalThis.fetch
 process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='synthetic'
 const id='22222222-2222-4222-8222-222222222222';let calls=0,state='completed',unavailable=false
 globalThis.fetch=async(url,init)=>{
  calls++;const body=JSON.parse(String(init?.body));assert.equal(body.p_user,id);assert.equal(body.p_op,id)
  const path=new URL(String(url)).pathname;assert.ok(['/rest/v1/rpc/register_partner_operation','/rest/v1/rpc/get_partner_registration_operation'].includes(path))
  if(path.endsWith('/register_partner_operation')) {assert.equal(body.p_profile.birth_time,null);assert.equal(body.p_profile.display_name,'A');assert.equal(body.p_profile.user_id,undefined)}
  return new Response(JSON.stringify(unavailable?{message:'unavailable'}:state==='completed'?{state,partner:{id,display_name:'A'},remaining:1}:{state}),{status:unavailable?503:200,headers:{'Content-Type':'application/json'}})
 }
 try {
  const stack=(partnersRouter as any).stack
  const handler=stack.find((e:any)=>e.route?.path==='/'&&e.route.methods.post).route.stack.at(-1).handle
  const status=stack.find((e:any)=>e.route?.path==='/registration/operations/:opId').route.stack.at(-1).handle
  const req={userId:id,header:()=>id,body:{displayName:'A',birthDate:'2000-02-29',birthplace:'東京',gender:'female',user_id:'foreign'}}
  let res=new ResponseStub();await handler({...req,body:{...req.body,birthDate:'2000-02-30'}},res);assert.equal(res.statusCode,400);assert.equal(calls,0)
  res=new ResponseStub();await handler(req,res);assert.equal(res.statusCode,201);assert.equal(res.body.partner.id,id)
  for(const [next,code] of [['limit',409],['conflict',409],['deleted',410]] as const){state=next;res=new ResponseStub();await handler(req,res);assert.equal(res.statusCode,code)}
  state='completed';res=new ResponseStub();await status({userId:id,params:{opId:id}},res);assert.equal(res.body.state,'completed')
  unavailable=true;res=new ResponseStub();await handler(req,res);assert.equal(res.statusCode,503)
 }finally{globalThis.fetch=oldFetch;names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})

test('registration cancel route scopes owner and rejects unavailable acknowledgements',async()=>{
 const names=['SUPABASE_URL','SUPABASE_SERVICE_KEY'],old=names.map(n=>process.env[n]),oldFetch=globalThis.fetch
 process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='synthetic'
 const id='22222222-2222-4222-8222-222222222222';let unavailable=false,calls=0
 globalThis.fetch=async(url,init)=>{
  calls++;assert.ok(String(url).endsWith('/rpc/cancel_partner_registration_operation'));assert.deepEqual(JSON.parse(String(init?.body)),{p_user:id,p_op:id})
  return new Response(JSON.stringify(unavailable?{message:'unavailable'}:{state:'cancelled'}),{status:unavailable?503:200,headers:{'Content-Type':'application/json'}})
 }
 try{
  const handler=(partnersRouter as any).stack.find((e:any)=>e.route?.path==='/registration/operations/:opId/cancel').route.stack.at(-1).handle
  let res=new ResponseStub();await handler({userId:id,params:{opId:'bad'}},res);assert.equal(res.statusCode,400);assert.equal(calls,0)
  res=new ResponseStub();await handler({userId:id,params:{opId:id},body:{userId:'foreign'}},res);assert.deepEqual(res.body,{state:'cancelled'})
  unavailable=true;res=new ResponseStub();await handler({userId:id,params:{opId:id}},res);assert.equal(res.statusCode,503)
 }finally{globalThis.fetch=oldFetch;names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})

test('partner deletion validates identity and restricts deletion to authenticated owner',async()=>{
 const names=['SUPABASE_URL','SUPABASE_SERVICE_KEY'],old=names.map(n=>process.env[n]),oldFetch=globalThis.fetch
 process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='synthetic'
 const id='22222222-2222-4222-8222-222222222222',owner='11111111-1111-4111-8111-111111111111';let calls=0,failed=false
 globalThis.fetch=async(url,init)=>{
  calls++;const parsed=new URL(String(url));assert.equal(parsed.pathname,'/rest/v1/partner_profiles');assert.equal(init?.method,'DELETE');assert.equal(parsed.searchParams.get('id'),`eq.${id}`);assert.equal(parsed.searchParams.get('user_id'),`eq.${owner}`)
  return failed?new Response(JSON.stringify({message:'unavailable'}),{status:503,headers:{'Content-Type':'application/json'}}):new Response(null,{status:204})
 }
 try{
  const handler=(partnersRouter as any).stack.find((e:any)=>e.route?.path==='/:id'&&e.route.methods.delete).route.stack.at(-1).handle
  let res=new ResponseStub();await handler({userId:owner,params:{id:'bad'}},res);assert.equal(res.statusCode,400);assert.equal(calls,0)
  res=new ResponseStub();await handler({userId:owner,params:{id},body:{userId:'foreign'}},res);assert.equal(res.statusCode,204)
  failed=true;res=new ResponseStub();await handler({userId:owner,params:{id}},res);assert.equal(res.statusCode,500)
 }finally{globalThis.fetch=oldFetch;names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})
