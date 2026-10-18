import assert from 'node:assert/strict'
import test from 'node:test'
import { premiumAccessFromResults, PremiumAccessUnavailable } from './premium.js'
import { requirePoints } from '../middleware/points.js'
const missing = { data: null, error: null }
const outage = { data: null, error: { code: 'unavailable' } }
const stripe = { data: { subscription_status: 'active', current_period_end: '2030-01-01' }, error: null }
const apple = { data: { subscription_status: 'active', expires_at: '2030-01-01', revoked_at: null }, error: null }
const now = Date.parse('2026-09-05')
test('unknown is distinct from standard; either known active provider is sufficient', () => {
  assert.equal(premiumAccessFromResults(missing, missing, now), 'standard')
  assert.equal(premiumAccessFromResults(outage, missing, now), 'unknown')
  assert.equal(premiumAccessFromResults(missing, outage, now), 'unknown')
  assert.equal(premiumAccessFromResults(outage, outage, now), 'unknown')
  assert.equal(premiumAccessFromResults(stripe, outage, now), 'premium')
  assert.equal(premiumAccessFromResults(outage, apple, now), 'premium')
  assert.equal(premiumAccessFromResults(missing, { ...apple, data: { ...apple.data, revoked_at: '2026-09-01' } }, now), 'standard')
  assert.equal(premiumAccessFromResults({ ...stripe, data: { ...stripe.data, current_period_end: 'bad' } }, missing, now), 'unknown')
})
test('premium lookup failure blocks before any point deduction or next handler', async () => {
  let status = 0, body: any, next = false
  const res = { status(value: number) { status = value; return this }, json(value: unknown) { body = value } }
  await requirePoints(1, async () => { throw new PremiumAccessUnavailable() })({ userId: 'synthetic', accessToken: 'synthetic' } as any, res as any, () => { next = true })
  assert.equal(status, 503); assert.equal(body.code, 'DEPENDENCY_NOT_READY'); assert.equal(next, false)
})

test('reading question handler does not charge or reserve usage when provider lookup fails', async () => {
  const { readingRouter } = await import('../routes/reading.js')
  const priorFetch = globalThis.fetch
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_ANON_KEY']
  const prior = names.map(name => process.env[name])
  process.env.SUPABASE_URL = 'https://synthetic.invalid'
  process.env.SUPABASE_SERVICE_KEY = 'synthetic-service'
  process.env.SUPABASE_ANON_KEY = 'synthetic-anon'
  const calls: string[] = []
  globalThis.fetch = async input => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    assert.equal(url.hostname, 'synthetic.invalid')
    calls.push(url.pathname)
    if (url.pathname.endsWith('/reading_conversations')) return new Response(JSON.stringify({ id: 'synthetic-conversation' }), { status: 200 })
    if (url.pathname.endsWith('/stripe_subscriptions')) return new Response(JSON.stringify({ code: 'synthetic-outage' }), { status: 503 })
    if (url.pathname.endsWith('/app_store_subscriptions')) return new Response('[]', { status: 200 })
    throw Error('Unexpected query or quota mutation')
  }
  try {
    const route = (readingRouter as any).stack.find((entry: any) => entry.route?.path === '/conversations/:id/questions')
    const handler = route.route.stack.at(-1).handle
    let status = 0, body: any
    const res = { destroyed: false, writableEnded: false, headersSent: false, status(value: number) { status = value; return this }, json(value: unknown) { body = value } }
    await handler({ header: () => '11111111-1111-4111-8111-111111111111', userId: 'synthetic-user', accessToken: 'synthetic-token', params: { id: 'synthetic-conversation' }, body: { question: '今の仕事について教えてください' } }, res)
    assert.equal(status, 503); assert.equal(body.code, 'DEPENDENCY_NOT_READY')
    assert.equal(calls.some(path => path.includes('/rpc/')), false)
    assert.equal(calls.length, 3)
  } finally {
    globalThis.fetch = priorFetch
    names.forEach((name, index) => { if (prior[index] === undefined) delete process.env[name]; else process.env[name] = prior[index] })
  }
})

test('legacy point calls use service credentials and validate acknowledgements',async()=>{
 const {addPoints}=await import('../middleware/points.js')
 const names=['SUPABASE_URL','SUPABASE_SERVICE_KEY'],old=names.map(name=>process.env[name]),previousFetch=globalThis.fetch
 process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='synthetic-service'
 let reply:unknown=0,calls=0
 globalThis.fetch=async(url,init)=>{
  calls++;const headers=new Headers(init?.headers),body=JSON.parse(String(init?.body))
  assert.equal(headers.get('authorization'),'Bearer synthetic-service');assert.equal(body.target_user_id,'verified-owner')
  assert.ok(String(url).endsWith('/deduct_points')||String(url).endsWith('/add_points'))
  return new Response(JSON.stringify(reply),{headers:{'Content-Type':'application/json'}})
 }
 try{
  const invoke=async()=>{
   let status=200,next=false
   const res={status(n:number){status=n;return this},json(){}}
   const req={userId:'verified-owner',accessToken:'end-user-token',body:{target_user_id:'foreign'},header:()=>undefined}
   await requirePoints(3,async()=>false)(req as any,res as any,()=>{next=true});return {status,next}
  }
  assert.deepEqual(await invoke(),{status:200,next:true})
  reply=-1;assert.deepEqual(await invoke(),{status:402,next:false})
  for(const invalid of [null,'3',1.5,-2,{},2147483648]){reply=invalid;assert.deepEqual(await invoke(),{status:503,next:false});await assert.rejects(addPoints('verified-owner',3))}
  reply=6;assert.equal(await addPoints('verified-owner',3),6)
  const before=calls
  for(const invalid of [-3,0,1.5,NaN,2147483648]){assert.throws(()=>requirePoints(invalid));await assert.rejects(addPoints('verified-owner',invalid))}
  assert.equal(calls,before)
  delete process.env.SUPABASE_SERVICE_KEY;assert.deepEqual(await invoke(),{status:503,next:false})
 }finally{globalThis.fetch=previousFetch;names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})
