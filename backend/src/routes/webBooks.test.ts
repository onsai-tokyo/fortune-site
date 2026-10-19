import test from 'node:test'
// Included here because npm test enumerates Web route suites explicitly.
import '../lib/aiBookWebDiagnostics.test.js'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { webRouter } from './web.js'
import { publicBook } from './webBooks.js'
import { declaredAdult } from '../middleware/webAiAge.js'

test('Web AI declared age is fail-closed and changes at the eighteenth birthday in Japan', () => {
  assert.equal(declaredAdult('2008-10-19', new Date('2026-10-18T14:59:59Z')), false)
  assert.equal(declaredAdult('2008-10-19', new Date('2026-10-18T15:00:00Z')), true)
  for (const dob of [null, '', '2008-02-30', '2008-10-19junk', '2999-01-01']) {
    assert.equal(declaredAdult(dob, new Date('2026-10-19T00:00:00Z')), false)
  }
})

test('Web projections ignore failed/stale questions and retain main failure metadata', () => {
  const now = new Date().toISOString()
  const book = publicBook({state:'failed',metadata:{failure:{code:'BOOK_OUTPUT_SCHEMA'}},ai_book_questions:[{state:'failed',created_at:now},{state:'generating',created_at:'2000-01-01'}]})
  assert.equal(book.questionsLeft, 2)
  assert.equal(book.failureCode, 'BOOK_OUTPUT_SCHEMA')
  assert.equal(publicBook({ai_book_questions:[{state:'completed',created_at:now},{state:'generating',created_at:now}]}).questionsLeft, 0)
})

