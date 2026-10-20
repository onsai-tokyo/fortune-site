import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {snapshotInput} from './webReadingSnapshot.js'
const input={sourceId:'11111111-1111-4111-8111-111111111111',payload:{
  key:'you-2026',kind:'you',title:'2026年の鑑定',label:'あなた',sections:[{heading:'流れ',body:'保存した本文'}],
}}
test('snapshot retry is stable, changed source or prose creates a different snapshot',()=>{
  assert.equal(snapshotInput(input).hash,snapshotInput(structuredClone(input)).hash)
  assert.notEqual(snapshotInput(input).hash,snapshotInput({...input,payload:{...input.payload,title:'新しい鑑定'}}).hash)
  assert.notEqual(snapshotInput(input).hash,snapshotInput({...input,sourceId:'22222222-2222-4222-8222-222222222222'}).hash)
})
test('snapshot validation rejects oversized, malformed and mismatched couple input',()=>{
  for(const value of [null,{}, {...input,sourceId:'other'}, {...input,payload:{...input.payload,sections:[]}},
    {...input,payload:{...input.payload,kind:'couple'}},
    {...input,payload:{...input.payload,sections:[{heading:'x',body:'x'.repeat(50001)}]}}])assert.throws(()=>snapshotInput(value))
})
test('only display fields are retained; no client owner or entitlement accepted',()=>{
  const result=snapshotInput({...input,user_id:'other',payload:{...input.payload,credits:100,html:'<script>x</script>'}})
  assert.equal('credits' in result.payload,false)
  assert.equal('user_id' in result,false)
})
test('migration requires ownership and non-anonymous insert; snapshots immutable and deletion cascades',()=>{
  const sql=readFileSync(new URL('../../supabase/web_reading_snapshots_20261021.sql',import.meta.url),'utf8')
  assert.match(sql,/is_anonymous/)
  assert.match(sql,/c\.user_id=auth\.uid\(\)/)
  assert.match(sql,/p\.user_id=auth\.uid\(\)/)
  assert.match(sql,/revoke update/)
  assert.match(sql,/auth\.users\(id\) on delete cascade/)
  assert.match(sql,/partner_profiles\(id\) on delete cascade/)
  assert.doesNotMatch(sql,/alter table public\.reading_saves/)
})
