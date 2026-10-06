import test from 'node:test'
import assert from 'node:assert/strict'
import { requireAIConsent, AI_CONSENT_VERSION } from './aiConsent.js'

for (const header of [undefined, '', 'true', 'anthropic-old', AI_CONSENT_VERSION + ',false']) {
  test(`blocks missing or invalid consent: ${String(header)}`, () => {
    let next = 0, status = 0, code = ''
    requireAIConsent({header:()=>header} as never, {status(n:number){status=n;return this},json(body:{code:string}){code=body.code}} as never, ()=>{next++})
    assert.equal(status,428); assert.equal(code,'AI_CONSENT_REQUIRED'); assert.equal(next,0)
  })
}
test('explicit current consent permits this request only', () => {
  let calls = 0
  const response = {status(){return this},json(){}} as never
  requireAIConsent({header:()=>AI_CONSENT_VERSION} as never,response,()=>{calls++})
  requireAIConsent({header:()=>undefined} as never,response,()=>{calls++})
  assert.equal(calls,1)
})
