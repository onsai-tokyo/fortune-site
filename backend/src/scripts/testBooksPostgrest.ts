/** Local Express -> actual PostgREST/PostgreSQL -> actual worker integration.
 * Apple payloads and AI HTTP responses are synthetic; no live services or credentials.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import express from 'express'
import jwt from 'jsonwebtoken'
import { AI_TERMS_CONSENT_VERSION } from '../middleware/aiConsent.js'
import {productEventsRouter} from '../routes/productEvents.js'
import { aiBooksRouter } from '../routes/aiBooks.js'
import {claimDeviceTrial} from '../lib/deviceTrial.js'
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
let aiMode:'valid'|'bad-quote'='valid',aiCalls=0,loseOrderAck=false,denyUsageStart=false,supersedeBook:string|null=null
bridge.all('/rest/v1/*',async(req,res)=>{
  if(denyUsageStart&&req.path==='/rest/v1/ai_book_usage_events'&&req.body.phase==='started'){
    res.status(503).json({message:'synthetic metering outage'});return
  }
  const response=await nativeFetch(rest+req.originalUrl.slice('/rest/v1'.length),{method:req.method,headers:{...headers,...(req.header('accept')?{accept:req.header('accept')!}:{}),...(req.header('prefer')?{prefer:req.header('prefer')!}:{})},...(['GET','HEAD'].includes(req.method)?{}:{body:JSON.stringify(req.body)})})
  const body=await response.text()
  if(response.headers.has('content-range'))res.setHeader('content-range',response.headers.get('content-range')!)
  if(loseOrderAck&&req.path.endsWith('/rpc/ai_book_order')&&response.ok){loseOrderAck=false;res.status(503).json({message:'synthetic lost acknowledgement'});return}
  res.status(response.status).type(response.headers.get('content-type')??'application/json').send(body)
})
bridge.post('/v1/messages',async(req,res)=>{
  if(supersedeBook){await db('ai_books?id=eq.'+supersedeBook,'PATCH',{lease_id:randomUUID()},204);supersedeBook=null}
  aiCalls++
  const {sources}=JSON.parse(req.body.messages[0].content)
  const line='命式から読み取れる傾向を踏まえて、考えを整理し、無理のない範囲で相手と相談することが助けになります。'
  const doc={title:'相談の整理と伝え方を考える',summary:line,answer:line.repeat(18),sections:sources.slice(0,3).map((s:any)=>({heading:s.title,body:line.repeat(9),sourceId:s.id,quote:aiMode==='bad-quote'?'原稿に存在しない架空の引用文です。':s.text.split('\n')[0]})),actions:[line,line]}
  res.json({id:'msg_synthetic',type:'message',role:'assistant',model:'synthetic-local-test',content:[{type:'tool_use',id:'tool_synthetic',name:'submit_book',input:doc}],stop_reason:'tool_use',stop_sequence:null,usage:{input_tokens:100,output_tokens:100}})
})
const bridgeServer=bridge.listen(0,'127.0.0.1');await new Promise<void>(r=>bridgeServer.once('listening',r))
const bridgeAddress=bridgeServer.address();assert.ok(bridgeAddress&&typeof bridgeAddress!=='string')
const origin=`http://127.0.0.1:${bridgeAddress.port}`
process.env.SUPABASE_URL=origin;process.env.SUPABASE_SERVICE_KEY=token('service_role');process.env.SUPABASE_ANON_KEY=token('anon');process.env.SUPABASE_JWT_SECRET=secret
// Bind test JWT issuer to the exact local URL used by the production verifier.
const userToken=(id:string)=>jwt.sign({role:'authenticated',sub:id,aud:'authenticated',iss:origin+'/auth/v1'},secret,{expiresIn:600})
const app=express();app.use(express.json());app.use('/api/books',aiBooksRouter);app.use('/api/product-events',productEventsRouter)
const api=app.listen(0,'127.0.0.1');await new Promise<void>(r=>api.once('listening',r))
const address=api.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}/api/books`
async function call(path='',method='GET',body?:unknown,status=200,user=owner){return result(await nativeFetch(base+path,{method,headers:{authorization:'Bearer '+userToken(user),'Content-Type':'application/json',...(method==='POST'&&path===''?{'X-FateLab-AI-Consent':AI_TERMS_CONSENT_VERSION}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),status)}
function pass(s:string){console.log('PASS BOOK HTTP/DB/WORKER:',s)}
async function worker(){
  const env:NodeJS.ProcessEnv={...process.env,SUPABASE_URL:origin,SUPABASE_SERVICE_KEY:token('service_role'),ANTHROPIC_API_KEY:'synthetic-key',ANTHROPIC_BASE_URL:origin,AI_BOOK_MODEL:'synthetic-local-test',DOTENV_CONFIG_PATH:'/nonexistent-synthetic-env'}
  delete env.ANTHROPIC_AUTH_TOKEN
  return new Promise<string>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','src/scripts/aiBookWorker.ts','--once'],{env,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);const timer=setTimeout(()=>child.kill('SIGKILL'),15000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);code===0?resolve(log):reject(Error(log))})})
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
  const eventURL=base.replace('/api/books','/api/product-events'),eventID=randomUUID()
  const analytics={id:eventID,event:'timeline_viewed',surface:'self',build:'140',user_id:other,question:'must-not-be-persisted'}
  const sendEvent=(body:unknown,auth=true)=>nativeFetch(eventURL,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{authorization:'Bearer '+userToken(owner)}:{})},body:JSON.stringify(body)})
  assert.equal((await sendEvent(analytics,false)).status,401)
  assert.equal((await sendEvent({...analytics,event:'purchase_completed'})).status,422)
  assert.equal((await sendEvent(analytics)).status,204)
  assert.equal((await sendEvent(analytics)).status,204)
  const recorded=await db('product_events?event_key=eq.client:'+owner+':'+eventID)
  assert.equal(recorded.length,1)
  assert.equal(recorded[0].user_id,owner)
  assert.deepEqual(recorded[0].properties,{surface:'self',build:'140',trialEnabled:false})
  pass('authenticated analytics endpoint strips private fields and deduplicates retries in actual DB')
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
  for(let i=0;i<3;i++){
    if(i) await db('ai_books?id=eq.'+bad.id,'PATCH',{lease_until:new Date(Date.now()-1000).toISOString()},204)
    assert.match(await worker(),/book_generation_failed_attempt/)
  }
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
  const renewal=event('synthetic-renewal');renewal.transaction.purchaseMs=now+2000;renewal.transaction.signedMs=now+2001
  // A separate synthetic active lineage avoids resurrecting the refunded transaction.
  renewal.transaction.originalTransactionId='synthetic-new-lineage'
  renewal.transaction.purchaseMs=now-1000
  await emit('renewal-for-automatic',renewal)
  await grantVerifiedBookPurchase({...single,transactionId:'synthetic-automatic-single'} as never,owner)
  aiMode='valid'
  const automatic=(await call('','POST',order(),201)).book
  assert.match(await worker(),/book_generation_saved/)
  const ready=(await call('/'+automatic.id)).book
  assert.equal(ready.state,'delivered')
  assert.ok(ready.document.answer.length > 500)
  assert.equal((await call('/status')).remaining,3)
  assert.ok((await call()).books.some((b:any)=>b.id===automatic.id))
  pass('validated automatic delivery appears in bookshelf without manual approval and consumes exactly one credit')
  assert.equal(aiCalls,5)
  const usage=await db('ai_book_usage_events?order=created_at.asc')
  const responses=usage.filter((u:any)=>u.phase==='response')
  assert.equal(responses.length,aiCalls)
  assert.equal(responses.reduce((n:number,u:any)=>n+u.input_tokens,0),500)
  assert.equal(responses.filter((u:any)=>u.book_id===bad.id).length,3)
  assert.equal(usage.filter((u:any)=>u.book_id===bad.id&&u.phase==='attempt_failed').length,3)
  assert.equal(new Set(responses.filter((u:any)=>u.book_id===bad.id).map((u:any)=>u.lease_id)).size,3)
  assert.equal(usage.filter((u:any)=>u.phase==='started').length,aiCalls)
  assert.ok(responses.every((u:any)=>u.model==='synthetic-local-test'&&u.provider_model==='synthetic-local-test'))
  pass('every real worker response, including three refunded attempts, persists usage without overwriting prior leases')
  assert.equal((await call('/status')).trialEnabled,false)
  const nonmember=order();nonmember.sourceId=sourceId
  assert.equal((await call('','POST',nonmember,402,other)).code,'BOOK_MEMBERSHIP_REQUIRED')
  pass('trial OFF preserves member-only creation even with source IDs supplied by a nonmember')
  await db('ai_book_settings?id=eq.true','PATCH',{trial_enabled:true,trial_monthly_cap:1},204)
  // DeviceCheck network is synthetic; its production store uses the real local SQL functions.
  const deviceRequest={requestId:randomUUID(),token:Buffer.from('synthetic-device-for-local-test').toString('base64')}
  let deviceUsed=false
  const device={query:async()=>deviceUsed,mark:async()=>{deviceUsed=true}}
  assert.equal((await claimDeviceTrial(other,deviceRequest,undefined,device)).state,'granted')
  assert.equal((await claimDeviceTrial(other,deviceRequest,undefined,device)).state,'granted')
  assert.equal((await call('/status','GET',undefined,200,other)).trialRemaining,1)
  const freeSourceId=randomUUID()
  await db('reading_conversations','POST',{...source,id:freeSourceId,user_id:other},201)
  const freeRequest={...order(),sourceId:freeSourceId}
  const free=(await call('','POST',freeRequest,201,other)).book
  assert.equal(free.isTrial,true)
  assert.equal((await call('','POST',freeRequest,200,other)).book.id,free.id)
  assert.equal((await call('/status','GET',undefined,200,other)).trialPaused,true)
  assert.equal((await call('','POST',{...order(),sourceId:freeSourceId},402,other)).code,'BOOK_MEMBERSHIP_REQUIRED')
  const cappedUser='55555555-5555-4555-8555-555555555555',cappedSource=randomUUID()
  await claimDeviceTrial(cappedUser,{requestId:randomUUID(),token:Buffer.from('synthetic-second-local-device').toString('base64')},undefined,{query:async()=>deviceUsed,mark:async()=>{deviceUsed=true}}).then(async r=>{
    // Already-used device must be denied even for another eligible account.
    assert.equal(r.state,'denied')
  })
  deviceUsed=false
  assert.equal((await claimDeviceTrial(cappedUser,{requestId:randomUUID(),token:Buffer.from('synthetic-new-local-device').toString('base64')},undefined,device)).state,'granted')
  await db('reading_conversations','POST',{...source,id:cappedSource,user_id:cappedUser},201)
  assert.equal((await call('','POST',{...order(),sourceId:cappedSource},402,cappedUser)).code,'BOOK_TRIAL_PAUSED')
  assert.match(await worker(),/book_generation_saved/)
  assert.equal((await call('/'+free.id,'GET',undefined,200,other)).book.state,'delivered')
  const events=await db('product_events?user_id=eq.'+other)
  for(const name of ['trial_granted','trial_book_ordered','trial_book_delivered'])assert.equal(events.filter((e:any)=>e.event===name).length,1)
  pass('trial grant retry, free acceptance, JST cap response, automatic delivery and funnel telemetry use actual SQL')
  assert.equal(aiCalls,6)
  const metering=(await call('','POST',order(),201)).book
  denyUsageStart=true
  assert.match(await worker(),/BOOK_USAGE_UNAVAILABLE/)
  denyUsageStart=false
  assert.equal(aiCalls,6,'no external request when durable start event is unavailable')
  await db('ai_books?id=eq.'+metering.id,'PATCH',{lease_until:new Date(Date.now()-1000).toISOString()},204)
  supersedeBook=metering.id
  assert.match(await worker(),/book_lease_superseded/)
  const superseded=await db('ai_book_usage_events?book_id=eq.'+metering.id)
  assert.equal(superseded.filter((u:any)=>u.phase==='attempt_succeeded').length,0)
  assert.equal(superseded.filter((u:any)=>u.failure_code==='BOOK_LEASE_SUPERSEDED').length,1)
  assert.equal(superseded.filter((u:any)=>u.phase==='response').length,1)
  pass('metering outage prevents paid AI request; superseded lease retains usage without counting delivery success')
  console.log('ALL BOOK HTTP/DB/WORKER CHECKS PASSED')
}finally{api.closeAllConnections();bridgeServer.closeAllConnections();api.close();bridgeServer.close()}
