import test from 'node:test'
import assert from 'node:assert/strict'
import type Anthropic from '@anthropic-ai/sdk'
import {appendBookExpansion, documentLength, generateBookDocument} from './aiBookGeneration.js'
const text='相手に伝える前に、自分が大切にしていることを整理する時間が役立ちます。'
const sources=[1,2,3].map(n=>({id:String(n),title:'原稿'+n,text,version:'test',evidence:[]}))
const draft=()=>({title:'働き方と伝え方を整える',summary:text,answer:text.repeat(20),sections:sources.map(s=>({heading:'話し合いの進め方',body:text.repeat(15),sourceId:s.id,quote:text})),actions:[text,text]})
const extra=()=>({answerAddition:text.repeat(25),sectionAdditions:sources.map(s=>({sourceId:s.id,body:text.repeat(15)}))})
function fake(outputs:any[],stop='tool_use') {
 let calls=0
 return {client:{messages:{create:async()=>{const input=outputs[calls++];return {stop_reason:stop,usage:{input_tokens:10,output_tokens:20},content:[{type:'tool_use',name:'submit_book',input}]}}}} as unknown as Anthropic,count:()=>calls}
}
test('expansion preserves original text, sources, quotes, title and actions',()=>{
 const original=draft(),next=appendBookExpansion(original,extra())
 assert.ok(next.answer.startsWith(original.answer+'\n\n'))
 assert.deepEqual(next.actions,original.actions)
 assert.equal(next.title,original.title)
 next.sections.forEach((s:any,i:number)=>{assert.equal(s.quote,original.sections[i].quote);assert.equal(s.sourceId,original.sections[i].sourceId);assert.ok(s.body.startsWith(original.sections[i].body+'\n\n'))})
 assert.ok(documentLength(next)>=4500)
})
test('unknown or repeated evidence IDs cannot be appended',()=>{
 for(const ids of [['unknown'],['1','1']]) assert.throws(()=>appendBookExpansion(draft(),{answerAddition:text,sectionAdditions:ids.map(sourceId=>({sourceId,body:text}))}),/BOOK_REPAIR_SCHEMA/)
})
test('short valid draft expands and aggregates token usage',async()=>{
 const f=fake([draft(),extra()]);const out=await generateBookDocument(f.client,'test',{question:text,theme:'仕事',sources})
 assert.equal(f.count(),2);assert.equal(out.inputTokens,20);assert.equal(out.outputTokens,40);assert.ok(documentLength(out.document)>=4500)
})
test('invalid quote fails without expansion; truncation never delivers',async()=>{
 const d=draft();d.sections[0].quote='この原稿には存在しない引用です。'
 const f=fake([d]);await assert.rejects(generateBookDocument(f.client,'test',{question:text,theme:'仕事',sources}));assert.equal(f.count(),1)
 const truncated=fake([draft()],'max_tokens');await assert.rejects(generateBookDocument(truncated.client,'test',{question:text,theme:'仕事',sources}),/BOOK_TRUNCATED/)
})
test('insufficient expansions are bounded to three model calls',async()=>{
 const f=fake([draft(),{answerAddition:'',sectionAdditions:[]},{answerAddition:'',sectionAdditions:[]}]);await assert.rejects(generateBookDocument(f.client,'test',{question:text,theme:'仕事',sources}),/BOOK_DOCUMENT_LENGTH/);assert.equal(f.count(),3)
})
