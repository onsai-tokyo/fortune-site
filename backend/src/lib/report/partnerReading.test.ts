import test from 'node:test'
import assert from 'node:assert/strict'
import {partnerReadingFromBirthSnapshot} from './partnerReading.js'

test('partner reading uses the same personality pipeline and birth snapshot, with no owner mixup',()=>{
 process.env.NARRATIVE_ENGINE='personality'
 const partner={birthDate:'1995-03-16',birthTime:'00:52',birthplace:'名古屋',gender:'female'}
 const first=partnerReadingFromBirthSnapshot({self:{birthDate:'1990-01-01'},partner})
 const second=partnerReadingFromBirthSnapshot({self:{birthDate:'1980-01-01'},partner})
 assert.deepEqual(first,second)
 assert.ok(first.cards.length>10)
 assert.ok(first.chartSections.length>0)
 assert.ok(first.cards.every(c=>!c.scope||c.scope==='self'))
 const other=partnerReadingFromBirthSnapshot({partner:{...partner,birthDate:'1995-02-20'}})
 assert.notDeepEqual(first.cards.filter(c=>c.kind==='essence'),other.cards.filter(c=>c.kind==='essence'))
})
test('missing, invalid and impossible partner dates cannot silently become another reading',()=>{
 for(const partner of [undefined,{}, {birthDate:'1995-02-30',gender:'female'}, {birthDate:'1995-02-20',gender:'other'},{birthDate:'1995-02-20',gender:'female',birthTime:'25:01'}]) assert.throws(()=>partnerReadingFromBirthSnapshot({partner}))
})
