import {test} from 'node:test'
import assert from 'node:assert/strict'
import {previewRouter} from '../../../routes/preview.js'
import {annualReading} from './engine.js'
import {reportContractViolations} from '../contract.js'
import {EventEmitter} from 'node:events'
import {selfTimingHistoryFromBirthSnapshot} from '../coupleTimingHistory.js'
class ResponseStub extends EventEmitter {
 destroyed=false;writableEnded=false;headersSent=false;statusCode=200;body:any
 status(n:number){this.statusCode=n;return this} json(value:any){this.body=value;return this}
 setHeader(){} flushHeaders(){} write(){return true} end(){this.writableEnded=true}
}
test('real preview route preserves annual body, profile changes, personality, and saved-context history',async()=>{
 const vars=['ANNUAL_READING_ENGINE','NARRATIVE_ENGINE','AI_REPORT_ENABLED'],before=vars.map(k=>process.env[k])
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Annual report must not need network/AI')}
 process.env.ANNUAL_READING_ENGINE='catalog3600';process.env.NARRATIVE_ENGINE='personality';process.env.AI_REPORT_ENABLED='false'
 try {
   const handler=(previewRouter as any).stack.find((e:any)=>e.route?.path==='/generate').route.stack.at(-1).handle
   const birth={birthDate:'2000-06-01',birthTime:'12:15',birthplace:'東京都',gender:'female',annualYunConvention:'female',spouseConvention:'female_officer',workContext:'employed'}
   const generate=async(body:object)=>{const res=new ResponseStub();await handler({header:()=>undefined,query:{},body,headers:{}},res);assert.equal(res.statusCode,200);return res.body}
   const report=await generate(birth)
   const c=report.cards.find((c:any)=>c.id==='turning-year-2031')
   assert.equal(c.summary,annualReading(birth,2031)!.text.description)
   assert.equal(c.annualCalculation.patternId,annualReading(birth,2031)!.text.pattern_id)
   assert.deepEqual(reportContractViolations({...report,cards:report.cards.filter((c:any)=>c.kind==='timing')}),[])
   const student=await generate({...birth,workContext:'student'})
   assert.ok(student.cards.find((c:any)=>c.id==='turning-year-2031').tags.includes('学び・進路の節目'))
   const changed=await generate({...birth,birthDate:'2000-06-02'})
   assert.notEqual(changed.cards.find((c:any)=>c.id==='turning-year-2031').summary,c.summary)
   const history=selfTimingHistoryFromBirthSnapshot(birth,2031)
   assert.equal(history.cards.at(-1)!.summary,c.summary)
   assert.deepEqual(history.cards.at(-1)!.annualCalculation,c.annualCalculation)
   delete process.env.ANNUAL_READING_ENGINE
   const legacy=await generate(birth)
   assert.deepEqual(report.cards.filter((c:any)=>c.kind==='essence'),legacy.cards.filter((c:any)=>c.kind==='essence'))
   assert.ok(legacy.cards.filter((c:any)=>c.kind==='timing').every((c:any)=>!c.annualCalculation))
 }finally{globalThis.fetch=oldFetch;vars.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i]})}
})
