import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import { composeYear, calendarLabel, baziPart, sukuyoPart, ageContext } from './composer.js'
import { buildAllYears, timelineLayout, birthMaterials, buildFromBirths, cacheKeys } from './timeline.js'

test('regenerated tag-version samples match every paragraph, audit field and calendar field',()=>{
  const rows=JSON.parse(readFileSync(new URL('./fixtures/generated_samples.json',import.meta.url),'utf8'))
  for(const row of rows) assert.deepEqual(composeYear(...row.input as [string,string,string,string,number,number,number]),row.output)
})
test('tag version matches regenerated 338 age combinations and reverses selected title subjects',()=>{
  const rows=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/age338.json.gz',import.meta.url))).toString())
  for(const row of rows){
    const [a,b,sa,sb,y,ba,bb]=row.input as [string,string,string,string,number,number,number]
    const reading=composeYear(a,b,sa,sb,y,ba,bb),reverse=composeYear(b,a,sb,sa,y,bb,ba)
    assert.deepEqual(reading,row.output)
    assert.ok([...reading.title].length<=42)
    for(const s of reading.title_basis.selected) assert.ok(reading.paragraphs[s.paragraph_index].includes(s.evidence_text))
    const swapped=reading.title_basis.selected.map(s=>[s.actor==='A'?'B':'A',s.source,s.value].join('|')).sort()
    assert.deepEqual(swapped,reverse.title_basis.selected.map(s=>[s.actor,s.source,s.value].join('|')).sort())
  }
})
test('direction swaps annual materials and profile roles',()=>{
  const a=baziPart('壬午','丙子','乙巳'),b=baziPart('丙子','壬午','乙巳')
  assert.deepEqual(a.actors[0].facts_ref,b.actors[1].facts_ref)
  assert.deepEqual(a.actors[1].facts_ref,b.actors[0].facts_ref)
  const x=sukuyoPart('心','斗','角'),y=sukuyoPart('斗','心','角')
  assert.equal(x.actors[0].year_role,y.actors[1].year_role)
  assert.equal(x.actors[0].profile_ref,y.actors[1].profile_ref)
  assert.throws(()=>composeYear('甲丑','甲子','角','角',2026,1990,1985))
  assert.throws(()=>composeYear('甲子','甲子','牛','角',2026,1990,1985))
})
const input={meetingYear:2006,birthYearA:1995,birthYearB:1990,referenceYear:2026,dayA:'壬午',dayB:'丙子',mansionA:'心',mansionB:'斗'}
test('all years and five-year groups preserve chronology without gaps',()=>{
  const out=buildAllYears(input)
  assert.equal(out.entries.length,40)
  assert.equal(out.collapsedYears.length,15)
  assert.deepEqual(out.groups.map(g=>[g.from,g.to]),[[2006,2010],[2011,2015],[2016,2020]])
  assert.deepEqual(out.entries.map(e=>e.year),Array.from({length:40},(_,i)=>2006+i))
  assert.ok(out.entries.every(e=>e.card&&e.reading&&e.reading.character_count>=500&&e.reading.character_count<=1000))
  const recent=buildAllYears({...input,meetingYear:2023})
  assert.equal(recent.entries.length,23)
  assert.equal(recent.collapsedYears.length,0)
  assert.deepEqual(recent.entries.slice(0,3).map(e=>e.year),[2023,2024,2025])
  assert.deepEqual(recent.entries[3].reading,out.entries.find(e=>e.year===2026)!.reading)
  assert.equal(buildAllYears({...input,meetingYear:2026}).entries.length,20)
})
test('meeting input never guesses, accepts birth year, rejects booleans/fractions/future',()=>{
  assert.equal(timelineLayout({...input,meetingYear:null}).status,'needs_meeting_year')
  assert.equal(timelineLayout({...input,meetingYear:1995}).status,'ready')
  for(const meetingYear of [true,2006.5,'2006',1994,2027,NaN]) assert.equal(timelineLayout({...input,meetingYear}).status,'invalid_meeting_year')
  assert.equal(timelineLayout({...input,endYear:2025}).status,'invalid_end_year')
  assert.equal(timelineLayout({...input,endYear:2050}).years.at(-1),2050)
  assert.equal(timelineLayout({...input,meetingYear:2017}).collapsedYears.length,4)
  assert.equal(timelineLayout({...input,meetingYear:2016}).collapsedYears.length,5)
})
test('missing content and unsupported years remain explicit entries',()=>{
  const out=buildAllYears({...input,meetingYear:2099,birthYearA:2000,birthYearB:2000,referenceYear:2100,endYear:2102})
  assert.deepEqual(out.entries.map(e=>e.contentStatus),['ready','ready','unsupported_year','unsupported_year'])
  assert.equal(out.status,'partial')
  const failed=buildAllYears(input,()=>{throw new Error('missing')})
  assert.equal(failed.entries.length,40)
  assert.ok(failed.entries.every(e=>e.contentStatus==='calculation_error'))
})
test('existing birth conversion feeds same day/mansion with strict date and time input',()=>{
  const birth={birthDate:'1995-03-16',birthTime:'00:52'}, a=birthMaterials(birth)
  assert.ok(a.dayPillar&&a.mansion)
  const result=buildFromBirths(birth,{birthDate:'1995-02-20'},2023,2026)
  assert.equal(result.status,'ready')
  assert.equal(result.entries[0].reading!.audit.bazi.actors[0].day_pillar,a.dayPillar)
  for(const date of ['1995-02-30','2026-13-01','bad']) assert.throws(()=>birthMaterials({birthDate:date}))
  assert.throws(()=>birthMaterials({birthDate:'1995-03-16',birthTime:'24:00'}))
})
test('calendar is labeled as reference method, never claims a resolved date boundary',()=>{
  assert.equal(calendarLabel(2026).date_boundary_resolved,false)
  assert.equal(calendarLabel(1984).bazi_year_pillar,'甲子')
  for(const year of [1899,2101,2026.1]) assert.throws(()=>calendarLabel(year))
})
test('cache identity isolates relationships, direction and display inputs',()=>{
  const a=cacheKeys('pair-1',input), b=cacheKeys('pair-1',{...input,meetingYear:2023})
  assert.equal(a.content,b.content); assert.notEqual(a.layout,b.layout)
  assert.notEqual(a.content,cacheKeys('pair-2',input).content)
  assert.notEqual(a.content,cacheKeys('pair-1',{...input,dayA:input.dayB,dayB:input.dayA,mansionA:input.mansionB,mansionB:input.mansionA}).content)
})

