/** Actual Express -> supabase-js -> local HTTP PostgREST -> PostgreSQL integration.
 * Only the /rest/v1 URL prefix is translated; SQL/RPC responses are never mocked.
 * Synthetic report/answer content is supplied to operation RPCs (no AI calls).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import { partnersRouter } from '../routes/partners.js'
import { readingRouter } from '../routes/reading.js'
import { previewRouter } from '../routes/preview.js'
import { apiMaintenanceGate } from '../lib/apiMaintenance.js'

const rest = process.env.FLOW_TEST_REST!
assert.match(rest, /^http:\/\/127\.0\.0\.1:\d+$/)
const secret = process.env.FLOW_TEST_SECRET!
assert.equal(secret, 'synthetic-only-local-postgrest-test-secret')
const owner = '33333333-3333-4333-8333-333333333333'
const other = '44444444-4444-4444-8444-444444444444'
const origin = 'https://synthetic-postgrest.invalid'
const token = (role: string, user?: string) => jwt.sign({ role, sub: user, aud: 'authenticated', iss: origin + '/auth/v1' }, secret, { expiresIn: 300 })
process.env.SUPABASE_URL = origin
process.env.SUPABASE_ANON_KEY = token('anon')
process.env.SUPABASE_SERVICE_KEY = token('service_role')
process.env.SUPABASE_JWT_SECRET = secret
process.env.AI_REPORT_ENABLED = 'false'
process.env.FACT_PIPELINE = 'v2'
process.env.NARRATIVE_ENGINE = 'blocks'
process.env.REQUIRE_READING_AUTH = 'true'
delete process.env.ANTHROPIC_API_KEY
const nativeFetch = globalThis.fetch
let loseNext: string | null = 'register_partner_operation'
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url)
  assert.equal(url.origin, origin, 'External service calls prohibited')
  assert.ok(url.pathname.startsWith('/rest/v1/'), 'Only actual local PostgREST is permitted')
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer()
  const response = await nativeFetch(rest + url.pathname.slice('/rest/v1'.length) + url.search,
    { method: request.method, headers: request.headers, body })
  if (!response.ok) console.error('Local PostgREST failure:', url.pathname, response.status, await response.clone().text())
  if (loseNext && url.pathname === '/rest/v1/rpc/' + loseNext && response.ok) {
    await response.arrayBuffer() // Commit completed; deliberately discard its acknowledgement.
    loseNext = null
    return new Response('{"message":"synthetic committed acknowledgement lost"}', {status: 503, headers: {'Content-Type':'application/json'}})
  }
  return response
}
let maintenance = true
const app = express(); app.use('/api',apiMaintenanceGate(()=>maintenance)); app.use(express.json()); app.use('/api/partners', partnersRouter); app.use('/api/reading', readingRouter); app.use('/api/preview', previewRouter)
const server = app.listen(0, '127.0.0.1')
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
const address = server.address(); assert.ok(address && typeof address !== 'string')
const base = `http://127.0.0.1:${address.port}/api`
async function call(path: string, method = 'GET', body?: unknown, op?: string, user = owner) {
  return nativeFetch(base + path, {method, headers: {authorization: 'Bearer '+token('authenticated', user), 'Content-Type':'application/json', ...(op ? {'Idempotency-Key':op} : {})}, ...(body === undefined ? {} : {body:JSON.stringify(body)})})
}
async function data(response: Response, status = 200): Promise<any> {
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body
}
async function rpc(name: string, body: unknown, role = 'service_role', user?: string, status = 200): Promise<any> {
  return data(await nativeFetch(rest+'/rpc/'+name, {method:'POST', headers:{authorization:'Bearer '+token(role,user), 'Content-Type':'application/json'},body:JSON.stringify(body)}),status)
}
async function select(table: string, user = owner): Promise<any> {
  return data(await nativeFetch(rest+'/'+table, {headers:{authorization:'Bearer '+token('authenticated',user)}}))
}
function pass(label: string) { console.log('PASS HTTP/PostgREST:', label) }
try {
  const stopped = await call('/partners','POST',{invalid:'must not reach parser or DB'})
  assert.equal(stopped.headers.get('retry-after'),'60')
  assert.equal(stopped.headers.get('cache-control'),'no-store')
  assert.equal((await data(stopped,503)).code,'MAINTENANCE_MODE')
  assert.equal((await nativeFetch(base+'/stripe/webhook',{method:'POST',body:'invalid body'})).status,503)
  assert.equal((await select('reading_revisions')).length,0)
  maintenance = false
  pass('cutover gate blocks APIs and callbacks before writes; normal requests resume when disabled')
  assert.equal((await nativeFetch(base+'/partners')).status,401)
  const op = randomUUID(), cancelled = randomUUID()
  const profile = {displayName:'合成REST試験',birthDate:'2000-01-01',birthplace:'東京都',gender:'female',relationshipType:'friend',relationshipLabel:'友人'}
  assert.equal((await call('/partners','POST',profile,op)).status,503)
  const recoveredResponse = await call('/partners/registration/operations/'+op)
  assert.equal(recoveredResponse.headers.get('cache-control'),'private, no-store')
  const recovered = await data(recoveredResponse); assert.equal(recovered.state,'completed')
  const replay = await data(await call('/partners','POST',profile,op),201)
  assert.equal(replay.partner.id,recovered.partner.id)
  assert.equal((await data(await call('/partners'))).partners.length,1)
  assert.equal((await data(await call('/partners/registration/operations/'+op,'GET',undefined,undefined,other))).state,'not_found')
  assert.equal((await data(await call('/partners','GET',undefined,undefined,other))).partners.length,0)
  assert.equal((await nativeFetch(rest+'/partner_profiles',{headers:{authorization:'Bearer '+token('authenticated',other)}})).status,403)
  pass('registration commit followed by lost response, GET recovery, replay, owner isolation')
  assert.equal((await data(await call('/partners/registration/operations/'+cancelled+'/cancel','POST'))).state,'cancelled')
  assert.equal((await call('/partners','POST',profile,cancelled)).status,410)
  pass('cancelled registration rejects delayed POST')

  const generation = {p_user:owner,p_op:randomUUID(),p_worker:randomUUID(),p_payload:{birthDate:'1990-01-01'},p_context:{synthetic:true}}
  const starts = await Promise.all(Array.from({length:6},()=>rpc('begin_self_generation',generation)))
  assert.equal(starts.filter(x=>x.state==='started').length,1)
  const report = {version:3,reportText:'synthetic saved body',cards:[{id:'synthetic'}],unknownMetadata:{preserve:true}}
  const done = await rpc('settle_self_generation',{p_user:owner,p_op:generation.p_op,p_worker:generation.p_worker,p_result:report})
  assert.deepEqual((await rpc('get_self_generation',{p_user:owner,p_op:generation.p_op})).result,done.result)
  assert.equal((await rpc('get_self_generation',{p_user:other,p_op:generation.p_op})).state,'not_found')
  pass('one generation worker, durable result and owner-scoped recovery')

  const generatedOp = randomUUID()
  const birth = {birthDate:'2000-01-01',birthTime:'',birthplace:'東京都',gender:'female'}
  loseNext = 'settle_self_generation'
  const interrupted = await call('/preview/generate?format=sse','POST',birth,generatedOp)
  assert.equal(interrupted.status,200)
  const interruptedEvents = await interrupted.text()
  assert.doesNotMatch(interruptedEvents, /"type":"complete"/)
  assert.match(interruptedEvents, /"type":"error"/)
  const generated = await data(await call('/preview/generations/'+generatedOp))
  assert.equal(generated.state,'completed')
  assert.ok(generated.result.reportText.length > 0 && generated.result.cards.length > 0)
  assert.deepEqual(await data(await call('/preview/generate','POST',birth,generatedOp)),generated.result)
  assert.equal((await data(await call('/preview/generations/'+generatedOp,'GET',undefined,undefined,other))).state,'not_found')
  pass('real deterministic generation persists before lost acknowledgement; GET and replay return exact report')

  const payload = {birthData:{birthDate:'1990-01-01'},calculatedData:{synthetic:true},reportText:report.reportText,structuredReport:report}
  const saveOp = randomUUID(); loseNext = 'save_reading_revision'
  assert.equal((await call('/reading/conversations','POST',payload,saveOp)).status,503)
  const saved = await data(await call('/reading/conversations','POST',payload,saveOp))
  assert.equal(saved.reused,true)
  assert.equal((await call('/reading/conversations','POST',{...payload,reportText:'changed',structuredReport:undefined},saveOp)).status,409)
  const list = await data(await call('/reading/conversations'))
  assert.equal(list.conversations.length,1)
  assert.equal(list.conversations[0].id,saved.id)
  assert.equal((await data(await call('/reading/conversations','GET',undefined,undefined,other))).conversations.length,0)
  const status = await data(await call('/reading/status')); assert.equal(status.premium,false); assert.equal(status.hasReading,true)
  assert.equal((await select('reading_revisions',other)).length,0)
  pass('save acknowledgement loss/replay, PostgREST joined history, RLS, real status response')

  const chatOp = randomUUID()
  const chat = await data(await call('/reading/conversations/'+saved.id+'/chat','POST',{question:'この結果を詳しく教えてください'},chatOp),201)
  assert.equal((await data(await call('/reading/conversations/'+saved.id+'/chat','POST',{question:'この結果を詳しく教えてください'},chatOp))).id,chat.id)
  assert.equal((await call('/reading/conversations/'+saved.id+'/chat','POST',{question:'この結果を詳しく教えてください'},randomUUID(),other)).status,404)
  const q = {p_user:owner,p_op:randomUUID(),p_conversation:chat.id,p_question:'synthetic question',p_worker:randomUUID(),p_free_limit:2,p_user_limit:100,p_global_limit:5000}
  const questions = await Promise.all(Array.from({length:6},()=>rpc('begin_reading_question',q)))
  assert.equal(questions.filter(x=>x.state==='started').length,1)
  const answer = {p_user:owner,p_op:q.p_op,p_worker:q.p_worker,p_answer:'synthetic answer',p_systems:['test'],p_suggestions:[]}
  const answered = await rpc('complete_reading_question',answer)
  assert.deepEqual(await rpc('complete_reading_question',answer),answered)
  const questionStatus = await data(await call('/reading/conversations/'+chat.id+'/questions/'+q.p_op))
  assert.equal(questionStatus.state,'completed')
  assert.equal((await select('reading_messages')).length,2)
  const usage = await data(await call('/reading/status')); assert.equal(usage.used,1)
  const failedQuestion = {...q,p_op:randomUUID()}
  assert.equal((await rpc('begin_reading_question',failedQuestion)).state,'started')
  await Promise.all(Array.from({length:6},()=>rpc('fail_reading_question',{p_user:owner,p_op:failedQuestion.p_op,p_worker:failedQuestion.p_worker})))
  assert.equal((await data(await call('/reading/status'))).used,1)
  pass('chat pins source; concurrent question retry commits two messages; failure refunds quota once')

  const compat = {p_user:owner,p_op:randomUUID(),p_worker:randomUUID(),p_source:saved.id,p_partner:recovered.partner.id,p_request:{relationshipType:'friend'},p_context:{synthetic:true},p_premium:false}
  const reserved = await Promise.all(Array.from({length:6},()=>rpc('begin_compatibility_operation',compat)))
  assert.equal(reserved.filter(x=>x.state==='started').length,1)
  assert.equal((await select('user_points'))[0].balance,0)
  await Promise.all(Array.from({length:6},()=>rpc('fail_compatibility_operation',{p_user:owner,p_op:compat.p_op,p_worker:compat.p_worker})))
  assert.equal((await select('user_points'))[0].balance,3)
  assert.equal((await select('user_points'))[0].total_earned,3)
  pass('concurrent compatibility reservation debits once and failure refunds once')

  for (const role of ['anon','authenticated']) {
    for (const [name,args] of [
      ['register_partner_operation',{p_user:other,p_op:randomUUID(),p_profile:{}}],
      ['begin_self_generation',generation], ['begin_reading_question',q],
      ['begin_compatibility_operation',compat], ['deduct_points',{target_user_id:owner,cost:-3}],
      ['add_points',{target_user_id:owner,amount:100}],
    ] as const) {
      const rejected = await nativeFetch(rest+'/rpc/'+name,{method:'POST',headers:{authorization:'Bearer '+token(role,owner),'Content-Type':'application/json'},body:JSON.stringify(args)})
      assert.ok([401,403,404].includes(rejected.status),name+' denied for '+role+': '+await rejected.text())
    }
  }
  assert.equal((await select('user_points'))[0].balance,3)
  for (const table of ['partner_registration_operations','reading_question_operations','self_generation_operations','compatibility_operations']) {
    const response = await nativeFetch(rest+'/'+table,{headers:{authorization:'Bearer '+token('authenticated',owner)}})
    assert.ok([403,404].includes(response.status),table+' private ledger')
  }
  pass('PostgREST denies client impersonation, quota/point mutation and private journals')
  assert.equal((await call('/partners/'+recovered.partner.id,'DELETE')).status,204)
  assert.equal((await data(await call('/partners/registration/operations/'+op))).state,'deleted')
  assert.equal((await call('/partners','POST',profile,op)).status,410)
  pass('deleted partner stays deleted on registration replay')
} finally {
  globalThis.fetch = nativeFetch
  server.closeAllConnections()
  await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
}
