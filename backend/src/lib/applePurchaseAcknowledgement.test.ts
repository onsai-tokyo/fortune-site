import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmPurchaseMirror, PurchaseMirrorUnconfirmed } from './applePurchaseAcknowledgement.js'
const expected={userId:'11111111-1111-4111-8111-111111111111',transactionId:'tx',originalTransactionId:'original',productId:'product',environment:'Sandbox'}
const row={user_id:expected.userId,latest_transaction_id:'tx',original_transaction_id:'original',product_id:'product',environment:'Sandbox'}
function db(data: unknown, error: unknown = null) {return {from(table:string){assert.equal(table,'app_store_subscriptions');return {select(){return {eq(key:string,id:string){assert.equal(key,'user_id');assert.equal(id,expected.userId);return {maybeSingle:async()=>({data,error})}}}}}}} as any}
test('saved owner and exact verified transaction receive the iOS acknowledgement',async()=>{
 assert.deepEqual(await confirmPurchaseMirror(db(row),expected),{verified:true,delivery:'mirrored',transactionId:'tx',ownerId:expected.userId})
})
test('missing or unreadable mirror never acknowledges delivery',async()=>{
 for(const [data,error] of [[null,null],[row,new Error('offline')]])await assert.rejects(confirmPurchaseMirror(db(data,error),expected),PurchaseMirrorUnconfirmed)
})
test('owner, transaction, lineage, product and environment must all match',async()=>{
 for(const key of Object.keys(row))await assert.rejects(confirmPurchaseMirror(db({...row,[key]:'different'}),expected),PurchaseMirrorUnconfirmed)
})
test('production transactions use the same ordinary Apple acknowledgement',async()=>{
 assert.equal((await confirmPurchaseMirror(db({...row,environment:'Production'}),{...expected,environment:'Production'})).delivery,'mirrored')
})
