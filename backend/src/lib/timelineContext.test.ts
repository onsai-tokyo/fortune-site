import test from 'node:test'
import assert from 'node:assert/strict'
import {birthInput,sameBirth,parseEvents,choosePartner} from './timelineContext.js'
test('events reject free text, future dates, invalid months and oversized lists',()=>{
 for(const value of [[{year:2027,kind:'job'}],[{year:2025,month:13,kind:'job'}],[{year:2025,kind:'job',text:'private'}],Array(101).fill({year:2025,kind:'job'})])assert.throws(()=>parseEvents(value,1990,2026))
 assert.deepEqual(parseEvents([{year:2025,month:null,kind:'job'},{year:2025,kind:'job'}],1990,2026),[{year:2025,kind:'job'}])
})
test('birth matching excludes other people and normalizes database times',()=>{
 const a={birthDate:'1995-02-20',birthTime:'05:40',birthplace:'名古屋',gender:'female'}
 assert.equal(sameBirth(a,{...a,birthTime:'05:40:00'}),true)
 assert.equal(sameBirth(a,{...a,birthDate:'1995-03-16'}),false)
 assert.equal(sameBirth(a,null),false)
 assert.equal(birthInput({birthTime:'12:00'}).birthTime,'12:00')
})
test('partner selection prefers a current relationship, then latest year, excluding friends',()=>{
 const rows=[{id:'a',label:'友達',year:2026,birth:{}},{id:'b',label:'片思い',year:2025,birth:{}},{id:'c',label:'夫婦',year:2020,birth:{}},{id:'d',label:'お付き合い中',year:2022,birth:{birthDate:'1990-01-01'}}]
 assert.equal(choosePartner(rows)?.partnerSince,2022)
 assert.equal(choosePartner(rows)?.partnerKind,'partnered')
 assert.equal(choosePartner(rows.slice(0,2))?.partnerKind,'crush')
})

test('birth time zones distinguish snapshots',()=>{
 const a={birthDate:'1995-02-20',birthTime:'05:40'}
 assert.equal(sameBirth(a,{...a,birthTimeZone:'Asia/Tokyo'}),true)
 assert.equal(sameBirth(a,{...a,birthTimeZone:'America/New_York'}),false)
})
test('validation records require current consent and exclude identifiers',async()=>{
 const {consentedValidationRecords}=await import('./timelineValidation.js')
 const row={birth:{birthDate:'1995-03-16',birthplace:'愛知県名古屋市',nickname:'PRIVATE',email:'PRIVATE'},events:[{year:2020,kind:'job'}]}
 assert.deepEqual(consentedValidationRecords([{...row,consent:null},{...row,consent:{consented_at:'2026-01-01',withdrawn_at:'2026-02-01'}}]),[])
 const result=consentedValidationRecords([{...row,consent:{consented_at:'2026-01-01',withdrawn_at:null}}])
 assert.equal(result.length,1)
 assert.equal(result[0].prefecture,'愛知県')
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|名古屋|email|nickname|user_id/)
})

test('context uses server-only meeting settings with an explicit owner filter',async()=>{
 const {loadTimelineContext}=await import('./timelineContext.js')
 const calls:Array<{table:string;actor:string;filters:Array<[string,unknown]>}>=[]
 const client=(actor:string)=>({from(table:string){
  const entry={table,actor,filters:[] as Array<[string,unknown]>};calls.push(entry)
  const chain:any={select(){return chain},eq(k:string,v:unknown){entry.filters.push([k,v]);return chain},order(){return chain},maybeSingle(){return chain},then(resolve:any){return Promise.resolve({data:table==='timeline_profiles'?null:[],error:null}).then(resolve)}}
  return chain
 }})
 await loadTimelineContext('synthetic-token','owner-id',{birthDate:'1995-03-16'},{user:()=>client('user') as any,admin:()=>client('server') as any})
 assert.equal(calls.length,5)
 for(const call of calls){assert.ok(call.filters.some(([k,v])=>k==='user_id'&&v==='owner-id'));assert.equal(call.actor,['couple_timeline_settings','partner_profiles'].includes(call.table)?'server':'user')}
})
