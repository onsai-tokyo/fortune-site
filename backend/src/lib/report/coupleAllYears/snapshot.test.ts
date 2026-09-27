import test from 'node:test'
import assert from 'node:assert/strict'
import {coupleSnapshot,validateMeetingYear,snapshotTimeline} from './snapshot.js'
const a={birthDate:'1995-03-16',birthTime:'00:52'},b={birth_date:'1970-01-15',birth_time:null}
test('relationship persistence uses canonical stored pair, survives swap, isolates partner IDs',()=>{
  const one=coupleSnapshot({self:a,partner:b},'p1')
  assert.equal(one.relationshipKey,coupleSnapshot({self:b,partner:a},'p1').relationshipKey)
  assert.notEqual(one.relationshipKey,coupleSnapshot({self:a,partner:b},'p2').relationshipKey)
  assert.equal(one.minMeetingYear,1995)
  assert.equal(one.relationshipKey,coupleSnapshot({self:{...a,birthTime:'00:52:00'},partner:b},'p1').relationshipKey)
  assert.throws(()=>coupleSnapshot({self:a},'p1'))
  assert.throws(()=>coupleSnapshot({self:{birthDate:'1995-02-31'},partner:b},'p1'))
})
test('meeting settings require explicit null or integer, reject birth-before/future inputs',()=>{
  assert.equal(validateMeetingYear(null,1995,2026),null)
  assert.equal(validateMeetingYear(1995,1995,2026),1995)
  for(const x of [undefined,'2006',true,2006.5,1994,2027])assert.throws(()=>validateMeetingYear(x,1995,2026))
})
test('API presentation returns all cards without private audit material',()=>{
  const snap=coupleSnapshot({self:a,partner:b},'p1'),out=snapshotTimeline(snap,1995)
  assert.equal(out.entries[0].year,1995)
  assert.equal(out.entries.length,out.endYear-1995+1)
  assert.ok(out.entries.every(e=>!('reading' in e)&&e.card?.sections?.length===1))
  assert.equal(snapshotTimeline(snap,null).status,'needs_meeting_year')
})