test('age bands use age reached in target year and require explicit birth years',()=>{
 for(const [age,band] of [[0,'infant'],[2,'infant'],[3,'preschool'],[5,'preschool'],[6,'child'],[12,'child'],[13,'teen'],[17,'teen'],[18,'adult'],[75,'adult']] as const) assert.equal(ageContext(2026,2026-age).band,band)
 assert.throws(()=>composeYear('甲子','甲子','角','亢',2026))
 assert.throws(()=>ageContext(2026,2027))
 const infant=buildFromBirths({birthDate:'1995-03-16',birthTime:'00:52'},{birthDate:'1970-01-15'},1995,2026).entries[0].reading!
 assert.equal(infant.ages.A.age_reached,0);assert.equal(infant.ages.B.age_reached,25)
 assert.ok(!infant.paragraphs[0].includes('あなたが学んだことや役立つ情報'))
 const p=composeYear('甲子','甲子','角','亢',2023,1990,1985).paragraphs[0]
 assert.ok(p.includes('相手が学んだことや役立つ情報をあなたへ伝える'))
 assert.ok(!composeYear('甲子','甲子','角','亢',2024,1990,1985).paragraphs[0].includes('が自分が'))
 assert.notEqual(cacheKeys('pair-1',input).content,cacheKeys('pair-1',{...input,birthYearA:1996}).content)
})
