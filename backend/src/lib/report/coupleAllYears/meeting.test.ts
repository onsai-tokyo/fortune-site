import test from 'node:test'
import assert from 'node:assert/strict'
import {composeYear} from './composer.js'
import {meetingIntroduction} from './meeting.js'
import {coupleSnapshot,snapshotTimeline} from './snapshot.js'
test('meeting framing preserves original yearly text and applies only to meeting year',()=>{
 const snapshot=coupleSnapshot({self:{birthDate:'1995-02-20'},partner:{birthDate:'1985-06-06'},relationshipType:'romantic'},null)
 const timeline=snapshotTimeline(snapshot,2023)
 assert.equal(timeline.entries[0].card?.sections?.[0].heading,'出会いのきっかけ')
 assert.ok(timeline.entries.slice(1).every(e=>!e.card?.metadataRefs?.includes('meeting-editorial-1.1')))
 const original=snapshotTimeline(snapshot,2022).entries.find(e=>e.year===2023)!.card!
 assert.equal(timeline.entries[0].card?.title, `出会いの年 — ${original.title}`)
 assert.deepEqual(timeline.entries[0].card?.sections?.slice(1),original.sections)
})
test('family, friend, unspecified and child contexts never receive a romance introduction',()=>{
 const adult=composeYear('甲子','乙丑','角','亢',2026,1990,1990)
 for(const type of ['family','friend',undefined]) assert.doesNotMatch(meetingIntroduction(adult,type),/恋愛|恋人|交際/)
 const child=composeYear('甲子','乙丑','角','亢',2026,2020,1990)
 assert.doesNotMatch(meetingIntroduction(child,'romantic'),/恋愛|恋人|交際/)
 assert.match(meetingIntroduction({...adult,paragraphs:['友達として交流する']},'romantic'),/最初は友人や知人/)
})
