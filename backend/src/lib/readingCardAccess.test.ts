import test from 'node:test'
import assert from 'node:assert/strict'
import {projectedReport,publicReadingConversation,restoreGeneratedSnapshot} from './readingCardAccess.js'
import {projectReadingCard} from './readingAccessPolicy.js'
import {readingTargetKey} from './readingCardPurchases.js'
import type {ReportCard,StructuredReport} from './reportCards.js'
const owner='11111111-1111-4111-8111-111111111111'
const op='22222222-2222-4222-8222-222222222222'
const birth={birthDate:'1995-03-16',gender:'female',birthplace:'名古屋'}
const card:ReportCard={id:'year-2027',scope:'self',kind:'timing',title:'2027年',period:{label:'2027年'},summary:'PAID_BODY',tags:['PRIVATE_TAG'],pages:[{role:'core',label:'本文',text:'PAID_BODY'}],evidence:[]}
const report:StructuredReport={version:3,generator:'deterministic',reportText:'PAID_BODY',cards:[card]}
test('free projections retain reading text and remove unknown root fields',()=>{
 const output=projectedReport({...report,secretCopy:'PAID_BODY'} as StructuredReport,c=>projectReadingCard(c,false,new Set()))
 assert.match(JSON.stringify(output),/PAID_BODY|PRIVATE_TAG/)
 assert.doesNotMatch(JSON.stringify(output),/secretCopy/)
 assert.equal(output.cards[0].access?.locked,false)
 assert.equal(report.cards[0].summary,'PAID_BODY')
})
test('read-time rights redact old snapshots and self saves preserve full server original',async()=>{
 const vars={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_KEY:'synthetic',READING_CARD_PURCHASES:'enabled',READING_CARD_ENVIRONMENT:'Sandbox'}
 const before=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]])),fetch=globalThis.fetch
 Object.assign(process.env,vars)
 let paid=false,failed=false
 const row={kind:'self',birth_data:birth,report_text:'PAID_BODY',calculated_data:{_structuredReport:report,oldCopy:'PAID_BODY'}}
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));const body=init?.body?JSON.parse(String(init.body)):{}
  if(url.pathname.includes('/rpc/')) assert.equal(body.p_user,owner)
  else assert.equal(url.searchParams.get('user_id'),'eq.'+owner)
  const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
  if(url.pathname.endsWith('/stripe_subscriptions')||url.pathname.endsWith('/app_store_subscriptions'))return response(null)
  if(url.pathname.endsWith('/reading_card_purchases'))return failed?response({message:'offline'},503):response(paid?[{target_key:readingTargetKey(row),offer_key:'self:year:2027'}]:[])
  if(url.pathname.endsWith('/get_self_generation')){assert.equal(body.p_op,op);return response({state:'completed',result:report})}
  if(url.pathname.endsWith('/reading_card_generation_input'))return response(birth)
  throw Error('Unexpected request '+url.pathname)
 }
 try {
  assert.match(JSON.stringify(await publicReadingConversation(owner,row)),/PAID_BODY|PRIVATE_TAG/)
  paid=true
  assert.match(JSON.stringify(await publicReadingConversation(owner,row)),/PAID_BODY/)
  failed=true
  assert.match(JSON.stringify(await publicReadingConversation(owner,row)),/PAID_BODY/)
  const original=await restoreGeneratedSnapshot(owner,op,{birthData:birth,reportText:'redacted',structuredReport:{...report,reportText:'redacted',cards:[]}})
  assert.equal(original.reportText,'PAID_BODY')
  await assert.rejects(restoreGeneratedSnapshot(owner,op,{birthData:{...birth,birthDate:'2000-01-01'}}))
 }finally{globalThis.fetch=fetch;for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
})
