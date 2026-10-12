import test from 'node:test'
import assert from 'node:assert/strict'
import {claimDeviceTrial,type TrialStore,type TrialDeviceAPI} from './deviceTrial.js'
const request={requestId:'11111111-1111-4111-8111-111111111111',token:Buffer.from('synthetic-device-token').toString('base64')}
function fixture() {
 let state='checking',used=false,grants=0,lost=false
 const store:TrialStore={begin:async()=>state,transition:async(_u,_i,_h,expected,next)=>{if(state===expected)state=next;return state},finish:async()=>{if(state!=='granted'){state='granted';grants++}return state}}
 const device:TrialDeviceAPI={query:async()=>used,mark:async()=>{used=true;if(lost){lost=false;throw new Error('lost response')}}}
 return {store,device,get state(){return state},get grants(){return grants},lose:()=>lost=true,use:()=>used=true}
}
test('lost Apple update response resumes same reservation and grants exactly once',async()=>{
 const f=fixture();f.lose();await assert.rejects(claimDeviceTrial('u',request,f.store,f.device));assert.equal(f.state,'writing');assert.equal(f.grants,0)
 assert.equal((await claimDeviceTrial('u',request,f.store,f.device)).state,'granted')
 await claimDeviceTrial('u',request,f.store,f.device);assert.equal(f.grants,1)
})
test('used device is denied, and query failure never grants',async()=>{
 const f=fixture();f.use();assert.equal((await claimDeviceTrial('u',request,f.store,f.device)).state,'denied');assert.equal(f.grants,0)
 const g=fixture();g.device.query=async()=>{throw new Error('offline')};await assert.rejects(claimDeviceTrial('u',request,g.store,g.device));assert.equal(g.grants,0)
})
test('parallel same-reservation retries converge',async()=>{
 const f=fixture();await Promise.all(Array.from({length:10},()=>claimDeviceTrial('u',request,f.store,f.device)));assert.equal(f.grants,1)
})

test('only documented bit states are accepted; malformed replies fail closed',async()=>{
 const {parseDeviceBits}=await import('./deviceTrial.js')
 assert.equal(parseDeviceBits('Bit State Not Found'),null)
 assert.equal(parseDeviceBits('{"bit0":false}'),false)
 assert.equal(parseDeviceBits('{"bit0":true}'),true)
 for(const reply of ['', '{}', '{"bit0":"false"}','invalid'])assert.throws(()=>parseDeviceBits(reply))
})

test('lost DB confirmation acknowledgement is recovered without a second grant',async()=>{
 const f=fixture(),finish=f.store.finish;let lost=true
 f.store.finish=async(...args)=>{const value=await finish(...args);if(lost){lost=false;throw new Error('DB response lost')}return value}
 await assert.rejects(claimDeviceTrial('u',request,f.store,f.device))
 assert.equal((await claimDeviceTrial('u',request,f.store,f.device)).state,'granted');assert.equal(f.grants,1)
})

test('fenced reservation never queries Apple or grants again',async()=>{
 const f=fixture();f.store.begin=async()=> 'indeterminate'
 f.device.query=async()=>{throw new Error('must not query')}
 await assert.rejects(claimDeviceTrial('u',request,f.store,f.device),/BOOK_TRIAL_VERIFICATION_PENDING/)
 assert.equal(f.grants,0)
})
test('late Apple confirmation cannot override a fenced SQL reservation',async()=>{
 const f=fixture();f.store.finish=async()=> 'indeterminate'
 await assert.rejects(claimDeviceTrial('u',request,f.store,f.device),/BOOK_TRIAL_VERIFICATION_PENDING/)
 assert.equal(f.grants,0)
})
