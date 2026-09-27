import test from 'node:test'
import assert from 'node:assert/strict'
import { validateBookDocument, validateBookQuestion, bookSources, grantVerifiedBookPurchase, type BookSource } from './aiBooks.js'
import { publicBook } from '../routes/aiBooks.js'
const text='相手に伝える前に、自分が大切にしていることを整理する時間が役立ちます。'
const sources:BookSource[]=[1,2,3].map(n=>({id:String(n),title:'原稿'+n,text,version:'test-v1',evidence:[]}))
function valid() {return {title:'ふたりの伝え方を見直す',summary:text,answer:text.repeat(45),sections:sources.map(s=>({heading:'相手への伝え方',body:text.repeat(30),sourceId:s.id,quote:text})),actions:[text,text]}}
test('valid source-backed report is accepted and unknown fields are stripped',()=>{
  assert.equal(validateBookDocument({...valid(),untrusted:'ignored'},sources).title,valid().title)
  assert.equal('untrusted' in validateBookDocument({...valid(),untrusted:'ignored'},sources),false)
})
test('invented, duplicated or misquoted evidence cannot publish',()=>{
  for(const change of [(d:ReturnType<typeof valid>)=>d.sections[0].sourceId='invented',(d:ReturnType<typeof valid>)=>d.sections[0].sourceId='2',(d:ReturnType<typeof valid>)=>d.sections[0].quote='原稿には存在しない捏造された説明']) {
    const d=valid(); change(d); assert.throws(()=>validateBookDocument(d,sources))
  }
})
test('truncated and unsupported guaranteed claims cannot publish',()=>{
  assert.throws(()=>validateBookDocument({title:'短い'},sources))
  assert.throws(()=>validateBookDocument({...valid(),answer:'絶対に結婚できます。'+text.repeat(4)},sources))
})
test('source snapshots preserve edited report text and scope',()=>{
  const card=(id:string,scope:string)=>({id,scope,kind:'essence',title:'仕事',summary:text,tags:[],pages:[{text}],evidence:[]})
  const result=bookSources({kind:'self',calculated_data:{_structuredReport:{version:3,reportText:'',generator:'deterministic',generatorVersion:'confirmed-v4',cards:[card('a','self'),card('b','couple')]}}},'仕事')
  assert.deepEqual(result.map(s=>s.id),['a']); assert.equal(result[0].version,'confirmed-v4'); assert.ok(result[0].text.includes(text))
})
test('review drafts and snapshots do not leak through public responses',()=>{
  for(const state of ['queued','generating','review','failed']) {
    const out=publicBook({state,document:{secret:true},source_snapshot:sources,metadata:{private:true}})
    assert.equal(out.document,null); assert.deepEqual(out.sources,[]); assert.equal('metadata' in out,false)
  }
  assert.deepEqual(publicBook({state:'delivered',document:valid(),source_snapshot:sources}).document,valid())
})
test('question checks run before payment, enforce code point length and reject unsupported themes',()=>{
  assert.equal(validateBookQuestion(text,'恋愛・関係'),text)
  assert.throws(()=>validateBookQuestion('短い','仕事'))
  assert.throws(()=>validateBookQuestion(text,'invalid'))
  assert.throws(()=>validateBookQuestion('字'.repeat(401),'仕事'))
  const topics=['自殺','自傷','死にたい','消えたい','命を絶つ','生きていたくない','寿命','余命','死ぬ','亡くなる','妊娠','不妊','病気','診断','癌','がん','服薬','薬を','治療','訴訟','裁判','法律判断','投資','株価','銘柄','殺す','傷つける方法','監視','ストーキング','妊娠の判定']
  for(const topic of topics) assert.throws(()=>validateBookQuestion(topic+'について占いで判定してもらいたいと考えています。','その他'))
})
test('consumable rejects unverified product identity and other owners before DB access',async()=>{
  await assert.rejects(grantVerifiedBookPurchase({productId:'wrong'}))
  await assert.rejects(grantVerifiedBookPurchase({productId:'com.onsai.fatelab.report.single',type:'Consumable' as never,appAccountToken:'11111111-1111-4111-8111-111111111111'},'22222222-2222-4222-8222-222222222222'))
})

test('legacy text and AI-generated sources are not promoted to confirmed materials',()=>{
 assert.deepEqual(bookSources({report_text:'old content'},'仕事'),[])
 assert.deepEqual(bookSources({calculated_data:{_structuredReport:{version:3,reportText:'',cards:[],generator:'ai',generatorVersion:'old'}}},'仕事'),[])
})

test('short otherwise valid documents cannot consume a delivered 5000-character book',()=>{
 const d=valid(); d.answer=text.repeat(4); d.sections.forEach(s=>s.body=text.repeat(2));
 assert.throws(()=>validateBookDocument(d,sources),/BOOK_DOCUMENT_LENGTH/)
})
