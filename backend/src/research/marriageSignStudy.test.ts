import test from 'node:test'
import assert from 'node:assert/strict'
import {buildMarriageSignStudy,matchMarriageSigns} from './marriageSignStudy.js'
import type {EventFact} from './eventPatternRules.js'
import type {CohortObservation} from './cohortPatternCandidates.js'
const window={from:'2024-03-01',until:'2024-03-04'}
const w:EventFact={id:'w',lineage:'w',kind:'western_transit',system:'西洋占星術',group:'astronomical_ephemeris',
  transit:'木星',natal:'金星',aspect:120,detail:'synthetic',themes:[],days:['2024-03-01','2024-03-02']}
const v:EventFact={...w,id:'v',lineage:'v',kind:'vedic_period',system:'インド占星術',
  period:{start:'2024-01-01',end:'2025-01-01',major:'Jupiter',minor:'Mercury'},houses:[7],days:['2024-03-02','2024-03-03']}
const z:EventFact={...w,id:'ziwei:甲辰:life:財帛',lineage:'z',kind:'ziwei_palace',system:'紫微斗数',group:'ziwei_chart',palace:'財帛',days:['2024-03-02']}
const keys=['western:木星:金星:120','vedic:minor-lord-house:7','ziwei:life:財帛']
const event=(id:string,personID=id,category='結婚'):CohortObservation=>({id,personID,category,precision:'day',window,facts:[w,v,z]})
test('three-system combination requires exact common dates and distinct source lineages',()=>{
  assert.deepEqual(matchMarriageSigns(keys,[w,v,z],window),['2024-03-02'])
  assert.deepEqual(matchMarriageSigns(keys,[w,v,{...z,days:['2024-03-03']}],window),[])
  assert.deepEqual(matchMarriageSigns(keys,[w,v,{...z,lineage:'v'}],window),[])
  assert.throws(()=>matchMarriageSigns([],[],window))
  assert.throws(()=>matchMarriageSigns([keys[0],keys[0]],[w],window))
})
test('multiple views of one Vedic period do not become an independent triple',()=>{
  const self=['vedic:period:Jupiter:Mercury','vedic:minor-lord-house:7','western:木星:金星:120']
  assert.deepEqual(matchMarriageSigns(self,[v,w],window),[])
})
test('repeated people and family units cannot create a repeated marriage trigger',()=>{
  assert.equal(buildMarriageSignStudy([event('a','same'),event('b','same')],[]).rules.length,0)
  assert.equal(buildMarriageSignStudy([event('a'),event('b')].map(e=>({...e,independenceUnit:'family'})),[]).rules.length,0)
  const result=buildMarriageSignStudy([event('a'),event('b')],[])
  assert.ok(result.rules.some(r=>keys.every(k=>r.allOf.includes(k))))
  assert.ok(result.rules.every(r=>r.allOf.length===3&&r.probability===null&&r.productionEligible===false))
})
test('other events overlapping a supplied marriage window are retained but excluded from comparison denominator',()=>{
  const result=buildMarriageSignStudy([event('a'),event('b'),event('job','a','仕事'),event('divorce','c','離婚')],[])
  assert.equal(result.denominators.marriage.records,2)
  assert.equal(result.denominators.otherReported.records,1)
  const rule=result.rules.find(r=>keys.every(k=>r.allOf.includes(k)))!
  assert.equal(rule.supports.find(s=>s.eventID==='job')?.comparisonClass,'overlaps_marriage_window')
  assert.equal(rule.supports.find(s=>s.eventID==='divorce')?.comparisonClass,'other_reported')
  assert.ok(rule.observedCategories.includes('離婚'))
})
test('day/month/year denominators remain separate and birth/event notes cannot alter predicate matching',()=>{
  const result=buildMarriageSignStudy([event('a'),{...event('b'),precision:'month'},{...event('c'),precision:'year'}],[])
  assert.equal(result.denominators.marriageByPrecision.day.records,1)
  assert.equal(result.denominators.marriageByPrecision.month.records,1)
  assert.equal(result.denominators.marriageByPrecision.year.records,1)
  assert.deepEqual(matchMarriageSigns(keys,[{...w,note:'婚約',name:'synthetic'} as EventFact,v,z],window),['2024-03-02'])
  assert.throws(()=>buildMarriageSignStudy([event('a'),event('a')],[]),/Duplicate/)
  assert.throws(()=>buildMarriageSignStudy([],[{allOf:[],labels:[],systems:[],groups:[]}]),/unique/)
})
