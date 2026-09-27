import test from 'node:test'
import assert from 'node:assert/strict'
import {handlePartnerReading} from './partnerReading.js'
test('derived partner report requires owner and compatibility kind, never writes or consumes credits',async()=>{
 for(const [owner,kind,expected] of [['other','compatibility',404],['owner','self',422],['owner','compatibility',200]] as const){
  const filters:Record<string,string>={}
  const row={user_id:'owner',id:'reading',kind,birth_data:{partner:{birthDate:'1995-03-16',birthTime:'00:52',birthplace:'名古屋',gender:'female'}}}
  const q={select:()=>q,eq:(k:string,v:string)=>{filters[k]=v;return q},maybeSingle:async()=>({data:Object.entries(filters).every(([k,v])=>(row as any)[k]===v)?row:null,error:null})}
  const db=()=>({from:(table:string)=>{assert.equal(table,'reading_conversations');return q}})
  let status=200,body:any
  const res={status:(s:number)=>{status=s;return res},setHeader:()=>{},json:(value:any)=>{body=value}}
  await handlePartnerReading({params:{id:'reading'},userId:owner,accessToken:'test'} as never,res as never,db as never)
  assert.equal(status,expected)
  if(expected===200)assert.ok(body.cards.length>0)
 }
})
