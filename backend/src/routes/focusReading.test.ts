import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { calcRouter, calcShichuResult, calcTimingCycles } from '../lib/divination/index.js'

test('a ten-year display window keeps every existing annual value and all decade calculations unchanged', () => {
  for (const gender of ['female','male'] as const) for (const hour of [undefined,5]) {
    const original=calcTimingCycles(1995,2,20,hour,0,gender)
    const focused=calcTimingCycles(1995,2,20,hour,0,gender,{from:2026,to:2035})
    assert.deepEqual(focused.annual,original.annual.filter(y=>y.year>=2026&&y.year<=2035))
    assert.deepEqual(focused.decades,original.decades)
    assert.equal(focused.direction,original.direction)
    assert.equal(focused.startDate,original.startDate)
    assert.ok(original.annual.every(y=>y.year>=2013&&y.year<=2055))
  }
})

test('display years also cover older dates and retain actual calendar values without inventing empty results', () => {
  for (const year of [1900,1940,2010]) {
    const result=calcTimingCycles(year,6,15,undefined,0,'female',{from:2026,to:2035})
    assert.deepEqual(result.annual.map(y=>y.year),Array.from({length:10},(_,i)=>2026+i))
    for (const row of result.annual) assert.equal(row.kanshi,calcShichuResult(row.year,6,15).shichuYear)
  }
  assert.throws(()=>calcTimingCycles(1995,2,20,undefined,0,'female',{from:2026,to:2036}),/Invalid annual display window/)
  assert.throws(()=>calcTimingCycles(1995,2,20,undefined,0,'female',{from:1980,to:1989}),/Invalid annual display window/)
})

test('the anonymous shichu endpoint returns ten JST calendar years only when konki is requested', async t => {
  const app=express();app.use(express.json());app.use(calcRouter)
  const server=createServer(app)
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>{server.closeAllConnections();server.close()})
  const origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const call=(body:object)=>fetch(origin+'/shichu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const reference=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Tokyo',year:'numeric'}).format(new Date()))
  const response=await call({birthDate:'1940-06-15',gender:'female',readingFocus:'konki'})
  assert.equal(response.status,200)
  const focused=await response.json() as ReturnType<typeof calcShichuResult>
  assert.deepEqual(focused.timing?.annual.map(y=>y.year),Array.from({length:10},(_,i)=>reference+i))
  assert.equal(focused.fourPillars.length,3)
  const legacyResponse=await call({birthDate:'1995-02-20',gender:'female'})
  assert.equal(legacyResponse.status,200)
  const legacy=await legacyResponse.json() as ReturnType<typeof calcShichuResult>
  assert.deepEqual(legacy.timing,calcShichuResult(1995,2,20,undefined,0,'female').timing)
  assert.equal((await call({birthDate:'1995-02-20',readingFocus:'konki'})).status,400)
  assert.equal((await call({birthDate:'1995-02-20',gender:'female',readingFocus:'private-token'})).status,400)
  assert.equal((await call({birthDate:'2300-02-20',gender:'female',readingFocus:'konki'})).status,400)
  assert.equal((await call({birthDate:'2015-02-20',gender:'female',readingFocus:'konki'})).status,400)
})
