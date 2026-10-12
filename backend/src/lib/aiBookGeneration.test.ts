import test from 'node:test'
import assert from 'node:assert/strict'
import type Anthropic from '@anthropic-ai/sdk'
import {documentLength, generateBookDocument, normalizeBookOutput, sanitizeBookHighlights} from './aiBookGeneration.js'
const text='相手に伝える前に、自分が大切にしていることを整理する時間が役立ちます。'
const sources=[1,2,3].map(n=>({id:String(n),title:'原稿'+n,text,version:'test',evidence:[]}))
const draft=()=>({title:'働き方と伝え方を整える',summary:text,answer:text.repeat(8),sections:sources.map(s=>({heading:'話し合いの進め方',body:text.repeat(7),sourceId:s.id,quote:text})),actions:[text,text]})
function fake(outputs:any[],stop='tool_use') {
 let calls=0
 return {client:{messages:{create:async()=>{const input=outputs[calls++];return {stop_reason:stop,usage:{input_tokens:10,output_tokens:20},content:[{type:'tool_use',name:'submit_book',input}]}}}} as unknown as Anthropic,count:()=>calls}
}
test('invalid quote fails without expansion; truncation never delivers',async()=>{
 const d=draft();d.sections[0].quote='この原稿には存在しない引用です。'
 const f=fake([d]);await assert.rejects(generateBookDocument(f.client,'test',{question:text,theme:'仕事',sources}));assert.equal(f.count(),1)
 const truncated=fake([draft()],'max_tokens');await assert.rejects(generateBookDocument(truncated.client,'test',{question:text,theme:'仕事',sources}),/BOOK_TRUNCATED/)
})
test('display text decodes literal newlines without touching source quotations',()=>{
 const d=draft();d.answer+='\\n\\n段落の続き';d.sections[0].body+='\\n次の段落';
 const normalized=normalizeBookOutput(d)
 assert.ok(normalized.answer.endsWith('\n\n段落の続き'));assert.ok(normalized.sections[0].body.endsWith('\n次の段落'))
 assert.equal(normalized.sections[0].quote,d.sections[0].quote)
})


test('invalid highlights are dropped without changing paid reading text or evidence',()=>{
 const d={...draft(),highlights:[text.slice(0,20),'本文にない強調用の言い換えです',42,text.slice(0,20)]}
 const clean=sanitizeBookHighlights(d)
 assert.deepEqual(clean.highlights,[text.slice(0,20)])
 assert.equal(clean.answer,d.answer); assert.deepEqual(clean.sections,d.sections); assert.deepEqual(clean.actions,d.actions)
 assert.deepEqual(sanitizeBookHighlights({...d,highlights:'invalid'}).highlights,[])
})
test('usage records each response before validation failure, including truncation',async()=>{
 const events:any[]=[];const f=fake([draft()],'max_tokens')
 await assert.rejects(generateBookDocument(f.client,'configured-model',{question:text,theme:'仕事',sources},async e=>{events.push(e)}),/BOOK_TRUNCATED/)
 assert.deepEqual(events.map(e=>[e.callIndex,e.phase]),[[1,'started'],[1,'response']])
 assert.equal(events[1].inputTokens,10);assert.equal(events[1].outputTokens,20)
})
test('unavailable durable metering prevents a new provider call',async()=>{
 const f=fake([draft()]);await assert.rejects(generateBookDocument(f.client,'configured-model',{question:text,theme:'仕事',sources},async()=>{throw new Error('BOOK_USAGE_UNAVAILABLE')}))
 assert.equal(f.count(),0)
})


test('complete readings around the target are delivered in one call with exact original text',async()=>{
 for(const length of [1861,1914,1997,2249,2500,3010,3036,3135]) {
  const d=draft();d.summary='要'.repeat(50);d.actions=['行'.repeat(25),'動'.repeat(25)]
  d.sections.forEach(s=>s.body='根'.repeat(400));d.answer='答'.repeat(length-1300)
  assert.equal(documentLength(d),length)
  const f=fake([d]);const out=await generateBookDocument(f.client,'test',{question:text,theme:'仕事',sources})
  assert.equal(f.count(),1);assert.equal(documentLength(out.document),length)
  assert.deepEqual(out.document,sanitizeBookHighlights(d))
  assert.equal(out.inputTokens,10);assert.equal(out.outputTokens,20)
 }
})

test('JSON-encoded arrays normalize without bypassing validation',async()=>{
 const d=draft(),encoded={...d,sections:JSON.stringify(d.sections),actions:JSON.stringify(d.actions)}
 assert.deepEqual(normalizeBookOutput(encoded),d)
 assert.throws(()=>normalizeBookOutput({...encoded,sections:'{"unexpected":true}'}),/BOOK_OUTPUT_SCHEMA/)
 const f=fake([encoded]);const out=await generateBookDocument(f.client,'test',{question:text,theme:'仕事',sources})
 assert.equal(f.count(),1);assert.deepEqual(out.document,sanitizeBookHighlights(d))
})

test('timeout usage is unknown and no padding request is made',async()=>{
 const events:any[]=[];let calls=0
 const client={messages:{create:async()=>{calls++;const e=new Error('not logged');e.name='APIConnectionTimeoutError';throw e}}} as unknown as Anthropic
 await assert.rejects(generateBookDocument(client,'configured-model',{question:text,theme:'仕事',sources},async e=>{events.push(e)}))
 assert.equal(calls,1);assert.deepEqual(events.map(e=>e.phase),['started','error'])
 assert.equal(events[1].inputTokens,undefined)
})
