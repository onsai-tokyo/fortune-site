import test from 'node:test'
import assert from 'node:assert/strict'
import {saveWebSnapshot} from './webReadingSnapshots.js'
const source='11111111-1111-4111-8111-111111111111'
function setup(owner='owner',dbFailure=false) {
  let status=200,writes=0
  const req={userId:owner,accessToken:'fixture',body:{sourceId:source,payload:{
    key:'you-2026',kind:'you',label:'あなた',title:'保存',sections:[{heading:'',body:'本文'}],
  }}}
  const res:any={status(n:number){status=n;return res},json(){return res}}
  const client=()=>({from(table:string){
    const filters:Record<string,unknown>={}
    const q:any={select(){return q},eq(k:string,v:unknown){filters[k]=v;return q},
      async maybeSingle(){return {data:filters.user_id==='owner'&&filters.id===source?{id:source}:null,error:dbFailure?{}:null}},
      async upsert(row:any,options:any){writes++;assert.equal(row.user_id,owner);assert.equal(options.ignoreDuplicates,true);return {error:null}},
      async single(){assert.equal(filters.user_id,owner);return {data:{id:'saved'},error:null}},
    }
    assert.ok(['reading_conversations','web_reading_snapshots'].includes(table));return q
  }})
  return {req,run:async()=>{await saveWebSnapshot(req as any,res,client as any,client as any);return {status,writes}}}
}
test('snapshot source ownership checked before insertion; another owner cannot save it',async()=>{
  assert.deepEqual(await setup('other').run(),{status:404,writes:0})
  assert.deepEqual(await setup().run(),{status:200,writes:1})
})
test('source lookup failure never persists guessed or unchecked snapshot',async()=>{
  assert.deepEqual(await setup('owner',true).run(),{status:503,writes:0})
})
