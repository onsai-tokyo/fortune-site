import test from 'node:test'
import assert from 'node:assert/strict'
import {buildFixtureReportInput,BIRTH_FIXTURES} from './fixtures.js'
import {extractReportMetadata} from './metadata.js'
import {buildSelfReport} from './buildSelfReport.js'
import {reportContractViolations} from './contract.js'
import {refreshSavedTimelineCards} from './savedTimelineCards.js'
import {timelineV3CardIsValid} from './timelineV3/index.js'

test('production self report and saved refresh keep v3 parity and personality content',()=>{
 const input={...buildFixtureReportInput(BIRTH_FIXTURES[5]),relationshipStatus:'partnered' as const,partnerSince:2024,partnerKind:'partnered' as const}
 const metadata=extractReportMetadata(input)
 const options={factPipeline:'v2',narrativeEngine:'personality'} as const
 const old=buildSelfReport(input,metadata,{...options,annualEngine:'catalog3600'}).report
 const report=buildSelfReport(input,metadata,{...options,annualEngine:'timeline3'}).report
 const violations=reportContractViolations(report,input); assert.equal(violations.length,0)
 assert.deepEqual(report.cards.filter(c=>c.kind!=='timing').map(c=>[c.title,c.sections,c.summary]),old.cards.filter(c=>c.kind!=='timing').map(c=>[c.title,c.sections,c.summary]))
 const previous=process.env.ANNUAL_READING_ENGINE
 try {
  process.env.ANNUAL_READING_ENGINE='timeline3'
  const refreshed=refreshSavedTimelineCards(old.cards,input,'self',{partnerSince:2024,partnerKind:'partnered'})
  const timing=refreshed.filter(c=>c.kind==='timing')
  assert.ok(timing.length>20)
  assert.ok(timing.every(timelineV3CardIsValid))
  const generated=report.cards.filter(c=>c.kind==='timing')
  assert.equal(timing.length,generated.length)
  for(const card of timing){
   const other=generated.find(c=>c.id===card.id)!
   for(const key of ['title','summary','tags','sections','pages','period'] as const) assert.deepEqual(card[key],other[key],card.id+':'+key)
   assert.deepEqual(JSON.parse(JSON.stringify(card.timelineV3Calculation)),JSON.parse(JSON.stringify(other.timelineV3Calculation)))
  }
  assert.equal(refreshSavedTimelineCards(old.cards,input,'compatibility'),old.cards)
 }finally {if(previous===undefined)delete process.env.ANNUAL_READING_ENGINE;else process.env.ANNUAL_READING_ENGINE=previous}
})

test('couple adapter uses saved births, relationship label, meeting year and events',async()=>{
 const {coupleSnapshot,snapshotTimeline}=await import('./coupleAllYears/snapshot.js')
 const {buildCoupleTimelineV3}=await import('./timelineV3/couple.js')
 const {japanDateParts}=await import('../japanDate.js')
 const snapshot=coupleSnapshot({self:{birthDate:'1995-03-16',birthTime:'00:52:00',birthplace:'愛知県名古屋市',gender:'female'},partner:{birthDate:'1990-01-01',birthTime:'12:00',birthplace:'東京都',gender:'male'},relationshipLabel:'夫婦'},'test-partner')
 const events=[{year:2020,kind:'marriage' as const}]
 const old=process.env.COUPLE_TIMELINE_ENGINE
 try {
  process.env.COUPLE_TIMELINE_ENGINE='v3'
  const actual=snapshotTimeline(snapshot,2018,events)
  const expected=buildCoupleTimelineV3({self:{...snapshot.a,birthTime:snapshot.a.birthTime??undefined,lifeEvents:events},partner:{...snapshot.b,birthTime:snapshot.b.birthTime??undefined},relationshipLabel:'夫婦',meetingYear:2018,referenceYear:japanDateParts().year})
  assert.equal(JSON.stringify(actual),JSON.stringify({...expected,minMeetingYear:snapshot.minMeetingYear}))
 }finally{if(old===undefined)delete process.env.COUPLE_TIMELINE_ENGINE;else process.env.COUPLE_TIMELINE_ENGINE=old}
})
