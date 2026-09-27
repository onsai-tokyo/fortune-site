/** Local Express -> actual PostgREST/PostgreSQL -> actual worker integration.
 * Apple payloads and AI HTTP responses are synthetic; no live services or credentials.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import express from 'express'
import jwt from 'jsonwebtoken'
import { aiBooksRouter } from '../routes/aiBooks.js'
import { grantVerifiedBookPurchase, BOOK_PRODUCT } from '../lib/aiBooks.js'

const rest=process.env.BOOK_TEST_REST!
assert.match(rest,/^http:\/\/127\.0\.0\.1:\d+$/)
const secret='synthetic-only-local-postgrest-test-secret'
const owner='33333333-3333-4333-8333-333333333333', other='44444444-4444-4444-8444-444444444444'
const token=(role:string,user?:string)=>jwt.sign({role,sub:user,aud:'authenticated',iss:'http://127.0.0.1/auth/v1'},secret,{expiresIn:600})
const nativeFetch=globalThis.fetch
const headers={authorization:'Bearer '+token('service_role'),'Content-Type':'application/json'}
async function result(r:Response,status=200):Promise<any>{const body=await r.text();assert.equal(r.status,status,body);return body?JSON.parse(body):null}
async function db(path:string,method='GET',body?:unknown,status=200){return result(await nativeFetch(rest+'/'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),status)}
async function rpc(name:string,body:unknown={}){return db('rpc/'+name,'POST',body)}
const bridge=express();bridge.use(express.json())
let aiMode:'valid'|'bad-quote'='valid',aiCalls=0,loseOrderAck=false
bridge.all('/rest/v1/*',async(req,res)=>{
  const response=await nativeFetch(rest+req.originalUrl.slice('/rest/v1'.length),{method:req.method,headers:{...headers,...(req.header('accept')?{accept:req.header('accept')!}:{}),...(req.header('prefer')?{prefer:req.header('prefer')!}:{})},...(['GET','HEAD'].includes(req.method)?{}:{body:JSON.stringify(req.body)})})
  const body=await response.text()
  if(loseOrderAck&&req.path.endsWith('/rpc/ai_book_order')&&response.ok){loseOrderAck=false;res.status(503).json({message:'synthetic lost acknowledgement'});return}
  res.status(response.status).type(response.headers.get('content-type')??'application/json').send(body)
})
bridge.post('/v1/messages',(req,res)=>{
  aiCalls++
  const {sources}=JSON.parse(req.body.messages[0].content)
  const line='資料に書かれた傾向を踏まえて、考えを整理し、無理のない範囲で相手と相談することが助けになります。'
  const doc={title:'相談の整理と伝え方を考える',summary:line,answer:line.repeat(34),sections:sources.slice(0,3).map((s:any)=>({heading:s.title,body:line.repeat(20),sourceId:s.id,quote:aiMode==='bad-quote'?'原稿に存在しない架空の引用文です。':s.text.split('\n')[0]})),actions:[line,line]}
  res.json({id:'msg_synthetic',type:'message',role:'assistant',model:'synthetic-local-test',content:[{type:'tool_use',id:'tool_synthetic',name:'submit_book',input:doc}],stop_reason:'tool_use',stop_sequence:null,usage:{input_tokens:100,output_tokens:100}})
})
const bridgeServer=bridge.listen(0,'127.0.0.1');await new Promise<void>(r=>bridgeServer.once('listening',r))
const bridgeAddress=bridgeServer.address();assert.ok(bridgeAddress&&typeof bridgeAddress!=='string')
const origin=`http://127.0.0.1:${bridgeAddress.port}`
process.env.SUPABASE_URL=origin;process.env.SUPABASE_SERVICE_KEY=token('service_role');process.env.SUPABASE_ANON_KEY=token('anon');process.env.SUPABASE_JWT_SECRET=secret
// Bind test JWT issuer to the exact local URL used by the production verifier.
const userToken=(id:string)=>jwt.sign({role:'authenticated',sub:id,aud:'authenticated',iss:origin+'/auth/v1'},secret,{expiresIn:600})
const app=express();app.use(express.json());app.use('/api/books',aiBooksRouter)
const api=app.listen(0,'127.0.0.1');await new Promise<void>(r=>api.once('listening',r))
const address=api.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}/api/books`
async function call(path='',method='GET',body?:unknown,status=200,user=owner){return result(await nativeFetch(base+path,{method,headers:{authorization:'Bearer '+userToken(user),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),status)}
function pass(s:string){console.log('PASS BOOK HTTP/DB/WORKER:',s)}
async function worker(){
  const env:NodeJS.ProcessEnv={...process.env,SUPABASE_URL:origin,SUPABASE_SERVICE_KEY:token('service_role'),ANTHROPIC_API_KEY:'synthetic-key',ANTHROPIC_BASE_URL:origin,AI_BOOK_MODEL:'synthetic-local-test',DOTENV_CONFIG_PATH:'/nonexistent-synthetic-env'}
  delete env.ANTHROPIC_AUTH_TOKEN
  return new Promise<string>((resolve,reject)=>{const child=spawn(process.execPath,['dist/scripts/aiBookWorker.js','--once'],{env,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);const timer=setTimeout(()=>child.kill('SIGKILL'),15000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);code===0?resolve(log):reject(Error(log))})})
}
const question='仕事と新しい役割の両立を考えるために、何を整理して相談すればよいでしょうか。'
const sourceId=randomUUID()
const card=(n:number)=>({id:'source-'+n,kind:'essence',scope:'self',title:'仕事の特徴'+n,summary:'自分の考えを整理してから、具体的な希望を相手に伝えることが役立ちます。',tags:['仕事'],pages:[{text:'引き受ける量と優先順位を確かめることで、進め方を相談しやすくなります。'}],evidence:[]})
const source={id:sourceId,user_id:owner,title:'合成自己鑑定',kind:'self',report_text:'合成テスト',calculated_data:{_structuredReport:{version:3,reportText:'合成テスト',generator:'deterministic',generatorVersion:'synthetic-v1',cards:[1,2,3].map(card)}}}
const order=(operationId=randomUUID())=>({operationId,sourceId,theme:'仕事',question})
const now=Date.now()
function event(tx:string,revoked=false){return {environment:'Sandbox',action:'transaction',requestUserId:owner,allowOwnerTransfer:false,notificationType:null,transaction:{environment:'Sandbox',originalTransactionId:'synthetic-lineage',transactionId:tx,productId:'synthetic-monthly',appAccountToken:owner,purchaseMs:now-10000,signedMs:now+(revoked?1000:0),expiresMs:now+86400000,revokedMs:revoked?now:null,isUpgraded:false}}}
async function emit(key:string,payload:unknown){await rpc('app_store_receive_event',{p_environment:'Sandbox',p_event_id:key,p_payload:payload});return rpc('app_store_apply_event',{p_environment:'Sandbox',p_event_id:key})}
try{
  assert.equal((await nativeFetch(base)).status,401)
  assert.equal((await call('/status')).enabled,false)
  assert.equal((await call('/validate','POST',order(),503)).code,'BOOK_DISABLED')
  await db('ai_book_settings?id=eq.true','PATCH',{enabled:true},204)
  await db('reading_conversations','POST',source,201)
  const first=event('synthetic-first');assert.equal((await emit('first',first)).delivery,'mirrored')
  await emit('first',first);assert.equal((await call('/status')).memberRemaining,3)
  pass('feature disabled by default; verified-event contract grants exactly three with duplicate delivery')
  assert.equal((await call('/validate','POST',order())).valid,true)
  assert.equal((await call('/validate','POST',order(),422,other)).code,'BOOK_SOURCE')
  const request=order();loseOrderAck=true
  assert.equal((await call('','POST',request,503)).code,'BOOK_UNAVAILABLE')
  const recovered=(await call('/operations/'+request.operationId)).book
  assert.equal(recovered.state,'queued');assert.equal(recovered.document,null);assert.deepEqual(recovered.sources,[])
  assert.equal((await call('','POST',request)).book.id,recovered.id)
  assert.equal((await call('/status')).remaining,2)
  assert.equal((await call('/operations/'+request.operationId,'GET',undefined,200,other)).book,null)
  await call('/'+recovered.id,'GET',undefined,404,other)
  assert.equal((await call('','GET',undefined,200,other)).books.length,0)
  pass('lost order acknowledgement recovers and consumes once; other accounts cannot access it')
  assert.match(await worker(),/book_generation_saved/)
  const pending=(await call('/'+recovered.id)).book
  assert.equal(pending.state,'review');assert.equal(pending.document,null);assert.deepEqual(pending.sources,[])
  assert.equal(await rpc('ai_book_review',{p_id:recovered.id,p_approve:true}),true)
  const delivered=(await call('/'+recovered.id)).book
  assert.equal(delivered.state,'delivered');assert.equal(delivered.document.sections.length,3);assert.equal(delivered.sources.length,3)
  assert.equal((await call()).books[0].document,null)
  assert.deepEqual((await call('/'+recovered.id)).book.document,delivered.document)
  assert.equal((await call('/status')).remaining,2)
  pass('actual worker saves to review; approval exposes book; repeated reading consumes no credit')
  const bad=(await call('','POST',order(),201)).book;aiMode='bad-quote'
  for(let i=0;i<3;i++)assert.match(await worker(),/book_generation_retry/)
  assert.equal((await call('/'+bad.id)).book.state,'failed');assert.equal((await call('/status')).remaining,2)
  assert.equal((await db('ai_books?id=eq.'+bad.id))[0].document,null)
  pass('fabricated AI quotation retries three times, publishes nothing and returns one credit')
  const single={productId:BOOK_PRODUCT,type:'Consumable',appAccountToken:owner,transactionId:'synthetic-single',environment:'Sandbox',purchaseDate:now,signedDate:now}
  await grantVerifiedBookPurchase(single as never,owner);await grantVerifiedBookPurchase(single as never,owner)
  assert.equal((await call('/status')).purchasedRemaining,1)
  await grantVerifiedBookPurchase({...single,revocationDate:now+1,signedDate:now+2} as never,owner)
  assert.equal((await call('/status')).purchasedRemaining,0)
  pass('consumable delivery contract grants once and refund revokes unused credit')
  const cancelled=order();await call('/operations/'+cancelled.operationId+'/cancel-unsubmitted','POST')
  await call('','POST',cancelled,503);assert.equal((await call('/status')).remaining,2)
  pass('cancelled operation cannot consume a credit through a delayed request')
  await db('ai_book_settings?id=eq.true','PATCH',{enabled:false},204)
  await emit('refund-while-disabled',event('synthetic-first',true))
  const unseen=event('synthetic-unseen',true)
  unseen.requestUserId=other;unseen.transaction.appAccountToken=other;unseen.transaction.originalTransactionId='synthetic-other-lineage'
  await emit('unseen-refund-while-disabled',unseen)
  await db('ai_book_settings?id=eq.true','PATCH',{enabled:true},204)
  assert.equal((await call('/status')).memberRemaining,0,'refund received while feature off must remain effective after re-enabling')
  await emit('older-purchase-after-refund',{...unseen,transaction:{...unseen.transaction,revokedMs:null,signedMs:now}})
  assert.equal((await call('/status','GET',undefined,200,other)).memberRemaining,0,'earlier purchase must not resurrect a period refunded while disabled')
  assert.deepEqual((await call('/'+recovered.id)).book.document,delivered.document)
  pass('refund during feature pause is honored, including unseen periods and older replay; delivered book remains readable')
  await db('ai_book_settings?id=eq.true','PATCH',{review_mode:false},204)
  await grantVerifiedBookPurchase({...single,transactionId:'synthetic-automatic-single'} as never,owner)
  aiMode='valid'
  const automatic=(await call('','POST',order(),201)).book
  assert.match(await worker(),/book_generation_saved/)
  const ready=(await call('/'+automatic.id)).book
  assert.equal(ready.state,'delivered')
  assert.ok(ready.document.answer.length > 1000)
  assert.equal((await call('/status')).remaining,0)
  assert.ok((await call()).books.some((b:any)=>b.id===automatic.id))
  pass('validated automatic delivery appears in bookshelf without manual approval and consumes exactly one credit')
  assert.equal(aiCalls,5)
  console.log('ALL BOOK HTTP/DB/WORKER CHECKS PASSED')
}finally{api.closeAllConnections();bridgeServer.closeAllConnections();api.close();bridgeServer.close()}
