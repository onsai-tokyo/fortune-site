import test from 'node:test'
import assert from 'node:assert/strict'
import {matchingSnapshot,snapshotForReading,type ReadingSnapshot} from './readingSnapshot'
import type {YearReading} from './types'
const year:YearReading={year:2026,title:'元の鑑定',label:'',tags:[],summary:'',sections:[{heading:'流れ',body:'元の本文'}]}
const state={selfSourceId:'source-a',years:[year],chapters:[],partners:[],coupleYears:{}}
test('a new input and same year cannot overwrite or masquerade as previously saved',()=>{
  const input=snapshotForReading('you-2026',state)!
  const saved:ReadingSnapshot={id:'saved',source_id:'source-a',partner_id:null,created_at:'2026-10-21',payload:structuredClone(input.payload)}
  assert.equal(matchingSnapshot([saved],input)?.id,'saved')
  const next=snapshotForReading('you-2026',{...state,selfSourceId:'source-b',years:[{...year,title:'新しい鑑定'}]})
  assert.equal(matchingSnapshot([saved],next),undefined)
  assert.equal(saved.payload.title,'2026年 元の鑑定')
  assert.equal(snapshotForReading('you-2026',{...state,selfSourceId:undefined}),null)
})
