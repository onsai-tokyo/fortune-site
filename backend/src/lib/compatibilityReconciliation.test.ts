import test from 'node:test'
import assert from 'node:assert/strict'
import { reconciliationOptions, reconcileCompatibility } from './compatibilityReconciliation.js'

test('operator reconciliation defaults to one read-only bounded batch and rejects ambiguous options',()=>{
 assert.deepEqual(reconciliationOptions([]),{apply:false,limit:100})
 assert.deepEqual(reconciliationOptions(['--limit','2','--apply']),{apply:true,limit:2})
 for(const args of [['--aply'],['--apply','--apply'],['--limit'],['--limit','0'],['--limit','101'],['--limit','1.5'],['--limit','1','--limit','2'],['--apply=true']])assert.throws(()=>reconciliationOptions(args))
})
test('operator acknowledgement is validated and output contains aggregates only',async()=>{
 const valid={mode:'dry_run',examined:2,wouldRefundPoints:6,reconciled:0,refundedPoints:0,hasMore:true,busy:false}
 let calls=0
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{calls++;assert.equal(name,'reconcile_compatibility_operations');assert.deepEqual(args,{p_apply:false,p_limit:2});return {data:{...valid,rawInput:'private',user_id:'private'},error:null}}}
 assert.deepEqual(await reconcileCompatibility(db,{apply:false,limit:2}),valid);assert.equal(calls,1)
 for(const data of [null,{}, {...valid,refundedPoints:3},{...valid,examined:3},{...valid,mode:'apply'},{...valid,wouldRefundPoints:7},{...valid,busy:true}])await assert.rejects(reconcileCompatibility({rpc:async()=>({data,error:null})},{apply:false,limit:2}))
 await assert.rejects(reconcileCompatibility({rpc:async()=>({data:valid,error:{message:'private'}})},{apply:false,limit:2}))
 const apply={mode:'apply',examined:2,wouldRefundPoints:0,reconciled:2,refundedPoints:3,hasMore:false,busy:false}
 assert.deepEqual(await reconcileCompatibility({rpc:async()=>({data:apply,error:null})},{apply:true,limit:2}),apply)
 await assert.rejects(reconcileCompatibility({rpc:async()=>({data:{...apply,reconciled:1},error:null})},{apply:true,limit:2}))
})


test('operator CLI fails closed without configuration and never prints secrets or starts retries',async()=>{
 const {spawnSync}=await import('node:child_process')
 for(const args of [[],['--aply']]) {
   const result=spawnSync(process.execPath,['--import','tsx','src/scripts/reconcileCompatibilityOperations.ts',...args],{encoding:'utf8',env:{PATH:process.env.PATH},timeout:10000})
   assert.equal(result.status,1)
   assert.equal(result.stdout,'')
   assert.deepEqual(JSON.parse(result.stderr),{state:'unavailable_or_unacknowledged'})
 }
})
