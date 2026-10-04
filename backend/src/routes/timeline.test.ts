import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import {timelineRouter} from './timeline.js'

test('timeline HTTP routes authenticate, preserve status, validate inputs and handle storage failures',async()=>{
 const originalFetch=globalThis.fetch
 const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY,secret:process.env.SUPABASE_JWT_SECRET}
 process.env.SUPABASE_URL='https://timeline-test.invalid';process.env.SUPABASE_ANON_KEY='synthetic';process.env.SUPABASE_JWT_SECRET='timeline-test-secret'
 const user='11111111-1111-4111-8111-111111111111'
 const token=jwt.sign({sub:user,role:'authenticated'},process.env.SUPABASE_JWT_SECRET,{algorithm:'HS256',audience:'authenticated',issuer:process.env.SUPABASE_URL+'/auth/v1',expiresIn:300})
 let profile:any=null,events:any[]=[],consent:any=null,fail=false
 const requests:Array<{url:URL;method:string;body:any;authorization:string|null}>=[]
 globalThis.fetch=async(resource,init)=>{
  const url=new URL(String(resource))
  if(url.hostname!=='timeline-test.invalid')return originalFetch(resource,init)
  const method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):null
  requests.push({url,method,body,authorization:new Headers(init?.headers).get('authorization')})
  if(fail)return new Response(JSON.stringify({message:'synthetic failure'}),{status:503,headers:{'content-type':'application/json'}})
  const table=url.pathname.split('/').at(-1)
  let value:any=null
  if(table==='timeline_profiles'){if(method==='POST')profile=body;value=profile}
  if(table==='life_events')value=events
  if(table==='replace_life_events'){events=body.p_events;value=null}
  if(table==='validation_consents'){if(method==='POST')consent=body;value=consent}
  if(table==='reading_conversations')value=null
  return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}})
 }
 const app=express();app.use(express.json());app.use('/api/timeline',timelineRouter);app.use((_error:any,_req:any,res:any,_next:any)=>res.status(500).json({error:'test handler'}))
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
 const address=server.address() as {port:number}
 const call=(path:string,method='GET',body?:unknown,auth=true)=>originalFetch(`http://127.0.0.1:${address.port}/api/timeline${path}`,{method,headers:{'content-type':'application/json',...(auth?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)})
 try {
  assert.equal((await call('/events','GET',undefined,false)).status,401)
  assert.equal(requests.length,0)
  assert.equal((await call('/profile','PUT',{birthDate:'2026-02-30'})).status,400)
  assert.equal((await call('/events','POST',{events:[]})).status,422)
  const birth={birthDate:'1995-03-16',birthTime:'00:52',birthplace:'愛知県名古屋市',gender:'female',relationshipStatus:'single'}
  const created=await call('/profile','PUT',birth)
  assert.equal(created.status,200);assert.equal((await created.json()).profile.relationshipStatus,'single')
  assert.equal(profile.user_id,user)
  assert.equal((await call('/events','POST',{events:[{year:2020,kind:'job',text:'private'}]})).status,400)
  assert.equal((await call('/events','POST',{events:[{year:2020,kind:'job'}]})).status,200)
  const reading=await call('/events');assert.match(reading.headers.get('cache-control')??'',/no-store/);assert.equal((await reading.json()).events.length,1)
  assert.equal((await call('/consent','PUT',{consented:'true'})).status,400)
  assert.equal((await(await call('/consent')).json()).consented,false)
  assert.equal((await call('/consent','PUT',{consented:true})).status,200)
  assert.equal(consent.user_id,user)
  assert.equal((await call('/events/for-reading/22222222-2222-4222-8222-222222222222')).status,404)
  for(const req of requests){assert.equal(req.authorization,`Bearer ${token}`);if(req.method==='GET')assert.equal(req.url.searchParams.get('user_id'),`eq.${user}`)}
  fail=true;assert.equal((await call('/events')).status,503)
 }finally {
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))
  globalThis.fetch=originalFetch
  for(const [key,value] of Object.entries({SUPABASE_URL:saved.url,SUPABASE_ANON_KEY:saved.key,SUPABASE_JWT_SECRET:saved.secret}))if(value===undefined)delete process.env[key];else process.env[key]=value
 }
})