test('Web has its own paid-credit orders and blocks reading questions without mutating iOS policy', async () => {
  const originalFetch = globalThis.fetch
  const keys = ['SUPABASE_URL','SUPABASE_SERVICE_KEY','SUPABASE_JWT_SECRET','FREE_QUESTION_LIMIT'] as const
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))
  process.env.SUPABASE_URL = 'https://web-isolation.invalid'
  process.env.SUPABASE_SERVICE_KEY = 'synthetic'
  process.env.SUPABASE_JWT_SECRET = 'synthetic-web-secret'
  process.env.FREE_QUESTION_LIMIT = '2'
  const user='11111111-1111-4111-8111-111111111111', source='22222222-2222-4222-8222-222222222222', op='33333333-3333-4333-8333-333333333333', book='44444444-4444-4444-8444-444444444444'
  const token=jwt.sign({sub:user,role:'authenticated'},process.env.SUPABASE_JWT_SECRET,{algorithm:'HS256',audience:'authenticated',issuer:process.env.SUPABASE_URL+'/auth/v1',expiresIn:300})
  const question='仕事の進め方について自分の特徴を踏まえて詳しく知りたいです。'
  const row={id:book,source_id:source,operation_id:op,question,theme:'仕事',state:'queued',source_snapshot:[],funding_source:'web'}
  let orders=0, accepted=false
  let selfBirth: unknown = '1987-05-12'
  let ageLookupFailed = false
  const calls: string[]=[]
  globalThis.fetch=async(resource, init)=>{
    const url=new URL(String(resource))
    if(url.hostname!=='web-isolation.invalid') throw new Error('Unexpected external request in local-only fixture')
    const name=url.pathname.split('/').at(-1)!
    calls.push(name)
    let value: unknown=null
    if(name==='ai_book_settings') value={enabled:true,monthly_credits:3}
    if(name==='ai_book_grants') {
      assert.equal(url.searchParams.get('source'),'eq.web')
      assert.equal(url.searchParams.get('environment'),'eq.Web')
      value=[{source:'web',starts_at:'2020-01-01',expires_at:null,ai_book_credits:[{consumed_by:null,recovery_until:null}]}]
    }
    if(name==='ai_books') value=url.searchParams.has('limit')?(accepted?[row]:[]):accepted?row:null
    if(name==='reading_conversations') {
      if (url.searchParams.get('select') === 'birth_data') {
        assert.equal(url.searchParams.get('user_id'), 'eq.'+user)
        assert.equal(url.searchParams.get('or'), '(kind.eq.self,kind.eq.personal,kind.is.null)')
        assert.equal(url.searchParams.get('limit'), '1')
        if (ageLookupFailed) return new Response(JSON.stringify({message:'synthetic failure'}), {status:503,headers:{'content-type':'application/json'}})
      }
      value={id:source,title:'本人',kind:'self',birth_data:{birthDate:selfBirth},calculated_data:{_structuredReport:{version:3,reportText:'本人',generator:'deterministic',generatorVersion:'fixture',cards:[1,2,3].map(n=>({id:`card-${n}`,kind:'essence',title:'仕事',summary:'本人の特徴',tags:[],pages:[],evidence:[]}))}}}
    }
    if(name==='ai_book_order_web'){
      const input = JSON.parse(String(init?.body))
      assert.equal(input.p_snapshot[0].id,'card-2')
      assert.equal(input.p_snapshot[0].focused,true)
      row.source_snapshot=input.p_snapshot
      orders++;accepted=true;value=book
    }
    if(name==='ai_book_question_begin')value={state:'generating',created:false}
    assert.notEqual(name,'ai_book_order','must not call the iOS order RPC')
    return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}})
  }
  const app=express(); app.use(express.json()); app.use('/api/web',webRouter)
  const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve))
  const port=(server.address() as {port:number}).port
  const call=(path:string, body?:unknown, consent=true)=>originalFetch(`http://127.0.0.1:${port}/api/web${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...(consent?{'X-FateLab-AI-Consent':'anthropic-inline-2026-10-11-v3'}:{})},body:body?JSON.stringify(body):undefined})
  try {
    assert.equal((await (await call('/books/status')).json()).remaining,1)
    const payload={operationId:op,sourceId:source,theme:'仕事',question,focusCardId:'card-2'}
    assert.equal((await call('/books/validate',{...payload,focusCardId:''})).status,422)
    assert.equal((await call('/books',payload,false)).status,428)
    assert.equal(orders,0)
    assert.equal((await call('/books',payload)).status,201)
    assert.equal((await call('/books',payload)).status,200)
    assert.equal((await call('/books',{...payload,focusCardId:'card-1'})).status,409)
    assert.equal(orders,1)
    assert.equal((await call('/reading/conversations/'+source+'/questions',{question})).status,403)
    const beforePreview = calls.length
    const previewQuestion = await call('/preview/question', { question, questionToken: 'synthetic-paid-token', birthDate: '1980-01-01' })
    assert.equal(previewQuestion.status,403)
    assert.equal((await previewQuestion.json()).code,'WEB_PREVIEW_QUESTIONS_DISABLED')
    assert.equal(calls.length,beforePreview,'Web legacy question must stop before shared handler or storage calls')
    const pending=await call('/books/'+book+'/questions',{operationId:op,question})
    assert.equal(pending.status,409)
    assert.equal((await pending.json()).code,'BOOK_QUESTION_PENDING')
    assert.ok(!calls.includes('ai_book_question_fail'),'duplicate pending request must not fail the original operation')
    assert.equal(process.env.FREE_QUESTION_LIMIT,'2')
    assert.ok(!calls.includes('app_store_subscriptions'))
    assert.ok(!calls.includes('ai_book_sync_trial'))
    assert.ok(!calls.includes('ai_book_sync_member'),'Web orders must not mutate iOS member grants')
    for (const birth of [`${new Date().getUTCFullYear()-17}-01-01`, `${new Date().getUTCFullYear()-15}-01-01`, null, '2008-02-30']) {
      selfBirth = birth
      for (const path of ['/books/validate', '/books', '/books/'+book+'/questions']) {
        const before = calls.length
        const blocked = await call(path, {...payload,birthDate:'1980-01-01',age:40})
        assert.equal(blocked.status,403)
        assert.equal((await blocked.json()).code,'WEB_AI_ADULT_ONLY')
        assert.ok(!calls.slice(before).some(c => c.startsWith('ai_book_question_') || c==='ai_book_order_web'), 'blocked requests must not reserve credits/questions or call AI')
      }
      assert.equal((await call('/books')).status,200,'existing books remain readable')
    }
    ageLookupFailed = true
    assert.equal((await call('/books/validate',payload)).status,503,'lookup failure must not grant access')
    ageLookupFailed = false
    selfBirth = '1987-05-12'
    assert.equal((await call('/books',payload)).status,200,'adult retries remain idempotent')
    assert.equal(orders,1)
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve()))
    globalThis.fetch=originalFetch
    for(const k of keys) if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]
  }
})
