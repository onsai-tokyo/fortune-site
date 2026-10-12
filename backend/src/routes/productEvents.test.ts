import test from 'node:test'
import assert from 'node:assert/strict'
import {clientProductEvent} from './productEvents.js'
test('client cannot spoof server outcomes or inject private analytics properties',()=>{
 const body={id:'11111111-1111-4111-8111-111111111111',event:'book_create_tapped',surface:'book',build:'140',question:'private',user_id:'another',properties:{birth:'private'}}
 const out=clientProductEvent(body,'owner');assert.equal(out.user_id,'owner');assert.deepEqual(out.properties,{surface:'book',build:'140'})
 for(const event of ['registration_completed','purchase_completed','trial_granted','trial_book_ordered','trial_book_delivered'])assert.throws(()=>clientProductEvent({...body,event},'owner'))
 assert.deepEqual(clientProductEvent(body,'owner'),out,'retry preserves unique key')
 assert.throws(()=>clientProductEvent({...body,id:'not-an-id'},'owner'))
})
