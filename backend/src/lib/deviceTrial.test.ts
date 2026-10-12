import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
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
 assert.equal(parseDeviceBits('Failed to find bit state'),null)
 assert.equal(parseDeviceBits('Failed to find bit state\n'),null)
 assert.equal(parseDeviceBits('{"bit0":false}'),false)
 assert.equal(parseDeviceBits('{"bit0":true}'),true)
 for(const reply of ['', '{}', '{"bit0":"false"}','invalid','Failed to find bit state: invalid token'])assert.throws(()=>parseDeviceBits(reply))
})

test('Apple new-device plain-text response is validated before a single grant',async()=>{
 const {appleTrialDevice}=await import('./deviceTrial.js')
 const keys=['DEVICECHECK_TEAM_ID','DEVICECHECK_KEY_ID','DEVICECHECK_PRIVATE_KEY','DEVICECHECK_ENVIRONMENT']
 const before=keys.map(k=>process.env[k]),fetchBefore=globalThis.fetch
 try {
  process.env.DEVICECHECK_TEAM_ID='TESTTEAM';process.env.DEVICECHECK_KEY_ID='TESTKEY';process.env.DEVICECHECK_ENVIRONMENT='production'
  process.env.DEVICECHECK_PRIVATE_KEY=generateKeyPairSync('ec',{namedCurve:'P-256'}).privateKey.export({format:'pem',type:'pkcs8'}).toString()
  let marked=false,valid=true;const calls:string[]=[]
  globalThis.fetch=async(input,init)=>{
   const path=String(input).split('/').at(-1)!;calls.push(path)
   if(path==='query_two_bits')return new Response(marked?'{"bit0":true,"bit1":false}':'Failed to find bit state',{status:200})
   if(path==='validate_device_token')return new Response(valid?'':'Invalid device token',{status:valid?200:400})
   assert.equal(path,'update_two_bits')
   assert.equal(JSON.parse(String(init?.body)).bit0,true);marked=true;return new Response('',{status:200})
  }
  const f=fixture()
  assert.equal((await claimDeviceTrial('u',request,f.store,appleTrialDevice)).state,'granted')
  assert.equal(f.grants,1)
  assert.deepEqual(calls,['query_two_bits','validate_device_token','query_two_bits','validate_device_token','update_two_bits','query_two_bits'])
  await claimDeviceTrial('u',request,f.store,appleTrialDevice);assert.equal(f.grants,1)
  const used=fixture();assert.equal((await claimDeviceTrial('u',request,used.store,appleTrialDevice)).state,'denied');assert.equal(used.grants,0)
  marked=false;valid=false;const invalid=fixture()
  await assert.rejects(claimDeviceTrial('u',request,invalid.store,appleTrialDevice),/BOOK_TRIAL_UNAVAILABLE/)
  assert.equal(invalid.grants,0);assert.equal(marked,false)
 } finally {globalThis.fetch=fetchBefore;keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i]})}
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

test('provider diagnostics distinguish failures without exposing tokens or response bodies',async()=>{
 const {appleTrialDevice,DeviceTrialError,deviceCheckFailureReason}=await import('./deviceTrial.js')
 assert.equal(deviceCheckFailureReason('Bit State Not Found'),'bit_state_not_found')
 assert.equal(deviceCheckFailureReason('unrecognized private value'),'unrecognized')
 const keys=['DEVICECHECK_TEAM_ID','DEVICECHECK_KEY_ID','DEVICECHECK_PRIVATE_KEY','DEVICECHECK_ENVIRONMENT']
 const before=keys.map(k=>process.env[k]),fetchBefore=globalThis.fetch
 try {
  process.env.DEVICECHECK_TEAM_ID='TESTTEAM';process.env.DEVICECHECK_KEY_ID='TESTKEY';process.env.DEVICECHECK_ENVIRONMENT='production'
  process.env.DEVICECHECK_PRIVATE_KEY=generateKeyPairSync('ec',{namedCurve:'P-256'}).privateKey.export({format:'pem',type:'pkcs8'}).toString()
  globalThis.fetch=async()=>new Response('Invalid authorization token: private-value',{status:401})
  await assert.rejects(appleTrialDevice.query(request.token),e=>{
   assert.ok(e instanceof DeviceTrialError)
   assert.deepEqual(e.diagnostic,{stage:'query_two_bits',status:401,reason:'authentication'})
   assert.ok(!JSON.stringify(e).includes('private-value'));assert.ok(!JSON.stringify(e).includes(request.token))
   return true
  })
 } finally {globalThis.fetch=fetchBefore;keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i]})}
})
