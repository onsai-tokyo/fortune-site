import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileQuestions } from './questionReconciliation.js'
test('question sweep validates quota aggregates and never returns question or owner data',async()=>{
 const plan={mode:'dry_run',examined:2,wouldReleaseFree:1,wouldReleaseMonthly:2,reconciled:0,releasedFree:0,releasedMonthly:0,hasMore:true,busy:false}
 let calls=0
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{calls++;assert.equal(name,'reconcile_reading_questions');assert.deepEqual(args,{p_apply:false,p_limit:2});return {data:{...plan,question:'private',user_id:'private'},error:null}}}
 assert.deepEqual(await reconcileQuestions(db,{apply:false,limit:2}),plan);assert.equal(calls,1)
 for(const data of [null,{}, {...plan,releasedFree:1},{...plan,examined:3},{...plan,mode:'apply'},{...plan,wouldReleaseMonthly:3},{...plan,busy:true}])await assert.rejects(reconcileQuestions({rpc:async()=>({data,error:null})},{apply:false,limit:2}))
 const applied={...plan,mode:'apply',wouldReleaseFree:0,wouldReleaseMonthly:0,reconciled:2,releasedFree:1,releasedMonthly:2}
 assert.deepEqual(await reconcileQuestions({rpc:async()=>({data:applied,error:null})},{apply:true,limit:2}),applied)
 await assert.rejects(reconcileQuestions({rpc:async()=>({data:{...applied,reconciled:1},error:null})},{apply:true,limit:2}))
 await assert.rejects(reconcileQuestions({rpc:async()=>({data:plan,error:{message:'private'}})},{apply:false,limit:2}))
})
test('question operator CLI fails closed without configuration',async()=>{
 const {spawnSync}=await import('node:child_process')
 for(const args of [[],['--aply']]) {
  const result=spawnSync(process.execPath,['--import','tsx','src/scripts/reconcileReadingQuestions.ts',...args],{encoding:'utf8',env:{PATH:process.env.PATH},timeout:10000})
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.deepEqual(JSON.parse(result.stderr),{state:'unavailable_or_unacknowledged'})
 }
})
