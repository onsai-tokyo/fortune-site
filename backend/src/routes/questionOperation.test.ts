import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readingRouter } from './reading.js'
const owner='11111111-1111-4111-8111-111111111111', op='22222222-2222-4222-8222-222222222222'
const saved={answer:'saved answer',suggestions:[],referencedSystems:[],questionId:'q',answerId:'a'}
class ResponseStub extends EventEmitter {
 destroyed=false;writableEnded=false;headersSent=false;statusCode=200;text='';body:any
 status(n:number){this.statusCode=n;return this}
 json(value:any){this.body=value;return this}
 setHeader(){} flushHeaders(){this.headersSent=true}
 write(text:string){this.text+=text;return true}
 end(text=''){this.text+=text;this.writableEnded=true}
}
const wire=[
 {type:'message_start',message:{id:'m',type:'message',role:'assistant',content:[],model:'synthetic',stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}},
 {type:'content_block_start',index:0,content_block:{type:'text',text:''}},
 {type:'content_block_delta',index:0,delta:{type:'text_delta',text:'answer'}},
 {type:'content_block_stop',index:0},
 {type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:1}},
 {type:'message_stop'},
].map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
test('question route replays durable results and never refunds an uncertain completion',async()=>{
 const oldFetch=globalThis.fetch, names=['SUPABASE_URL','SUPABASE_SERVICE_KEY','SUPABASE_ANON_KEY','ANTHROPIC_API_KEY'], old=names.map(n=>process.env[n])
 process.env.SUPABASE_URL='https://synthetic.invalid';names.slice(1).forEach(n=>process.env[n]='synthetic')
 let mode='replay';const calls:string[]=[]
 globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url); calls.push(url.pathname)
  const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
  if(url.pathname.endsWith('/reading_conversations'))return reply({id:op,user_id:owner,birth_data:{},calculated_data:{},report_text:'report'})
  if(url.pathname.endsWith('/stripe_subscriptions'))return reply({subscription_status:'active',current_period_end:null})
  if(url.pathname.endsWith('/app_store_subscriptions'))return reply(null)
  if(url.pathname.endsWith('/begin_reading_question')) return reply(mode==='replay'?{state:'completed',result:saved}:{state:'started'})
  if(url.pathname.endsWith('/reading_messages')){assert.equal(init?.method??'GET','GET');return reply([])}
  if(url.hostname==='api.anthropic.com')return new Response(mode==='incomplete'?wire.replace('\"stop_reason\":\"end_turn\"','\"stop_reason\":null'):wire,{headers:{'Content-Type':'text/event-stream'}})
  if(url.pathname.endsWith('/fail_reading_question'))return reply({state:'failed',code:'QUESTION_FAILED'})
  if(url.pathname.endsWith('/complete_reading_question'))return reply({code:'synthetic_db_response_lost'},503)
  throw Error('Unexpected mutation: '+url.pathname)
 }
 try {
  const route=(readingRouter as any).stack.find((e:any)=>e.route?.path==='/conversations/:id/questions' && e.route.methods.post)
  const handler=route.route.stack.at(-1).handle
  const request={userId:owner,accessToken:'token',params:{id:op},body:{question:'question'},header:()=>op,headers:{}}
  let response=new ResponseStub();await handler(request,response)
  assert.match(response.text,/saved answer/);assert.match(response.text,/\[DONE\]/)
  assert.equal(calls.some(x=>x.includes('complete_reading_question')||x.includes('/v1/messages')),false)
  mode='uncertain';calls.length=0;response=new ResponseStub();await handler(request,response)
  assert.ok(calls.some(x=>x.endsWith('/complete_reading_question')))
  assert.equal(calls.some(x=>x.includes('fail_reading_question')||x.includes('refund')),false)
  assert.match(response.text,/error/)
  mode='incomplete';calls.length=0;response=new ResponseStub();await handler(request,response)
  assert.equal(calls.filter(x=>x.endsWith('/fail_reading_question')).length,1)
  assert.equal(calls.some(x=>x.endsWith('/complete_reading_question')),false)

 } finally {globalThis.fetch=oldFetch;names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i]})}
})

test('chat route maps atomic RPC acknowledgements and never falls back to direct insert',async()=>{
 const oldFetch=globalThis.fetch, oldURL=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_ANON_KEY
 process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_ANON_KEY='synthetic'
 let reply:any={state:'completed',id:op,reused:true};let http=200;let calls=0
 globalThis.fetch=async(input,init)=>{
  assert.ok(String(input).endsWith('/rpc/create_reading_chat'));calls++
  const body=JSON.parse(String(init?.body));assert.equal(body.p_op,op);assert.equal(body.p_source,owner)
  assert.equal(body.p_user,undefined)
  return new Response(JSON.stringify(reply),{status:http,headers:{'Content-Type':'application/json'}})
 }
 try {
  const handler=(readingRouter as any).stack.find((e:any)=>e.route?.path==='/conversations/:id/chat').route.stack.at(-1).handle
  const request={userId:owner,accessToken:'token',params:{id:owner},body:{question:'question'},header:()=>op,headers:{}}
  for(const [data,status,expected] of [[{state:'completed',id:op,reused:true},200,200],[{state:'conflict'},200,409],[{state:'deleted'},200,410],[{},200,503],[{code:'PGRST202'},404,503]] as const) {
   reply=data;http=status;const res=new ResponseStub();await handler(request,res);assert.equal(res.statusCode,expected)
  }
  assert.equal(calls,5)
  const res=new ResponseStub();await handler({...request,header:()=>undefined},res);assert.equal(res.statusCode,400);assert.equal(calls,5)
 } finally {globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldURL;if(oldKey===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=oldKey}
})
