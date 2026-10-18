import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {composeCompatibility,relationForMansions,MANSIONS,characterCount,compatibilityKey} from './composer.js'
import {buildCompatibilityV24} from './cards.js'
import {SUKUYO_ORDER,calcShichu,getSukuyo} from '../../divination/index.js'
const fixture=(name:string)=>gunzipSync(readFileSync(new URL(`./fixtures/${name}.gz`,import.meta.url))).toString('utf8')
test('all 270 supplied outputs, 23 reversal cases, and both swapped persons exactly match Python',()=>{
  const expected=fixture('expected_270.jsonl').trim().split('\n').map(l=>JSON.parse(l))
  assert.equal(expected.length,270)
  for(const e of expected) assert.deepEqual(composeCompatibility(e.day_a,e.day_b,e.sukuyo_relation_id),e)
  const reversal=fixture('reversal_cases.jsonl').trim().split('\n').map(l=>JSON.parse(l))
  assert.equal(reversal.length,23)
  for(const e of reversal) assert.deepEqual(composeCompatibility(e.day_a,e.day_b,e.sukuyo_relation_id).sections[e.section_index],e.expected_section)
  for(const [key,e] of Object.entries(JSON.parse(fixture('person_swap.json'))) as [string,any][]) {
    if(key!=='note') assert.deepEqual(composeCompatibility(e.day_a,e.day_b,e.sukuyo_relation_id),e)
  }
})
test('all 97200 directional selectors preserve seven complete three-paragraph sections',()=>{
  const stems=Array.from('甲乙丙丁戊己庚辛壬癸'),branches=Array.from('子丑寅卯辰巳午未申酉戌亥')
  const days=Array.from({length:60},(_,i)=>stems[i%10]+branches[i%12]),ids=new Set<string>()
  const titles=['友人相性','恋人相性','結婚相性','関係が始まるきっかけ','良好な関係を築く上のコツ','障害になること','もし別れたら、復縁の可能性']
  for(const a of days) for(const b of days) for(let i=0;i<27;i++) {
    const r=composeCompatibility(a,b,`SR-${String(i).padStart(2,'0')}`)
    assert.deepEqual(r.sections.map(s=>s.title),titles)
    ids.add(r.id)
    for(const s of r.sections) {assert.equal(s.body.split('\n\n').length,3);assert.ok(s.character_count>=500 && s.character_count<=1000);assert.ok(s.headline)}
  }
  assert.equal(ids.size,97200)
})
test('mansion direction agrees with established calendar order for all 729 pairs; invalid values fail closed',()=>{
  for(let a=0;a<27;a++) for(let b=0;b<27;b++) {
    const ai=SUKUYO_ORDER.indexOf(MANSIONS[a]),bi=SUKUYO_ORDER.indexOf(MANSIONS[b])
    assert.equal((bi-ai+27)%27,(b-a+27)%27)
    assert.equal(relationForMansions(MANSIONS[a]+'宿',MANSIONS[b]),`SR-${String((b-a+27)%27).padStart(2,'0')}`)
    assert.equal(relationForMansions(MANSIONS[b],MANSIONS[a]),`SR-${String((a-b+27)%27).padStart(2,'0')}`)
  }
  for(const x of [undefined,null,'','安壊','SR-99','SR-3']) assert.throws(()=>composeCompatibility('壬午','丙子',x))
  assert.throws(()=>composeCompatibility('甲丑','丙子','SR-03'))
  assert.throws(()=>relationForMansions('不明','角'));assert.throws(()=>relationForMansions(null,'角'))
  assert.equal(characterCount('あ😀 \n\u0085\u001c\ufeff'),3)
  assert.notEqual(compatibilityKey('壬午','丙子','SR-03'),compatibilityKey('丙子','壬午','SR-24'))
})
test('calendar facts connect to seven ordered cards without changing text or exposing tracing in display',()=>{
  const person=(y:number,m:number,d:number)=>({shichuDay:calcShichu(y,m,d,12,0).day.kanshi,sukuyo:getSukuyo(y,m,d)})
  const a=person(1995,3,16),b=person(1995,2,20)
  const r=buildCompatibilityV24(a,b,'友人'),e=composeCompatibility(a.shichuDay,b.shichuDay,relationForMansions(a.sukuyo,b.sukuyo))
  assert.equal(r.cards.length,7);assert.equal(r.aiCardCount,0)
  assert.match(r.generatorVersion!,/^editorial-v2.4-claude-structural/)
  r.cards.forEach((c,k)=>{assert.equal(c.title,e.sections[k].headline);assert.equal(c.tags[0],e.sections[k].title);assert.equal(c.sections![0].body,e.sections[k].body);assert.equal(c.pages[0].text,e.sections[k].body);assert.deepEqual(c.evidence,[])})
  assert.notDeepEqual(r.cards,buildCompatibilityV24(b,a,'友人').cards)
})
