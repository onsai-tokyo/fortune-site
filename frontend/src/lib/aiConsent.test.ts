import test from 'node:test'
import assert from 'node:assert/strict'
import {consentFetch, needsAIConsent, AI_CONSENT_VERSION} from './aiConsent'
test('only outbound AI actions need explicit permission',()=>{
 for(const path of ['/api/chat','/api/analyze/self','/api/fortune','/api/report/generate-pdf','/api/preview/question','/api/books','/api/reading/conversations/abc/questions'])assert.equal(needsAIConsent(path,'POST'),true,path)
 for(const path of ['/api/calc/divination','/api/preview/generate?format=json','/api/books/validate','/api/apple/verify','/api/books/operations/abc/cancel-unsubmitted'])assert.equal(needsAIConsent(path,'POST'),false,path)
 assert.equal(needsAIConsent('/api/books','GET'),false)
})
test('decline sends no request; accept sends one versioned request; next action asks again',async()=>{
 const savedFetch=globalThis.fetch, savedWindow=(globalThis as any).window
 let prompts=0, sends=0, allow=false
 ;(globalThis as any).window={confirm:()=>{prompts++;return allow}}
 globalThis.fetch=async(_url,init)=>{sends++;assert.equal(new Headers(init?.headers).get('X-FateLab-AI-Consent'),AI_CONSENT_VERSION);return new Response('{}')}
 try {
  assert.equal((await consentFetch('/api/chat',{method:'POST'})).status,428);assert.equal(sends,0)
  allow=true;await consentFetch('/api/chat',{method:'POST'});assert.equal(sends,1)
  allow=false;await consentFetch('/api/chat',{method:'POST'});assert.equal(sends,1);assert.equal(prompts,3)
 }finally{globalThis.fetch=savedFetch;(globalThis as any).window=savedWindow}
})
