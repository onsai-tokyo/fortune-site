import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { readingFocusPages, readingFocusForPath, readingFocusLandingHtml } from '../src/web/data/readingFocus.js'
import { focusChapters, focusCoupleYears, marriageYears } from '../src/web/data/focusResults.ts'
import { appRobots } from '../src/web/data/indexingPolicy.js'
import { sanitizeLandingPath, sanitizeAttribution } from '../src/web/data/measurementRules.js'
import handler from '../api/threads-event.js'

const dist = new URL('../dist/', import.meta.url)
const html = route => fs.readFileSync(new URL(`${route.replace(/^\//,'')}/index.html`,dist),'utf8')
const plain = html => html.replace(/<[^>]*>/g,'')

test('four focus pages have readable answers, mechanisms, four FAQs, WebApplication and exact public paths', () => {
  const xml = fs.readFileSync(new URL('sitemap-uranai.xml',dist),'utf8')
  assert.equal([...xml.matchAll(/<loc>/g)].length,4)
  for(const [focus,page] of Object.entries(readingFocusPages)) {
    const output=html(page.path),body=readingFocusLandingHtml(focus)
    assert.ok(output.includes(body))
    assert.match(output,/<meta name="robots" content="index,follow/)
    assert.ok(output.includes(`<title>${page.title}｜Fate Lab</title>`))
    assert.ok(output.includes(page.heading))
    assert.doesNotMatch(body,/<script|hidden|display:\s*none/)
    assert.equal([...body.matchAll(/<h3 /g)].length,4)
    assert.ok(xml.includes(`https://fate-lab.com${page.path}`))
    assert.ok(appRobots(page.path).startsWith('index,follow'))
    assert.equal(readingFocusForPath(page.path),focus)
    const graphs=[...output.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].flatMap(([,json])=>{const o=JSON.parse(json);return o['@graph']??[o]})
    const app=graphs.find(o=>o['@type']==='WebApplication')
    assert.equal(app.url,`https://fate-lab.com${page.path}`)
    assert.equal(Number(app.offers.price),0)
    assert.ok(!graphs.some(o=>o['@type']==='FAQPage'))
    const guide=html(page.guide)
    assert.ok(guide.includes(`<title>${page.guideTitle}｜Fate Lab</title>`))
    assert.ok(guide.includes(`<h1>${page.guideTitle}</h1>`))
    assert.doesNotMatch(page.guideTitle,/占い/)
    const article=guide.match(/<article>([\s\S]*?)<\/article>/)[1]
    assert.ok(article.includes(`href="${page.path}"`))
    assert.ok(article.indexOf(`href="${page.path}"`)<article.indexOf('<h2>'))
    assert.ok(body.includes(`href="${page.guide}"`))
  }
  assert.match(html('/guides/ex-partner-feelings'),/href="\/uranai\/fukuen"/)
  assert.doesNotMatch(xml,/2027-fortune/)
})

test('focus ordering preserves engine texts and years without mutating the supplied result', () => {
  const chapters=['02','04','07','08','09','11'].map(n=>({id:`personality-${n}`,title:`source ${n}`,sub:'',image:'',sections:[]}))
  const years=[2021,2024,2026,2027].map(year=>({year,title:`source ${year}`,body:[`engine body ${year}`]}))
  const original=JSON.stringify({chapters,years})
  assert.deepEqual(focusChapters(chapters,'aite').map(c=>c.id),['personality-04','personality-07','personality-09'])
  assert.deepEqual(focusChapters(chapters,'aite','友人').map(c=>c.id),['personality-04','personality-07','personality-02'])
  assert.deepEqual(focusChapters(chapters,'kataomoi').map(c=>c.id),['personality-08','personality-07','personality-09'])
  assert.deepEqual(focusChapters(chapters,'fukuen').map(c=>c.id),['personality-09','personality-07','personality-04'])
  assert.deepEqual(focusCoupleYears(years,'fukuen',2026,2024).map(y=>y.year),[2024,2026,2027,2021])
  assert.deepEqual(focusCoupleYears(years,'kataomoi',2026).map(y=>y.year),[2026,2027,2024,2021])
  assert.equal(JSON.stringify({chapters,years}),original)
  for(const row of focusCoupleYears(years,'aite',2026))assert.ok(years.includes(row))
})

test('marriage display quotes only returned engine events and candidates and requires ten complete years', () => {
  const annual=Array.from({length:10},(_,i)=>({year:2026+i,kanshi:'fixture',tenGod:'fixture',relationshipSignals:[`source signal ${i}`],relationshipEvents:[`source event ${i}`],themes:[`source theme ${i}`]}))
  const input={annual,marriageCandidates:[annual[3]]},before=JSON.stringify(input)
  const result=marriageYears(input,2026)
  assert.equal(result.length,10)
  assert.deepEqual(result.filter(y=>y.tags.length).map(y=>y.year),[2029])
  result.forEach((year,i)=>{
    assert.equal(year.summary,annual[i].relationshipEvents[0])
    assert.equal(year.sections[1].body,annual[i].relationshipSignals[0])
  })
  assert.equal(JSON.stringify(input),before)
  assert.throws(()=>marriageYears({...input,annual:annual.slice(1)},2026),/TEN_YEARS_UNAVAILABLE/)
  assert.throws(()=>marriageYears({...input,annual:[...annual.slice(0,9),annual[0]]},2026),/TEN_YEARS_UNAVAILABLE/)
})

test('focus attribution accepts only four fixed public routes and rejects private suffixes and input queries', () => {
  for(const page of Object.values(readingFocusPages))assert.equal(sanitizeLandingPath(page.path),page.path)
  for(const value of ['/uranai/private-token','/uranai/konki/private-token','/uranai/fukuen?birthDate=1995-02-20']){
    assert.equal(sanitizeLandingPath(value),'other')
    assert.equal(sanitizeAttribution({landing_path:value}).landing_path,undefined)
    assert.equal(readingFocusForPath(value),undefined)
    assert.equal(appRobots(value),'noindex,nofollow')
  }
})

test('GA4 receives focus attribution but no birth data, relationship year or result identifier', async t => {
  const oldFetch=globalThis.fetch,oldSecret=process.env.GA4_API_SECRET,requests=[]
  t.after(()=>{globalThis.fetch=oldFetch;if(oldSecret===undefined)delete process.env.GA4_API_SECRET;else process.env.GA4_API_SECRET=oldSecret})
  process.env.GA4_API_SECRET='test-secret'
  globalThis.fetch=async (_url,init)=>{requests.push(JSON.parse(init.body));return {ok:true}}
  const privateValues={birthDate:'1995-02-20',gender:'female',birthTime:'05:40',meetingYear:2021,breakupYear:2024,partnerId:'private-result-id',resultUrl:'/r/private-token'}
  for(const page of Object.values(readingFocusPages)){
    let status
    const response={setHeader(){},status(n){status=n;return this},end(){}}
    await handler({method:'POST',headers:{origin:'https://fate-lab.com'},body:{event:'couple_reading_complete',clientId:'12345.1795000000',sessionId:Math.floor(Date.now()/1000),source:'organic_search',landing_path:page.path,...privateValues}},response)
    assert.equal(status,204)
    const sent=requests.at(-1)
    assert.equal(sent.events[0].params.landing_path,page.path)
    const json=JSON.stringify(sent)
    for(const [key,value] of Object.entries(privateValues)){
      assert.ok(!json.includes(key))
      if(typeof value==='string')assert.ok(!json.includes(value))
      else assert.ok(!Object.values(sent.events[0].params).includes(value))
    }
  }
})

test('static guide measurement loads its published modules without the SPA bundle', async () => {
  const { sanitizeLandingPath } = await import(new URL('assets/measurementRules.js', dist))
  assert.equal(sanitizeLandingPath('/uranai/konki'), '/uranai/konki')
  const { startGuideReading } = await import(new URL('assets/guideReadingMeasurement.js', dist))
  assert.equal(typeof startGuideReading, 'function')
})
