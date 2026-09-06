import test from 'node:test'
import assert from 'node:assert/strict'
import { generationRPC, GenerationDependencyError } from './selfGeneration.js'
test('generation acknowledgement requires a typed complete report',async()=>{
 for(const data of [null,{}, {state:'completed'}, {state:'completed',result:{reportText:'partial'}}]) {
  await assert.rejects(generationRPC('settle_self_generation',{}, {rpc:async()=>({data,error:null})}),GenerationDependencyError)
 }
 await assert.rejects(generationRPC('get_self_generation',{}, {rpc:async()=>({data:null,error:{code:'missing_migration'}})}),GenerationDependencyError)
 const response={state:'completed',result:{version:3,cards:[],reportText:'body',unknownMetadata:{id:'x'}}}
 assert.deepEqual(await generationRPC('get_self_generation',{}, {rpc:async()=>({data:response,error:null})}),response)
})
