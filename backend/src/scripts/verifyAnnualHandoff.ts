/** Run against the local supplied archive; no personal fixture is copied into source. */
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {annualReading,natalContext,jst} from '../lib/report/annual3600/engine.js'
const root=resolve(process.argv[2])
const read=(name:string)=>JSON.parse(readFileSync(resolve(root,name),'utf8'))
const p=read('approved_content/source/personal_profile.json'), expected=read('approved_content/personal_labels_2026_2045.json')
const input={birthDate:p.input.birth_date,birthTime:p.input.time,birthplace:p.input.place,birthTimeZone:p.input.timezone,spouseConvention:p.input.gender_convention,annualYunConvention:p.yun.gender_switch===0?'female':'male',workContext:'employed'}
const c=natalContext(input)!
assert.deepEqual(c.natal,p.natal)
assert.deepEqual(c.decades.slice(0,p.yun.decades.length).map(d=>({ganzhi:d.pillar,start_jst:jst(d.start),end_exclusive_jst:jst(d.end)})),p.yun.decades)
let segments=0
for(const e of expected.years) {
 const r=annualReading(input,e.year,c)!
 assert.equal(r.text.pattern_id,e.pattern_id)
 assert.deepEqual(r.labels.map(l=>({kind:l.kind,text:l.text})),e.labels.map((l:any)=>({kind:l.kind,text:l.text})))
 assert.equal(r.segments.length,e.segments.length)
 for(let k=0;k<r.segments.length;k++) {
   const actual=r.segments[k], wanted=e.segments[k]
   assert.equal(actual.start,wanted.start_jst);assert.equal(actual.endExclusive,wanted.end_exclusive_jst)
   for(const l of actual.labels) assert.equal(l.state,wanted.labels[l.kind].state,`${e.year}/${k}/${l.kind}`)
   segments++
 }
}
const result={years:expected.years.length,segments,natalMatch:true,decadeMatch:true,allLabelStatesMatch:true,allPeriodBoundariesMatch:true}
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n')
console.log(result)
