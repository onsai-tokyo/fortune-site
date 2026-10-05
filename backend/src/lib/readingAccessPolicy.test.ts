import test from 'node:test'
import assert from 'node:assert/strict'
import {readingOffer,offerKey,canReadOffer} from './readingAccessPolicy.js'
const year=(year:number,scope='self')=>({id:`arbitrary-${year}`,kind:'timing',scope,period:{label:`${year}年`}})
test('2027 is a fixed boundary for both timelines',()=>{
  for(const scope of ['self','couple']){
    assert.equal(readingOffer(year(2026,scope)),null)
    assert.deepEqual(readingOffer(year(2027,scope)),{kind:'year',scope,year:2027})
    assert.ok(readingOffer(year(2040,scope)))
  }
})
test('only the agreed three compatibility sections are paid, independent of order',()=>{
  for(let n=1;n<=7;n++){
    const card={id:`compat-v24-${n}`,kind:'essence',scope:'couple'}
    assert.equal(!!readingOffer(card),n>=5)
    assert.equal(readingOffer({...card,scope:'self'}),null)
  }
})
test('a purchased year does not unlock a different year or the couple timeline',()=>{
  const a=readingOffer(year(2027))!,b=readingOffer(year(2028))!,c=readingOffer(year(2027,'couple'))!
  const owned=new Set([offerKey(a)])
  assert.equal(canReadOffer(a,false,owned),true)
  assert.equal(canReadOffer(b,false,owned),false)
  assert.equal(canReadOffer(c,false,owned),false)
  assert.equal(canReadOffer(c,true,owned),true)
  assert.equal(canReadOffer(null,false,new Set()),true)
})
test('no inference from titles, list indexes or malformed periods',()=>{
  assert.equal(readingOffer({id:'unknown',kind:'essence',scope:'couple'}),null)
  assert.equal(readingOffer({...year(2027),period:{label:'12027年'}}),null)
  assert.equal(readingOffer({...year(2027),kind:'essence'}),null)
  assert.equal(readingOffer(year(2027,'unknown')),null)
})

test('locked payload has no text, tags, calculations or unknown fields; source is not mutated', async () => {
  const {projectReadingCard} = await import('./readingAccessPolicy.js')
  const card = {id:'compat-v24-7',kind:'essence',scope:'couple',title:'復縁の可能性',
    summary:'private',tags:['private'],pages:[{text:'private'}],sections:[{body:'private'}],
    evidence:[{detail:'private'}],timelineV3Calculation:{input:'private'},futureInternalField:'private'}
  const locked = projectReadingCard(card,false,new Set())
  assert.equal(JSON.stringify(locked).includes('private'),false)
  assert.equal(locked.access.locked,true)
  assert.equal(card.summary,'private')
  assert.equal(projectReadingCard(card,true,new Set()).summary,'private')
  assert.equal(projectReadingCard(card,false,new Set(['compatibility:compat-v24-7'])).summary,'private')
})
