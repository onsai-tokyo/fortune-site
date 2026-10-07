import test from 'node:test'
import assert from 'node:assert/strict'
import {bookFailure,bookRetryDelay} from './aiBookFailure.js'
test('billing and invalid credentials pause without pointless retries',()=>{
 for(const e of [{status:400,message:'Your credit balance is too low'}, {status:401}, {status:403}]) {
  const f=bookFailure(e); assert.equal(f.pause,true);assert.equal(f.retryable,false)
 }
})
test('transient provider failures back off',()=>{
 for(const e of [{status:429},{status:529},{status:504},{name:'APIConnectionTimeoutError'}]) {
  const f=bookFailure(e);assert.equal(f.retryable,true);assert.equal(f.pause,false)
 }
 assert.deepEqual([1,2,3,10].map(bookRetryDelay),[30,60,120,120])
})
test('provider payload and private content never reach diagnostic output',()=>{
 const f=bookFailure({status:500,message:'secret question and API key',request_id:'req_123',error:{private:'secret'}})
 assert.deepEqual(f,{code:'BOOK_PROVIDER_UNAVAILABLE',retryable:true,pause:false,status:500,requestId:'req_123'})
 assert.equal(bookFailure({message:'private',request_id:'private question here'}).requestId,undefined)
})
test('policy refusals never retry but malformed generation can retry',()=>{
 assert.equal(bookFailure(new Error('BOOK_REFUSED')).retryable,false)
 assert.equal(bookFailure(new Error('BOOK_DOCUMENT_POLICY')).retryable,false)
 assert.equal(bookFailure(new Error('BOOK_DOCUMENT_EVIDENCE')).retryable,true)
 assert.equal(bookFailure(new Error('BOOK_DOCUMENT_LENGTH')).retryable,true)
 assert.equal(bookFailure(new Error('unknown private response')).code,'BOOK_INTERNAL')
})
