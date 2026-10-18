import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVerifiedTransaction, notificationEvent, purchaseEvent, receiveAndApply, AppleJournalUnavailable } from './appleEventJournal.js'
const owner='11111111-1111-4111-8111-111111111111'
const raw={environment:'Sandbox',originalTransactionId:'original',transactionId:'tx',productId:'product',type:'Auto-Renewable Subscription',appAccountToken:owner,purchaseDate:1000,signedDate:2000,expiresDate:3000}
test('verified transaction normalization requires exact product, environment, type and numeric dates',()=>{
  const tx=normalizeVerifiedTransaction(raw,'product')
  assert.equal(tx.revokedMs,null)
  for(const patch of [{environment:'Unknown'},{productId:'other'},{type:'Consumable'},{purchaseDate:NaN},{signedDate:undefined},{expiresDate:null},{appAccountToken:'bad'}]) assert.throws(()=>normalizeVerifiedTransaction({...raw,...patch} as any,'product'))
  const prod=normalizeVerifiedTransaction({...raw,environment:'Production'},'product')
  assert.equal(purchaseEvent(prod,owner,true).payload.allowOwnerTransfer,false)
  assert.equal(purchaseEvent(tx,owner,true).eventId,purchaseEvent(tx,owner,true).eventId)
  assert.equal(purchaseEvent(tx,owner,true,owner).eventId,'verify-op:'+owner)
  assert.notEqual(purchaseEvent(tx,owner,true,owner).eventId,purchaseEvent(tx,owner,true,'22222222-2222-4222-8222-222222222222').eventId)
})
test('notification envelope cannot cross environment or lose a refund revocation',()=>{
  const tx=normalizeVerifiedTransaction(raw,'product')
  assert.throws(()=>notificationEvent({notificationUUID:'id',notificationType:'DID_RENEW'},'Production',tx))
  assert.throws(()=>notificationEvent({notificationUUID:'id',notificationType:'REFUND'},'Sandbox',tx))
  assert.equal(notificationEvent({notificationUUID:'id',notificationType:'TEST'},'Sandbox',null).payload.action,'ignore')
  assert.equal(notificationEvent({notificationUUID:'id',notificationType:'NEW_UNKNOWN_KIND'},'Sandbox',null).payload.action,'unsupported')
})
test('duplicate receipt still applies; failed/pending result never acknowledges successful delivery',async()=>{
  const event=purchaseEvent(normalizeVerifiedTransaction(raw,'product'),owner,false), calls:string[]=[]
  const db={rpc:async(name:string)=>{calls.push(name);return {data:name==='app_store_receive_event'?{state:'received'}:{state:'pending',reason:'db_failure'},error:null}}}
  await assert.rejects(receiveAndApply(event.eventId,event.payload,db),AppleJournalUnavailable)
  assert.deepEqual(calls,['app_store_receive_event','app_store_apply_event'])
  await assert.rejects(receiveAndApply(event.eventId,event.payload,{rpc:async()=>({data:null,error:{code:'missing_migration'}})}),AppleJournalUnavailable)
})
test('success requires typed mirror acknowledgement, not arbitrary 2xx RPC JSON',async()=>{
  const event=purchaseEvent(normalizeVerifiedTransaction(raw,'product'),owner,false)
  const db=(reply:any)=>({rpc:async(name:string)=>({data:name==='app_store_receive_event'?{state:'applied'}:reply,error:null})})
  for(const reply of [{},{state:'applied',delivery:'mirrored'},{state:'failed',delivery:'mirrored'}]) await assert.rejects(receiveAndApply(event.eventId,event.payload,db(reply)))
  const reply={state:'applied',delivery:'mirrored',ownerId:owner,transactionId:'tx'}
  assert.deepEqual(await receiveAndApply(event.eventId,event.payload,db(reply)),reply)
})
