import assert from 'node:assert/strict'
import test from 'node:test'
import { CELEBRITY_READING_CANDIDATES, evaluateCelebrityReadingCandidates, buildCelebrityReadingPreview } from './celebrityReadingCandidates.js'
import type { EventFact } from './eventPatternRules.js'

const context = {birthTimeKnown:true,stableVedicHouses:true,birthSourceVerified:false}
const base: EventFact = {id:'v',lineage:'v',kind:'vedic_period',system:'インド占星術',group:'astronomical_ephemeris',
  period:{start:'2024-01-01',end:'2025-01-01',major:'Jupiter',minor:'Mercury'},houses:[7],
  detail:'synthetic',days:['2024-03-01'],themes:[]}
const z:EventFact = {...base,id:'ziwei:甲辰:life:財帛',lineage:'z',kind:'ziwei_palace',system:'紫微斗数',group:'ziwei_chart',palace:'財帛'}
const west:EventFact = {...base,id:'w',lineage:'w',kind:'western_transit',system:'西洋占星術',transit:'土星',natal:'金星',aspect:90}

test('C01 requires both facts on the same date, with traceable evidence and unresolved outcomes',()=>{
  assert.deepEqual(evaluateCelebrityReadingCandidates([base],context),[])
  assert.deepEqual(evaluateCelebrityReadingCandidates([base,{...z,days:['2024-03-02']}],context),[])
  const result=evaluateCelebrityReadingCandidates([base,z],context)
  assert.deepEqual(result.map(r=>r.id),['C01'])
  assert.deepEqual(result[0].days,['2024-03-01'])
  assert.equal(result[0].evidence.length,2)
  assert.equal(result[0].probability,null)
  assert.equal(result[0].outcome,'undetermined')
  assert.equal(result[0].productionEligible,false)
})
test('unknown time and unstable houses cannot re-admit time-dependent candidates',()=>{
  assert.deepEqual(evaluateCelebrityReadingCandidates([base,z],{...context,birthTimeKnown:false}),[])
  assert.deepEqual(evaluateCelebrityReadingCandidates([base,z],{...context,stableVedicHouses:false}),[])
  assert.deepEqual(evaluateCelebrityReadingCandidates([west],{...context,birthTimeKnown:false,stableVedicHouses:false}).map(r=>r.id),['C05'])
})
test('labels do not change selection; absent evidence produces no generic reading',()=>{
  const labeled={...base,observedOutcome:'離婚',name:'synthetic'}
  assert.deepEqual(evaluateCelebrityReadingCandidates([labeled,z],context),evaluateCelebrityReadingCandidates([base,z],context))
  assert.deepEqual(evaluateCelebrityReadingCandidates([],context),[])
  assert.equal(new Set(CELEBRITY_READING_CANDIDATES.map(r=>r.id)).size,6)
})
test('real birth/window entry point is deterministic and ignores supplied expected stories',()=>{
  const birth={birthYear:1990,birthMonth:5,birthDay:12,birthHour:10,birthMinute:0,birthplace:'東京都',gender:'female' as const}
  const window={from:'2024-03-01',until:'2024-03-03'}
  const before=buildCelebrityReadingPreview(birth,window)
  assert.deepEqual(before,buildCelebrityReadingPreview({...birth,expectedEvent:'結婚'} as typeof birth,window))
  assert.equal(before.productionEligible,false)
})
