import test from 'node:test'
import assert from 'node:assert/strict'
import {composeYear} from './composer.js'
import {meetingIntroduction} from './meeting.js'
import {coupleSnapshot,snapshotTimeline} from './snapshot.js'
test('meeting framing uses annual materials, stays in four paragraphs, and only changes the selected year',()=>{
 const snapshot=coupleSnapshot({self:{birthDate:'1995-02-20'},partner:{birthDate:'1985-06-06'},relationshipType:'romantic'},null)
 const a=snapshotTimeline(snapshot,2023),b=snapshotTimeline(snapshot,2022)
 const card=a.entries[0].card!
 assert.ok(card.tags.includes('#出会った年'))
 assert.equal(card.sections?.[0].body.split('\n\n').length,4)
 assert.deepEqual(a.entries.find(e=>e.year===2024)?.card,b.entries.find(e=>e.year===2024)?.card)
 assert.ok(!b.entries.find(e=>e.year===2023)?.card?.tags.includes('#出会った年'))
})
test('meeting scenes do not infer dating and do not inspect arbitrary body keywords',()=>{
 const adult=composeYear('甲子','乙丑','角','亢',2026,1990,1990)
 for(const type of ['family','friend',undefined,'romantic']) assert.doesNotMatch(meetingIntroduction(adult,type),/恋愛|恋人|交際/)
 const child=composeYear('甲子','乙丑','角','亢',2026,2020,1990)
 assert.doesNotMatch(meetingIntroduction(child,'romantic'),/恋愛|恋人|交際|仕事|職場/)
 assert.equal(meetingIntroduction({...adult,paragraphs:['仕事 職場 恋愛']},'romantic'),meetingIntroduction(adult,'romantic'))
})
