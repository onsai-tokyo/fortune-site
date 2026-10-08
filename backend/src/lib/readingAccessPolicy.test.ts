import test from 'node:test'
import assert from 'node:assert/strict'
import {readingOffer,projectReadingCard} from './readingAccessPolicy.js'
test('all self and couple years and compatibility cards are free without membership',()=>{
 const cards=[...['self','couple'].flatMap(scope=>[1900,2026,2027,2040].map(year=>({id:`year-${year}`,kind:'timing',scope,period:{label:`${year}年`},title:'年運'}))),...[1,2,3,4,5,6,7].map(n=>({id:`compat-v24-${n}`,kind:'essence',scope:'couple',title:'相性'}))]
 for(const card of cards){
  assert.equal(readingOffer(card),null)
  const original={...card,summary:'本文',access:{locked:true}}
  const result=projectReadingCard(original,false,new Set())
  assert.equal(result.access.locked,false);assert.equal(result.summary,'本文');assert.equal(original.access.locked,true)
 }
})
