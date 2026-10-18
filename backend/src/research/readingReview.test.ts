import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { get } from 'node:http'
import { validateBirth, validateFeedback, ReadingReviewStore, ReviewConflict, REVIEW_POLICY } from './readingReview.js'
import { createReadingReviewServer } from '../scripts/research/readingReviewServer.js'

const birth={nickname:'合成テスト',birthDate:'1990-04-12',birthTime:'8:3',birthplace:'東京都',gender:'female'}
test('birth validation preserves unknown time and rejects rollover dates, bad time and unsupported locations',()=>{
 assert.equal(validateBirth(birth).birthTime,'08:03')
 assert.equal(validateBirth({...birth,birthTime:''}).birthTime,undefined)
 for(const override of [{birthDate:'1995-02-30'},{birthDate:'1899-01-01'},{birthDate:'2999-01-01'},{birthTime:'24:00'},{birthTime:'3:x'},{birthplace:'London'},{gender:'other'}])assert.throws(()=>validateBirth({...birth,...override}))
})
test('feedback distinguishes unknown/unreviewed, keeps precision, and rejects targets from another snapshot',()=>{
 const targets=[{id:'card/section/0',cardID:'card',heading:'test',body:'body',evidence:[]}]
 const fb={items:[{targetID:targets[0].id,verdict:'unknown',issue:'timing',actual:'時期は不明',period:'2014',observer:'unknown',certainty:'unknown'}],events:[],overall:''}
 assert.equal(validateFeedback(fb,targets).items[0].period,'2014')
 assert.equal(validateFeedback(fb,targets).items[0].verdict,'unknown')
 assert.throws(()=>validateFeedback({...fb,items:[{...fb.items[0],targetID:'other'}]},targets))
 assert.throws(()=>validateFeedback({...fb,items:[fb.items[0],fb.items[0]]},targets))
 assert.throws(()=>validateFeedback({...fb,items:[{...fb.items[0],period:'2014-02-30'}]},targets))
})
test('private snapshots survive reopening; revision conflicts fail; feedback cannot train or change generation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fatelab-review-'))
 try{
  const store=new ReadingReviewStore(dir),first=store.create(birth)
  const content=structuredClone(first.cards),target=first.targets[0]
  const feedback={items:[{targetID:target.id,verdict:'wrong',issue:'content',actual:'実際は反対だった',period:'',observer:'self',certainty:'confirmed'}],events:[],overall:'合成データ'}
  const saved=store.save(first.id,0,first.contentHash,feedback)
  assert.equal(saved.revision,1);assert.deepEqual(saved.cards,content);assert.equal(saved.history.length,1)
  assert.throws(()=>store.save(first.id,0,first.contentHash,feedback),ReviewConflict)
  assert.throws(()=>store.save(first.id,1,'other-hash',feedback),ReviewConflict)
  const reopened=new ReadingReviewStore(dir).get(first.id)
  assert.deepEqual(reopened.feedback,saved.feedback);assert.deepEqual(reopened.policy,REVIEW_POLICY)
  assert.ok(reopened.targets.some(t=>t.selectionTrace))
  assert.deepEqual(reopened.targets,saved.targets)
  assert.equal(statSync(join(dir,`review-${first.id}.json`)).mode&0o077,0)
  const next=store.create({...birth,birthTime:'08:03'},first.id)
  assert.equal(next.caseID,first.caseID);assert.notEqual(next.id,first.id);assert.equal(next.contentHash,first.contentHash)
  assert.deepEqual(next.feedback,{items:[],events:[],overall:''});assert.deepEqual(store.get(first.id).feedback,saved.feedback)
  assert.equal(store.list().length,2)
  assert.equal(store.list()[0].id,next.id)
  assert.equal(store.list()[0].lastSavedAt,next.createdAt)
  const resaved=store.save(first.id,saved.revision,first.contentHash,{...feedback,overall:'追記した合成データ'})
  const ordered=new ReadingReviewStore(dir).list()
  assert.equal(ordered[0].id,first.id)
  assert.equal(ordered[0].createdAt,first.createdAt)
  assert.equal(ordered[0].lastSavedAt,resaved.history.at(-1)?.savedAt)
  assert.equal(ordered[0].reviewed,1)
  assert.deepEqual(resaved.cards,content)
  assert.deepEqual(resaved.history[0],saved.history[0])
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('standalone HTTP rejects cross-origin, rebinding hosts and tokenless access; no production route is added',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'fatelab-review-http-')), {server}=createReadingReviewServer(dir)
 server.listen(0,'127.0.0.1');await once(server,'listening')
 const address=server.address();assert(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`
 try{
  const page=await fetch(url),html=await page.text(),token=html.match(/name="review-token" content="([a-f0-9]+)"/)?.[1];assert(token)
  assert.equal((await fetch(url+'/api/runs')).status,403)
  assert.equal((await fetch(url+'/api/runs',{headers:{'X-Review-Token':token,Origin:'https://example.org'}})).status,403)
  const hostStatus=await new Promise<number|undefined>((resolve,reject)=>get(url,{headers:{Host:'attacker.invalid'}},response=>{response.resume();resolve(response.statusCode)}).on('error',reject))
  assert.equal(hostStatus,403)
  assert.deepEqual(await(await fetch(url+'/api/runs',{headers:{'X-Review-Token':token}})).json(),[])
  assert.equal((await fetch(url+'/api/generate',{method:'POST',headers:{'X-Review-Token':token,'Content-Type':'text/plain'},body:'{}'})).status,415)
  const fresh=await fetch(url+'/api/generate',{method:'POST',headers:{'X-Review-Token':token,'Content-Type':'application/json'},body:JSON.stringify({birth:{...birth,birthTime:''}})})
  assert.equal(fresh.status,201)
  const generated=await fresh.json() as {id:string;birth:{birthTime?:string};sourceHash:string;targets:unknown[]}
  assert.equal(generated.birth.birthTime,undefined);assert.match(generated.sourceHash,/^[a-f0-9]{64}$/);assert(generated.targets.length>0)
  assert.equal((await fetch(url+'/api/runs/'+generated.id,{headers:{'X-Review-Token':token}})).status,200)
  assert.doesNotMatch(readFileSync(new URL('../index.ts',import.meta.url),'utf8'),/readingReview|reading-review/)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true})}
})

test('unknown birth time produces a valid reloadable JSON snapshot, including after saving feedback',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fatelab-review-unknown-'))
 try{
  const store=new ReadingReviewStore(dir),run=store.create({...birth,birthTime:''})
  assert.equal(run.birth.birthTime,undefined)
  assert.equal(Object.hasOwn(store.get(run.id).birth,'birthTime'),false)
  assert.equal(store.list().length,1)
  assert.doesNotThrow(()=>JSON.parse(readFileSync(join(dir,`review-${run.id}.json`),'utf8')))
  store.save(run.id,0,run.contentHash,{items:[],events:[],overall:'時刻不明の保存試験'})
  assert.equal(new ReadingReviewStore(dir).get(run.id).feedback.overall,'時刻不明の保存試験')
 }finally{rmSync(dir,{recursive:true,force:true})}
})
