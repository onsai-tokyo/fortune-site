import jwt from 'jsonwebtoken'
import {createHash,randomUUID} from 'node:crypto'
import {getSupabaseAdmin} from './supabaseAdmin.js'
export class DeviceTrialError extends Error { constructor(public code:string){super(code)} }
export interface TrialDeviceAPI {query(token:string):Promise<boolean>;mark(token:string):Promise<void>}
export interface TrialStore {begin(user:string,id:string,hash:string):Promise<string>;transition(user:string,id:string,hash:string,expected:string,next:string):Promise<string>;finish(user:string,id:string,hash:string):Promise<string>}
export const trialStore:TrialStore={
 begin:(user,id,hash)=>rpc('ai_book_device_begin',{p_user:user,p_id:id,p_hash:hash}),
 transition:(user,id,hash,expected,next)=>rpc('ai_book_device_transition',{p_user:user,p_id:id,p_hash:hash,p_expected:expected,p_next:next}),
 finish:(user,id,hash)=>rpc('ai_book_device_finish',{p_user:user,p_id:id,p_hash:hash}),
}
async function rpc(name:string,args:Record<string,string>):Promise<string> {
 const {data,error}=await getSupabaseAdmin().rpc(name,args)
 if(error)throw new DeviceTrialError(error.message.includes('BOOK_TRIAL_VERIFICATION_PENDING')?'BOOK_TRIAL_VERIFICATION_PENDING':error.message.includes('BOOK_TRIAL_BUSY')?'BOOK_TRIAL_BUSY':'BOOK_TRIAL_UNAVAILABLE')
 if(typeof data!=='string')throw new DeviceTrialError('BOOK_TRIAL_UNAVAILABLE')
 return data
}
export function deviceCheckConfigured() {
 return !!(process.env.DEVICECHECK_TEAM_ID && process.env.DEVICECHECK_KEY_ID && process.env.DEVICECHECK_PRIVATE_KEY && ['production','development'].includes(process.env.DEVICECHECK_ENVIRONMENT??''))
}
async function apple(path:string,token:string,mark=false) {
 if(!deviceCheckConfigured())throw new DeviceTrialError('BOOK_TRIAL_UNAVAILABLE')
 const auth=jwt.sign({},process.env.DEVICECHECK_PRIVATE_KEY!.replace(/\\n/g,'\n'),{algorithm:'ES256',issuer:process.env.DEVICECHECK_TEAM_ID!,keyid:process.env.DEVICECHECK_KEY_ID!,expiresIn:300})
 const host=process.env.DEVICECHECK_ENVIRONMENT==='production'?'https://api.devicecheck.apple.com':'https://api.development.devicecheck.apple.com'
 const response=await fetch(host+'/v1/'+path,{method:'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},body:JSON.stringify({device_token:token,transaction_id:randomUUID(),timestamp:Date.now(),...(mark?{bit0:true}:{})}),signal:AbortSignal.timeout(10000)})
 if(!response.ok)throw new DeviceTrialError('BOOK_TRIAL_UNAVAILABLE')
 return response
}
export function parseDeviceBits(text:string):boolean|null {
 if(text.trim()==='Bit State Not Found')return null
 try {const value=JSON.parse(text);if(typeof value?.bit0==='boolean')return value.bit0} catch {}
 throw new DeviceTrialError('BOOK_TRIAL_UNAVAILABLE')
}
export const appleTrialDevice:TrialDeviceAPI={
 async query(token){const response=await apple('query_two_bits',token);const used=parseDeviceBits(await response.text());if(used===null){await apple('validate_device_token',token);return false}return used},
 async mark(token){await apple('update_two_bits',token,true)},
}
export async function claimDeviceTrial(user:string,input:unknown,store:TrialStore=trialStore,device:TrialDeviceAPI=appleTrialDevice) {
 const body=input as {requestId?:unknown;token?:unknown}
 if(typeof body?.requestId!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestId)||typeof body.token!=='string'||body.token.length<16||body.token.length>8192||!/^[A-Za-z0-9+/]+=*$/.test(body.token))throw new DeviceTrialError('BOOK_TRIAL_INPUT')
 const id=body.requestId.toLowerCase(),hash=createHash('sha256').update(body.token).digest('hex')
 let state=await store.begin(user,id,hash)
 if(state==='indeterminate')throw new DeviceTrialError('BOOK_TRIAL_VERIFICATION_PENDING')
 if(state==='granted'||state==='denied')return {state}
 if(state==='checking') {
  let used:boolean
  try { used=await device.query(body.token) }
  catch(error) {
    // No update has been authorized by this flow. CAS cannot cancel a concurrent writer.
    await store.transition(user,id,hash,'checking','denied').catch(()=>{})
    throw error
  }
  state=await store.transition(user,id,hash,'checking',used?'denied':'writing')
  if(state==='denied'||state==='granted')return {state}
 }
 if(state==='indeterminate')throw new DeviceTrialError('BOOK_TRIAL_VERIFICATION_PENDING')
 if(state!=='writing')throw new DeviceTrialError('BOOK_TRIAL_UNAVAILABLE')
 // The durable reservation proves this token was unused before this update intent.
 if(!await device.query(body.token))await device.mark(body.token)
 // Confirm before granting, including after a prior lost update response.
 if(!await device.query(body.token))throw new DeviceTrialError('BOOK_TRIAL_UNAVAILABLE')
 const finished=await store.finish(user,id,hash)
 if(finished==='indeterminate')throw new DeviceTrialError('BOOK_TRIAL_VERIFICATION_PENDING')
 return {state:finished}
}
