import test from 'node:test'
import assert from 'node:assert/strict'
import {handleCoupleTimeline} from './coupleTimeline.js'
const id='10000000-0000-4000-8000-000000000001'
function harness() {
  const tables:Record<string,Array<Record<string,unknown>>>={reading_conversations:[{id,user_id:'owner',kind:'compatibility',partner_profile_id:null,birth_data:{self:{birthDate:'1995-03-16'},partner:{birthDate:'1990-01-15'}}}],couple_timeline_settings:[]}
  let writes=0
  const db={from:(name:string)=>{
    const filters:Record<string,unknown>={}
    const query={select:(_:string)=>query,eq:(key:string,value:unknown)=>{filters[key]=value;return query},match:(values:Record<string,unknown>)=>{Object.assign(filters,values);return query},maybeSingle:async()=>({data:tables[name].find(r=>Object.entries(filters).every(([k,v])=>r[k]===v))??null,error:null}),upsert:async(row:Record<string,unknown>)=>{writes++;const i=tables[name].findIndex(r=>r.user_id===row.user_id&&r.relationship_key===row.relationship_key);if(i>=0)tables[name][i]=row;else tables[name].push(row);return {error:null}}};return query
  }}
  async function call(userId:string,method='GET',meetingYear?:unknown) {
    let status=200,body:Record<string,any>={}
    const res={setHeader:()=>{},status:(s:number)=>{status=s;return res},json:(b:Record<string,any>)=>{body=b}}
    await handleCoupleTimeline({params:{id},userId,accessToken:'test',method,body:{meetingYear}} as never,res as never,{user:()=>db,admin:()=>db} as never)
    return {status,body}
  }
  return {call,tables,writes:()=>writes}
}
test('owned report loads null settings, saves, and reads the same year without changing the snapshot',async()=>{
  const h=harness(),before=JSON.stringify(h.tables.reading_conversations)
  assert.equal((await h.call('owner')).body.status,'needs_meeting_year')
  const save=await h.call('owner','PATCH',2006)
  assert.equal(save.status,200);assert.equal(save.body.meetingYear,2006)
  assert.equal((await h.call('owner')).body.entries[0].year,2006)
  assert.equal(JSON.stringify(h.tables.reading_conversations),before)
  assert.equal((await h.call('owner','PATCH',null)).body.status,'needs_meeting_year')
})
test('another account cannot read or mutate the relationship; bad values never write',async()=>{
  const h=harness()
  assert.equal((await h.call('other')).status,404)
  assert.equal((await h.call('other','PATCH',2006)).status,404)
  for(const year of ['2006',true,2006.1,1994,9999,undefined])assert.equal((await h.call('owner','PATCH',year)).status,400)
  assert.equal(h.writes(),0)
})
