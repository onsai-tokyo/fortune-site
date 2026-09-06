import test from 'node:test'
import assert from 'node:assert/strict'
import { questionRPC, QuestionDependencyError } from './questionOperation.js'
test('question RPC requires typed durable completion; transport errors stay unknown',async()=>{
 for(const data of [null,{}, {state:'completed'}, {state:'completed',result:{answer:'partial'}}]) {
  await assert.rejects(questionRPC('complete_reading_question',{}, {rpc:async()=>({data,error:null})}),QuestionDependencyError)
 }
 await assert.rejects(questionRPC('complete_reading_question',{}, {rpc:async()=>({data:null,error:{message:'network'}})}),QuestionDependencyError)
 const result={state:'completed',result:{answer:'answer',suggestions:[],referencedSystems:[],questionId:'q',answerId:'a'}}
 assert.deepEqual(await questionRPC('complete_reading_question',{}, {rpc:async()=>({data:result,error:null})}),result)
})
