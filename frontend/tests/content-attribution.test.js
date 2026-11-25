import assert from 'node:assert/strict'
import test from 'node:test'
import { attributionKey, attributionTtl, browserAttributionFields, captureBrowserVisit, contentId, incomingTouch, landingCampaignFields,
  observeContent, readAttribution, recordContent, recordVisit, sanitizeContentAttribution, taggedTouch } from '../src/web/data/contentAttribution.js'
const store = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) } }
const tags = new URLSearchParams('utm_source=threads&utm_medium=social&utm_campaign=c20261125&utm_content=p20261125_01')
const guide = '/guides/sanmeigaku-stars'
test('only operational date codes, allowed sources and media survive', () => {
  assert.equal(taggedTouch(tags).campaign, 'c20261125')
  for (const p of ['utm_source=alice@example.com', 'utm_source=x&utm_medium=password', 'utm_source=google&utm_medium=organic']) assert.equal(taggedTouch(new URLSearchParams(p)), null)
  for (const v of ['alice@example.com','c20260230','c20261301','c20261125_private','c20261125_1']) assert.equal(taggedTouch(new URLSearchParams('utm_source=x&utm_campaign='+v)).campaign, undefined)
  assert.equal(taggedTouch(new URLSearchParams('utm_source=newsletter')).medium, 'email')
  for (const p of ['/you/years/2027','/books/private-id','/couple/private-id','/r/private-token','/guides/private-token','/guides/sanmeigaku-stars?email=private']) assert.equal(contentId(p), undefined)
  assert.equal(contentId(guide), guide)
})
test('retains touch on direct/internal/reload/auth; new acquisition resets entry and content', () => {
  const s = store(), at = Date.now()
  recordVisit(s, guide, tags, '', true, at); recordContent(s, guide, at)
  for (const [path, params, ref, fresh] of [
    ['/', new URLSearchParams(), '', true], ['/tools/day-master', tags, 'https://fate-lab.com/guides/day-master', true],
    [guide, tags, '', false], ['/restore', tags, 'https://mail.google.com/private', true],
    ['/settings/link', tags, '', true], ['/r/private-token', tags, '', true],
  ]) recordVisit(s,path,params,ref,fresh,at+100)
  assert.equal(readAttribution(s,at+200).at, at); assert.equal(readAttribution(s,at+200).last_content_id, guide)
  assert.equal(readAttribution(s,at+200).acq_entry_page, guide)
  recordVisit(s,'/',new URLSearchParams('utm_source=instagram&utm_content=p20261126_01'),'',true,at+1000)
  const v=readAttribution(s,at+1000)
  assert.equal(v.acq_source,'instagram');assert.equal(v.acq_entry_page,'/');assert.equal(v.last_content_id,'(none)');assert.equal(v.at,at+1000)
})
test('fixed expiry, corrupt/future values and untrusted storage', () => {
  const s=store(), at=Date.now();recordVisit(s,guide,tags,'',true,at);recordContent(s,guide,at+attributionTtl-1)
  assert.equal(readAttribution(s,at+attributionTtl),null);assert.equal(s.getItem(attributionKey),null)
  for(const v of ['{','null',JSON.stringify({at:at+1}),JSON.stringify({at,acq_source:'x',acq_medium:'social',acq_entry_page:'/r/secret'})]){s.setItem(attributionKey,v);assert.equal(readAttribution(s,at),null)}
  const f=sanitizeContentAttribution({acq_source:'x',acq_medium:'social',acq_campaign:'alice@example.com',acq_content:'p20261125_01',acq_entry_page:guide,last_content_id:'/you/private',email:'alice@example.com',result:'private-result'})
  assert.doesNotMatch(JSON.stringify(f),/example.com|private|email|result/)
  const blocked={getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}}
  assert.doesNotThrow(()=>recordVisit(blocked,guide,tags,'',true))
})
test('referrer allowlist ignores spoofed and auth sources', () => {
  assert.deepEqual(incomingTouch(new URLSearchParams(),'https://www.google.co.jp/search?q=private'),{source:'google',medium:'organic'})
  for(const ref of ['https://google.co.jp.evil.test/','https://auth.example.test/verify?token=private','https://constructor/','https://__proto__/'])assert.equal(incomingTouch(new URLSearchParams(),ref),null)
  assert.equal(incomingTouch(new URLSearchParams('utm_source=private'),'https://www.google.com/'),null)
  assert.equal(incomingTouch(tags,'https://fate-lab.com/'),null)
})
test('both content/tag startup orders capture once; standard campaign only on first view', t => {
  for(const k of ['window','location','document','localStorage']){const old=Object.getOwnPropertyDescriptor(globalThis,k);t.after(()=>{if(old)Object.defineProperty(globalThis,k,old);else delete globalThis[k]})}
  for(const contentFirst of [true,false]){
    globalThis.window={};globalThis.localStorage=store();globalThis.location=new URL('https://fate-lab.com'+guide+'?'+tags);globalThis.document={referrer:''}
    t.mock.method(performance,'getEntriesByType',()=>[{type:'navigate'}])
    if(contentFirst)observeContent(guide);else captureBrowserVisit()
    const original=readAttribution(localStorage)
    if(!contentFirst)observeContent(guide);else captureBrowserVisit()
    assert.equal(browserAttributionFields().last_content_id,guide);assert.equal(readAttribution(localStorage).at,original.at)
    assert.equal(landingCampaignFields().campaign_content,'p20261125_01');assert.deepEqual(landingCampaignFields(),{})
    assert.doesNotMatch(localStorage.getItem(attributionKey),/utm_|referrer/);t.mock.restoreAll()
  }
})
