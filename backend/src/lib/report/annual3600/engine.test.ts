import { test } from 'node:test'
import assert from 'node:assert/strict'
import { annualText, cycleIndex } from './catalog.js'
import { annualReading, evaluateLabels, natalContext, lichun, solarYearAt, and, or, jst, type AnnualContext } from './engine.js'
import { annual3600Cards } from './cards.js'
import { resolveSelfReportOptions, selfReportPipelineTag } from '../buildSelfReport.js'
const input: AnnualContext = {birthDate:'2000-06-15',birthTime:'12:15',birthplace:'東京都',annualYunConvention:'female',spouseConvention:'female_officer',workContext:'employed'}
test('all 3600 selectors are unique, zero-based, and preserve nonempty text',()=>{
  const ids = new Set<string>()
  for(let d=0;d<60;d++) for(let y=0;y<60;y++) {
    const r=annualText(d,1984+y)
    assert.equal(r.pattern_id,`P${String(d+1).padStart(2,'0')}-Y${String(y+1).padStart(2,'0')}`)
    assert.equal(r.day_index,d);assert.equal(r.year_cycle_index,y)
    for(const k of ['title','description','relationship','career','life'] as const) assert.ok(r[k].length>20)
    ids.add(r.pattern_id)
  }
  assert.equal(ids.size,3600);assert.equal(cycleIndex(1983),59)
  assert.equal(annualText(18,2026).pattern_id,'P19-Y43')
  assert.equal(annualText(18,2027).pattern_id,'P19-Y44')
  assert.throws(()=>annualText(-1,2026));assert.throws(()=>annualText(60,2026))
})
test('second-precision solar year boundary uses the previous cycle immediately before Lichun',()=>{
  const b=lichun(2026)
  assert.equal(jst(b),'2026-02-04T05:02:08+09:00')
  assert.equal(solarYearAt(b-1),2025);assert.equal(solarYearAt(b),2026)
  assert.equal(jst(lichun(2027)),'2027-02-04T10:46:18+09:00')
})
test('three-valued logic never turns missing context into false',()=>{
  assert.equal(and(false,'unknown'),false);assert.equal(and(true,'unknown'),'unknown')
  assert.equal(or(true,'unknown'),true);assert.equal(or(false,'unknown'),'unknown')
  const n={year:null,month:null,day:'壬午',hour:null}
  const r=evaluateLabels(n,'丙午',null,{})
  assert.equal(r.labels[0].state,'needs_personal_context')
  assert.equal(r.labels[2].state,'needs_personal_context')
})
test('missing hour preserves invariant day and never creates precise decades or hour',()=>{
  const c=natalContext({...input,birthTime:undefined})!
  assert.equal(c.natal.hour,null);assert.deepEqual(c.decades,[])
  assert.equal(c.dayIndex,natalContext(input)!.dayIndex)
  const boundary=natalContext({...input,birthDate:'2026-02-04',birthTime:undefined})!
  assert.equal(boundary.natal.year,null);assert.equal(boundary.natal.month,null)
  assert.equal(natalContext({...input,birthTime:'25:00'}),null)
  assert.equal(natalContext({...input,birthDate:'2000-02-30'}),null)
  assert.equal(natalContext({...input,birthTimeZone:'Europe/London'}),null)
  assert.deepEqual(natalContext({...input,annualYunConvention:undefined})!.decades,[])
})
test('same day/year body can have different labels and work wording',()=>{
  const a={year:'乙亥',month:'戊寅',day:'壬午',hour:'壬寅'}
  const employed=evaluateLabels(a,'戊申','辛巳',input)
  const student=evaluateLabels(a,'戊申','辛巳',{...input,workContext:'student'})
  assert.equal(employed.labels[2].state,'candidate');assert.equal(student.labels[2].text,'学び・進路の節目')
  assert.equal(evaluateLabels(a,'戊申','辛巳',{}).labels[2].text,'所属・活動の変化')
  const female=evaluateLabels(a,'戊午','辛巳',{spouseConvention:'female_officer'})
  const male=evaluateLabels(a,'戊午','辛巳',{spouseConvention:'male_wealth'})
  assert.equal(female.labels[0].state,'candidate');assert.equal(male.labels[0].state,'not_selected')
})
test('all decade switches split contiguous exclusive intervals and coverage extends beyond 2049',()=>{
  const c=natalContext(input)!
  assert.ok(c.decades.some(d=>d.start<=Date.parse('2099-06-01')&&d.end>Date.parse('2099-06-01')))
  for(let y=2020;y<=2080;y++) {
    const r=annualReading(input,y,c)!
    assert.equal(r.segments[0].start,r.start);assert.equal(r.segments.at(-1)!.endExclusive,r.endExclusive)
    for(let k=0;k<r.segments.length;k++) {
      assert.ok(Date.parse(r.segments[k].start)<Date.parse(r.segments[k].endExclusive))
      if(k) assert.equal(r.segments[k-1].endExclusive,r.segments[k].start)
    }
    for(const l of r.labels) assert.ok(r.segments.every(s=>s.labels.some(v=>v.kind===l.kind&&v.state==='candidate')))
  }
})
test('cards retain exact approved paragraphs, all years including no badges, and no legacy or technical evidence',()=>{
  const cards=annual3600Cards(input,2026,2045)
  assert.equal(cards.length,20)
  for(const c of cards) {
    const year=Number(c.id.slice(-4)),r=annualReading(input,year)!
    assert.equal(c.title,r.text.title);assert.equal(c.summary,r.text.description)
    assert.deepEqual(c.sections!.slice(0,3).map(s=>s.body),[r.text.relationship,r.text.career,r.text.life])
    assert.deepEqual(c.evidence,[])
    assert.ok(c.period!.label.includes('立春'))
    assert.equal(c.generator,'deterministic')
  }
  assert.notEqual(cards[0].summary,cards[1].summary)
  assert.notDeepEqual(annual3600Cards({...input,birthDate:'2000-06-16'},2026,2026)[0].summary,cards[0].summary)
})
test('annual engine is independently opt-in and changes pipeline/cache identity',()=>{
  const legacy=resolveSelfReportOptions({NARRATIVE_ENGINE:'personality'})
  const next=resolveSelfReportOptions({NARRATIVE_ENGINE:'personality',ANNUAL_READING_ENGINE:'catalog3600'})
  assert.equal(legacy.annualEngine,undefined);assert.equal(next.annualEngine,'catalog3600')
  assert.notEqual(selfReportPipelineTag(legacy),selfReportPipelineTag(next))
  assert.equal(resolveSelfReportOptions({ANNUAL_READING_ENGINE:'typo'}).annualEngine,undefined)
})
test('partial-year candidates never become whole-year badges',()=>{
  const pivot=Date.parse('2026-06-01T00:00:00+09:00')
  const r=annualReading(input,2026,{dayIndex:18,natal:{year:'乙亥',month:'戊寅',day:'壬午',hour:'壬寅'},decades:[
    {pillar:'戊辰',start:lichun(2026),end:pivot},{pillar:'甲辰',start:pivot,end:lichun(2027)},
  ]})!
  assert.equal(r.segments.length,2)
  assert.equal(r.segments[0].labels[0].state,'candidate')
  assert.equal(r.segments[1].labels[0].state,'not_selected')
  assert.ok(!r.labels.some(l=>l.kind==='marriage'))
})
