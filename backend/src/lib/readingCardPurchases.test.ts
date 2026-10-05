import test from 'node:test'
import assert from 'node:assert/strict'
import {CARD_PRODUCT,normalizeCardPurchase,readingTargetKey} from './readingCardPurchases.js'
const owner='aaaaaaaa-1111-4111-8111-111111111111'
const tx={productId:CARD_PRODUCT,type:'Consumable',appAccountToken:owner,transactionId:'123456',environment:'Sandbox',purchaseDate:1000,signedDate:2000}
test('verified card purchase is bound to product, owner, environment and dates',()=>{
 assert.equal(normalizeCardPurchase(tx,owner).transaction,'123456')
 for(const change of [{productId:'com.onsai.fatelab.report.single'},{type:'Non-Consumable'},{appAccountToken:undefined},{environment:'Xcode'},{purchaseDate:NaN},{signedDate:0},{transactionId:''},{revocationDate:NaN}])assert.throws(()=>normalizeCardPurchase({...tx,...change},owner))
 assert.throws(()=>normalizeCardPurchase(tx,'bbbbbbbb-1111-4111-8111-111111111111'))
 assert.equal(normalizeCardPurchase({...tx,revocationDate:3000}).revoked,true)
})
const birth={birthDate:'1995-03-16',birthTime:'00:52',gender:'female',birthplace:'名古屋'}
test('purchase target is stable across names and regeneration, not different birth conditions',()=>{
 const key=readingTargetKey({kind:'self',birth_data:birth})
 assert.equal(key,readingTargetKey({kind:'self',birth_data:{...birth,nickname:'名前変更',birthTime:'00:52:00',birthTimeZone:'Asia/Tokyo',relationshipStatus:'partnered'}}))
 for(const patch of [{birthDate:'1995-03-17'},{birthTime:'01:00'},{gender:'male'},{birthplace:'東京'},{birthTimeZone:'UTC'}])assert.notEqual(key,readingTargetKey({kind:'self',birth_data:{...birth,...patch}}))
 assert.throws(()=>readingTargetKey({kind:'self',birth_data:{}}))
})
test('pair purchases cannot move to another partner, self reading, or reversed pair',()=>{
 const a={kind:'compatibility',partner_profile_id:owner,birth_data:{self:birth,partner:{...birth,birthDate:'1994-03-08'}}}
 const key=readingTargetKey(a)
 assert.equal(key,readingTargetKey({...a,birth_data:{...a.birth_data,relationshipLabel:'復縁希望'}}))
 assert.notEqual(key,readingTargetKey({...a,partner_profile_id:'bbbbbbbb-1111-4111-8111-111111111111'}))
 assert.notEqual(key,readingTargetKey({...a,birth_data:{self:a.birth_data.partner,partner:birth}}))
 assert.notEqual(key,readingTargetKey({kind:'self',birth_data:birth}))
})

test('deleted partner retains immutable purchase identity; foreign revisions fail closed',async()=>{
 const {readingPurchaseIdentity}=await import('./readingCardPurchases.js')
 const oldFetch=globalThis.fetch,oldURL=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_KEY
 process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='synthetic'
 const original={kind:'compatibility',partner_profile_id:owner,reading_revision_id:owner,birth_data:{self:birth,partner:birth}}
 let missing=false
 globalThis.fetch=async(input)=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get('user_id'),'eq.'+owner);assert.equal(url.searchParams.get('id'),'eq.'+owner)
  return new Response(JSON.stringify(missing?null:{payload:{partnerProfileId:owner}}),{headers:{'Content-Type':'application/json'}})
 }
 try {
  const deleted={...original,partner_profile_id:null}
  assert.equal(readingTargetKey(await readingPurchaseIdentity(owner,deleted)),readingTargetKey(original))
  assert.equal(readingTargetKey(await readingPurchaseIdentity(owner,{...deleted,kind:'chat',birth_data:{...deleted.birth_data,_sourceKind:'compatibility'}})),readingTargetKey(original))
  missing=true;await assert.rejects(readingPurchaseIdentity(owner,deleted))
  await assert.rejects(readingPurchaseIdentity(owner,{...deleted,reading_revision_id:undefined}))
 }finally{globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldURL;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_KEY;else process.env.SUPABASE_SERVICE_KEY=oldKey}
})
