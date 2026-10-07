import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import {aiBooksRouter} from './aiBooks.js'
import {AI_TERMS_CONSENT_VERSION} from '../middleware/aiConsent.js'

test('book creation requires membership even with credits; accepted orders remain recoverable', async () => {
 const originalFetch=globalThis.fetch
 const keys=['SUPABASE_URL','SUPABASE_SERVICE_KEY','SUPABASE_JWT_SECRET','READING_CARD_PURCHASES'] as const
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]))
 process.env.SUPABASE_URL='https://books-membership.invalid'; process.env.SUPABASE_SERVICE_KEY='synthetic'; process.env.SUPABASE_JWT_SECRET='synthetic-books-secret'; process.env.READING_CARD_PURCHASES='disabled'
 const user='11111111-1111-4111-8111-111111111111', source='22222222-2222-4222-8222-222222222222', op='33333333-3333-4333-8333-333333333333', book='44444444-4444-4444-8444-444444444444'
 const token=jwt.sign({sub:user,role:'authenticated'},process.env.SUPABASE_JWT_SECRET,{algorithm:'HS256',audience:'authenticated',issuer:process.env.SUPABASE_URL+'/auth/v1',expiresIn:300})
 let premium=false, unavailable=false, accepted=false, orders=0
 const question='仕事の進め方について自分の特徴を踏まえて詳しく知りたいです。'
 const row={id:book,source_id:source,question,theme:'仕事',state:'queued',source_snapshot:[]}
 const calls:string[]=[]
 globalThis.fetch=async(resource,init)=>{
  const url=new URL(String(resource)); if(url.hostname!=='books-membership.invalid')return originalFetch(resource,init)
  const table=url.pathname.split('/').at(-1)!;calls.push(table)
  if(unavailable && table==='app_store_subscriptions')return new Response(JSON.stringify({message:'unavailable'}),{status:503,headers:{'content-type':'application/json'}})
  let value:any=null
  if(table==='app_store_subscriptions' && premium)value={subscription_status:'active',expires_at:'2099-01-01T00:00:00Z',revoked_at:null}
  if(table==='ai_book_settings')value={enabled:true,monthly_credits:3}
  if(table==='ai_book_grants')value=[{source:'review',starts_at:'2020-01-01T00:00:00Z',expires_at:null,ai_book_credits:[{consumed_by:null,recovery_until:null}]}]
  if(table==='ai_books')value=accepted?row:null
  if(table==='reading_conversations')value={id:source,title:'あなた',kind:'self',calculated_data:{_structuredReport:{version:3,reportText:'',generator:'deterministic',generatorVersion:'synthetic',cards:[1,2,3].map(n=>({id:`card-${n}`,kind:'essence',title:'仕事',summary:'本人の特徴',tags:[],pages:[],evidence:[]}))}}}
  if(table==='ai_book_order'){orders++;accepted=true;value=book}
  return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}})
 }
 const app=express();app.use(express.json());app.use('/api/books',aiBooksRouter)
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
 const port=(server.address() as {port:number}).port
 const call=(path='',body?:unknown)=>originalFetch(`http://127.0.0.1:${port}/api/books${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','X-FateLab-AI-Consent':AI_TERMS_CONSENT_VERSION},body:body?JSON.stringify(body):undefined})
 const payload={operationId:op,sourceId:source,theme:'仕事',question}
 try {
  const status=await(await call('/status')).json();assert.equal(status.premium,false);assert.equal(status.remaining,1)
  calls.length=0
  let response=await call('',payload);assert.equal(response.status,402);assert.equal((await response.json()).code,'BOOK_MEMBERSHIP_REQUIRED');assert.equal(orders,0);assert.ok(!calls.includes('reading_conversations'))
  unavailable=true;response=await call('',payload);assert.equal(response.status,503);assert.equal(orders,0)
  unavailable=false;premium=true;response=await call('',payload);assert.equal(response.status,201,JSON.stringify(await response.json()));assert.equal(orders,1)
  premium=false;response=await call('',payload);assert.equal(response.status,200);assert.equal(orders,1,'accepted retry must not consume another credit')
  response=await call('',{...payload,question:question+'変更'});assert.equal(response.status,409)
 } finally {
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));globalThis.fetch=originalFetch
  for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]
 }
})
