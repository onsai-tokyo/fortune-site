import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/analytics-signup.js'
import threads from '../api/threads-event.js'
import { signupPayload } from '../server/signupAnalytics.js'
const now=Math.floor(Date.now()/1000)
const body={clientId:'123.'+now,sessionId:now,acq_source:'threads',acq_medium:'social',acq_campaign:'c20261125',acq_content:'p20261125_01',acq_entry_page:'/guides/day-master',last_content_id:'/tools/day-master'}
const response=()=>({code:0,setHeader(){},status(n){this.code=n;return this},end(){}})
const request=(extra={})=>({method:'POST',headers:{host:'fate-lab.com',origin:'https://fate-lab.com',authorization:'Bearer verified.token'},body:{...body},...extra})
function env(t){for(const [k,v]of Object.entries({VITE_SUPABASE_URL:'https://auth.fatelab.test',VITE_SUPABASE_ANON_KEY:'test-anon',GA4_API_SECRET:'test-secret'})){const prev=process.env[k];process.env[k]=v;t.after(()=>{if(prev===undefined)delete process.env[k];else process.env[k]=prev})}}
test('payload reconstructs safe fields and drops identity, content and URLs',()=>{
 const data=signupPayload({...body,email:'private@example.com',result:'private-result',page_location:'https://fate-lab.com/r/secret?token=private',page_referrer:'https://mail.test/private',acq_content:'private@example.com',user_id:'private-user'})
 assert.equal(data.events[0].name,'sign_up');assert.equal(data.events[0].params.acq_content,'(none)');assert.doesNotMatch(JSON.stringify(data),/private|secret|user_id|email/)
 assert.equal(signupPayload({...body,clientId:'private@example.com'}),null)
})
test('Auth verifies confirmed nonanonymous account and atomically claims once',async t=>{
 env(t);let user,claimed=false,claims=0,ga=[]
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  if(String(url).endsWith('/auth/v1/user'))return {status:200,ok:true,json:async()=>user}
  if(String(url).endsWith('/rpc/claim_signup_analytics')){claims++;const won=!claimed;claimed=true;return {ok:true,json:async()=>won}}
  if(String(url).startsWith('https://www.google-analytics.com/mp/collect')){ga.push(JSON.parse(init.body));return {ok:true}}
  throw Error('UNEXPECTED_DESTINATION')
 })
 for(const v of [{id:'test-user',is_anonymous:true,email_confirmed_at:'2026-11-25'}, {id:'test-user',is_anonymous:false}]){user=v;const r=response();await handler(request(),r);assert.equal(r.code,204)}
 assert.equal(claims,0);user={id:'test-user',is_anonymous:false,email_confirmed_at:'2026-11-25',email:'never-send@example.test'}
 await Promise.all(Array.from({length:8},async()=>{const r=response();await handler(request(),r);assert.equal(r.code,204)}))
 assert.equal(ga.length,1);await handler(request(),response());assert.equal(ga.length,1);assert.doesNotMatch(JSON.stringify(ga),/test-user|never-send|verified.token/)
})
test('cross-origin, unauthenticated, missing config and public signup injection fail closed',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error()})
 for(const [req,code]of [[request({method:'GET'}),405],[request({headers:{origin:'https://evil.test',host:'fate-lab.com'}}),403],[request({headers:{origin:'https://fate-lab.com',host:'preview.vercel.app'}}),403],[request({headers:{origin:'https://fate-lab.com',host:'fate-lab.com'}}),401],[request({body:{}}),400]]){const r=response();await handler(req,r);assert.equal(r.code,code)}
 const secret=process.env.GA4_API_SECRET;delete process.env.GA4_API_SECRET;t.after(()=>{if(secret!==undefined)process.env.GA4_API_SECRET=secret})
 const r=response();await handler(request(),r);assert.equal(r.code,503);assert.equal(calls,0)
 for(const name of ['signup','sign_up']){const r=response();await threads({...request(),body:{...body,event:name}},r);assert.equal(r.code,400)}
})
test('delivery failure never releases a claimed receipt for later login',async t=>{
 env(t);let claimed=false,deliveries=0
 t.mock.method(globalThis,'fetch',async url=>{
  if(String(url).endsWith('/user'))return {ok:true,json:async()=>({id:'new',email_confirmed_at:'today'})}
  if(String(url).includes('/rpc/')){const won=!claimed;claimed=true;return {ok:true,json:async()=>won}}
  deliveries++;throw Error('delivery timeout')
 })
 await handler(request(),response());await handler(request(),response());assert.equal(deliveries,1)
})
test('manual GA campaign is attached only to landing views, never later actions',async t=>{
 env(t);const sent=[];t.mock.method(globalThis,'fetch',async(_url,init)=>{sent.push(JSON.parse(init.body));return {ok:true}})
 const fields={campaign_source:'threads',campaign_medium:'social',campaign_name:'c20261125',campaign_content:'p20261125_01'}
 for(const event of ['page_view','seo_tool_complete']){
  const r=response();await threads({...request(),body:{...body,...fields,event,page_path:'/tools/day-master',tool_name:'day_master'}},r)
  assert.equal(r.code,204)
 }
 assert.deepEqual(sent[0].events.map(e=>e.name),['campaign_details','page_view'])
 assert.equal(sent[0].events[0].params.campaign,'c20261125');assert.equal(sent[0].events[0].params.content,'p20261125_01')
 assert.deepEqual(sent[1].events.map(e=>e.name),['seo_tool_complete']);assert.equal(sent[1].events[0].params.campaign_source,undefined)
})
