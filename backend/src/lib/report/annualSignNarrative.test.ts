import assert from 'node:assert/strict'
import test from 'node:test'
import { annualSignFacts, readingSignDays } from './annualSignFacts.js'
import { ANNUAL_SIGN_ASSETS, ANNUAL_SIGN_VERSION } from './annualSignAssets.js'
import { appendAnnualSignReadings, matchedAnnualSigns } from './annualSignNarrative.js'
import { buildEventPatternStudy } from '../../research/eventPatternStudy.js'
import { supplementalSanmeiFacts } from '../../research/cohortSupplementalFacts.js'
import { matchMarriageSigns } from '../../research/marriageSignStudy.js'
import { buildAnnualHistoryCards, buildTurningPointCards } from './timingCards.js'
import { selfTimingHistoryFromBirthSnapshot } from './coupleTimingHistory.js'
import { buildFixtureReportInput } from './fixtures.js'

const keys=[...new Set(ANNUAL_SIGN_ASSETS.flatMap(a=>a.allOf))]
const a={id:'a',birthDate:'1995-02-20',birthTime:'03:02',birthplace:'愛知県',gender:'female' as const,group:'same-year' as const}

test('46 conditions retain distinct meanings, stable IDs and no outcome classifier',()=>{
  assert.equal(ANNUAL_SIGN_ASSETS.length,46)
  assert.equal(new Set(ANNUAL_SIGN_ASSETS.map(a=>a.id)).size,46)
  assert.equal(new Set(ANNUAL_SIGN_ASSETS.map(a=>JSON.stringify([...a.allOf].sort()))).size,46)
  for(const asset of ANNUAL_SIGN_ASSETS){assert.equal(asset.labels.length,asset.allOf.length);assert(asset.body.length<200);assert.doesNotMatch(asset.body,/結婚します|離婚します|初めての彼|必ず|的中率/)}
})

test('batch 2 adds ten singles and two simultaneous combinations without requiring event labels',()=>{
  const additions=ANNUAL_SIGN_ASSETS.filter(a=>a.id.startsWith('N'))
  assert.equal(additions.filter(a=>a.allOf.length===1).length,10)
  assert.equal(additions.filter(a=>a.allOf.length===2).length,2)
  for(const asset of additions){
    const facts=asset.allOf.map(key=>({key,lineage:key,days:['2024-06-01']}))
    assert(matchedAnnualSigns(facts).some(m=>m.asset.id===asset.id))
    if(asset.allOf.length===2){
      facts[1].days=['2024-06-02']
      assert(!matchedAnnualSigns(facts).some(m=>m.asset.id===asset.id))
    }
  }
})

test('single sign works; disjoint dates and duplicate fact interpretations cannot form a combination',()=>{
  const facts=[{key:'a',lineage:'one',days:['2024-01-01']},{key:'b',lineage:'two',days:['2024-01-02']},{key:'c',lineage:'one',days:['2024-01-01']}]
  assert.deepEqual(readingSignDays(['a'],facts),['2024-01-01'])
  assert.deepEqual(readingSignDays(['a','b'],facts),[])
  assert.deepEqual(readingSignDays(['a','c'],facts),[])
  assert.throws(()=>readingSignDays(['a','a'],facts))
})

test('runtime calculations match research conditions day-for-day, including missing time and ASC boundary',()=>{
  for(const [birth,year]of [
    [{birthYear:1995,birthMonth:2,birthDay:20,birthHour:3,birthMinute:2,birthplace:'愛知県',gender:'female' as const},2014],
    [{birthYear:1995,birthMonth:6,birthDay:30,birthplace:'高知県',gender:'female' as const},2024],
    [{birthYear:1997,birthMonth:7,birthDay:30,birthHour:18,birthMinute:30,birthplace:'佐賀県',gender:'female' as const},2021],
  ] as const){
    const window={from:`${year}-01-01`,until:`${year+1}-01-01`}
    const source=buildEventPatternStudy(birth,window)
    const facts=[...source.facts,...supplementalSanmeiFacts(birth,window)]
    const known='birthHour' in birth
    const input={birthDate:`${birth.birthYear}-${String(birth.birthMonth).padStart(2,'0')}-${String(birth.birthDay).padStart(2,'0')}`,birthTime:known?`${String(birth.birthHour).padStart(2,'0')}:${String(birth.birthMinute).padStart(2,'0')}`:undefined,birthplace:birth.birthplace,gender:birth.gender}
    const actual=annualSignFacts(input,[year],keys).get(year)!
    for(const asset of ANNUAL_SIGN_ASSETS)assert.deepEqual(readingSignDays(asset.allOf,actual),matchMarriageSigns(asset.allOf,facts,window),`${input.birthDate} ${asset.id}`)
    if(!known)assert(actual.every(f=>!f.key.startsWith('vedic:')&&!f.key.startsWith('ziwei:')&&!/ASC|MC/.test(f.key)))
    if(!source.housesStable)assert(actual.every(f=>!f.key.startsWith('vedic:')))
  }
})

test('missing or invalid inputs add no unsupported paragraph',()=>{
  for(const birth of [{},{birthDate:'1995-02-30',gender:'female'},{...a,birthTime:'99:02'}])assert.equal(annualSignFacts(birth,[2024],keys).size,0)
  assert.deepEqual(appendAnnualSignReadings([],a),[])
})

test('new paragraphs reach selected and history cards; base text, scores, IDs and birth snapshot remain intact',()=>{
  const input=buildFixtureReportInput(a)
  input.timing!.annual=input.timing!.annual.filter(y=>[2014,2021].includes(y.year))
  const before=structuredClone(input),base=buildAnnualHistoryCards({...input,gender:undefined},2026)
  const current=buildAnnualHistoryCards(input,2026)
  assert.deepEqual(input,before)
  assert.deepEqual(current.map(c=>[c.id,c.title,c.summary,c.tags]),base.map(c=>[c.id,c.title,c.summary,c.tags]))
  assert(current.some(c=>c.sections!.some(s=>s.components?.some(c=>c.claimId?.startsWith(ANNUAL_SIGN_VERSION)))))
  assert(buildTurningPointCards(input,2026).some(c=>c.metadataRefs!.some(s=>s.startsWith(ANNUAL_SIGN_VERSION))))
  for(const [i,card]of current.entries())assert.deepEqual(card.sections!.slice(0,2),base[i].sections!.slice(0,2))
  const snapshot={birthDate:a.birthDate,birthTime:a.birthTime,birthplace:a.birthplace,gender:a.gender}
  const history=selfTimingHistoryFromBirthSnapshot(snapshot,2014)
  assert(history.cards.some(c=>c.metadataRefs!.some(r=>r.startsWith(ANNUAL_SIGN_VERSION))))
})
