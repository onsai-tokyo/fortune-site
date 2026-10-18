import assert from 'node:assert/strict'
import test from 'node:test'
import { ANNUAL_HEADINGS, ANNUAL_LAYOUT_VERSION, componentBody, organizeAnnualCards } from './annualReadingLayout.js'
import { ANNUAL_SIGN_VERSION } from './annualSignAssets.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { buildAnnualHistoryCards } from './timingCards.js'
import { reportContractViolations } from './contract.js'
import type { ReportCard } from '../reportCards.js'

test('three groups preserve condition readings, dates, evidence and source IDs in calendar order', () => {
  const input=buildFixtureReportInput(BIRTH_FIXTURES[0])
  const year=input.timing!.annual[0].year
  const evidence=[{family:'test',system:'test',detail:'calculated source'}]
  const themes={heading:'この年のテーマ',body:'年の中心になる読みです。',evidence,termGloss:[],claimId:`timing-annual-${year}-themes`}
  const signs=[12,1,8].map((month,i)=>({heading:`期間の読み${i}`,body:`${month}月ごろに、生活を見直す読みです。`,evidence,termGloss:[],claimId:`${ANNUAL_SIGN_VERSION}:${year}:T${i}`}))
  const card:ReportCard={id:`turning-year-${year}`,kind:'timing',scope:'self',tab:'timing',title:'年の鑑定',summary:'年の要約。',tags:['時期'],period:null,pages:[],sections:[themes,...signs],evidence}
  const before=structuredClone(card), result=organizeAnnualCards([card],input)[0]
  assert.deepEqual(card,before)
  assert.deepEqual(result.sections!.map(s=>s.heading),ANNUAL_HEADINGS)
  assert.deepEqual(result.sections![2].components,[signs[1],signs[2],signs[0]])
  assert.deepEqual(result.sections![2].sourceClaimIds,[signs[1].claimId,signs[2].claimId,signs[0].claimId])
  assert.equal(result.sections![2].body,componentBody(result.sections![2].components!))
  assert.deepEqual(organizeAnnualCards([result],input),[result])
  assert.deepEqual(organizeAnnualCards([{...card,scope:'couple'}],input),[{...card,scope:'couple'}])
})

test('unknown birth conditions leave period uncertainty visible without invented monthly events', () => {
  const input=buildFixtureReportInput(BIRTH_FIXTURES[0])
  const cards=buildAnnualHistoryCards({...input,birthTime:undefined,gender:undefined},2026)
  for(const card of cards){
    assert.deepEqual(card.sections!.map(s=>s.heading),ANNUAL_HEADINGS)
    assert.deepEqual(card.sections![2].components,[])
    assert.match(card.sections![2].body,/時期を絞れる根拠が得られていません/)
    assert.doesNotMatch(card.sections![2].body,/\d+月/)
  }
})

test('long grouped bodies require bounded source components; legacy section length is not relaxed', () => {
  const input=buildFixtureReportInput(BIRTH_FIXTURES[0])
  const card=buildAnnualHistoryCards(input,2026)[0]
  assert.deepEqual(reportContractViolations({version:3,cards:[card],reportText:''},input),[])
  const modified=structuredClone(card)
  modified.sections![1].body+='架空の出来事。'
  assert.ok(reportContractViolations({version:3,cards:[modified],reportText:''},input).some(v=>v.code==='SCHEMA'))
  const legacy={...card,metadataRefs:card.metadataRefs!.filter(r=>r!==ANNUAL_LAYOUT_VERSION),sections:[{heading:'旧形式',body:'あ'.repeat(221),evidence:card.evidence,termGloss:[]}]}
  assert.ok(reportContractViolations({version:3,cards:[legacy],reportText:''},input).some(v=>v.code==='SECTION_LENGTH'))
})
