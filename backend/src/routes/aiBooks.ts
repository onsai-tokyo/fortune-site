import { Router, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { BookError, BOOK_PRODUCT, bookRPC, bookSources, uuidPattern, validateBookQuestion } from '../lib/aiBooks.js'
export const aiBooksRouter = Router()
aiBooksRouter.use(requireAuth)
const projection = 'id,title,target_title,theme,question,state,created_at,delivered_at,document,source_snapshot'
export function publicBook(b: Record<string, unknown>) {
  return {id:b.id,title:b.title,targetTitle:b.target_title,theme:b.theme,question:b.question??'',state:b.state,createdAt:b.created_at,deliveredAt:b.delivered_at,
    document:b.state==='delivered'?(b.document??null):null,sources:b.state==='delivered'?(b.source_snapshot??[]):[]}
}
function fail(res: Response,error: unknown) {
  const e = error instanceof BookError ? error : new BookError('BOOK_UNAVAILABLE',503,'本棚を取得できませんでした。時間をおいてお試しください。')
  res.status(e.status).json({code:e.code,error:e.message})
}
async function settings() {
  const {data,error} = await getSupabaseAdmin().from('ai_book_settings').select('enabled,monthly_credits').eq('id',true).single()
  if (error) throw error
  return data
}
aiBooksRouter.get('/status',async(req:AuthRequest,res)=>{
  try {
    const config = await settings()
    if (!config.enabled) { res.json({enabled:false,monthlyCredits:config.monthly_credits,remaining:0,memberRemaining:0,purchasedRemaining:0,memberExpiresAt:null,productId:BOOK_PRODUCT}); return }
    await bookRPC('ai_book_sync_member',{p_user:req.userId!})
    const {data,error} = await getSupabaseAdmin().from('ai_book_grants').select('source,starts_at,expires_at,ai_book_credits(consumed_by,recovery_until)').eq('user_id',req.userId!).eq('revoked',false)
    if (error) throw error
    let memberRemaining=0,purchasedRemaining=0; let expiry:string|null=null
    for(const grant of data??[]) {
      if(Date.parse(grant.starts_at)>Date.now()) continue
      for(const credit of grant.ai_book_credits) {
        const end = grant.expires_at===null ? Infinity : Math.max(Date.parse(grant.expires_at),credit.recovery_until?Date.parse(credit.recovery_until):0)
        if(credit.consumed_by || end<=Date.now()) continue
        if(grant.source==='member') { memberRemaining++; if(!expiry || Date.parse(expiry)>end) expiry=new Date(end).toISOString() }
        else purchasedRemaining++
      }
    }
    res.json({enabled:true,monthlyCredits:config.monthly_credits,remaining:memberRemaining+purchasedRemaining,memberRemaining,purchasedRemaining,memberExpiresAt:expiry,productId:BOOK_PRODUCT})
  } catch(e) { fail(res,e) }
})
aiBooksRouter.get('/',async(req:AuthRequest,res)=>{
  try {
    const limit=60; const before=typeof req.query.before==='string'?req.query.before:null
    if(before && !uuidPattern.test(before)) throw new BookError('BOOK_INPUT',400,'ページ指定が正しくありません。')
    let query=getSupabaseAdmin().from('ai_books').select('id,title,target_title,theme,state,created_at,delivered_at').eq('user_id',req.userId!).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit+1)
    if(before) {
      const {data,error}=await getSupabaseAdmin().from('ai_books').select('id,created_at').eq('user_id',req.userId!).eq('id',before).single()
      if(error||!data) throw new BookError('BOOK_NOT_FOUND',404,'本が見つかりません。')
      query=query.or(`created_at.lt.${data.created_at},and(created_at.eq.${data.created_at},id.lt.${before})`)
    }
    const {data,error}=await query; if(error) throw error
    const rows=(data??[]).slice(0,limit)
    res.json({books:rows.map(publicBook),nextCursor:(data?.length??0)>limit?rows.at(-1)?.id:null})
  } catch(e) { fail(res,e) }
})
aiBooksRouter.post('/operations/:id/cancel-unsubmitted',async(req:AuthRequest,res)=>{
  try {
    if(!uuidPattern.test(req.params.id)) throw new BookError('BOOK_INPUT',400,'受付番号が正しくありません。')
    const id=await bookRPC('ai_book_cancel_unsubmitted',{p_user:req.userId!,p_operation:req.params.id})
    if(!id) {res.json({book:null});return}
    const {data,error}=await getSupabaseAdmin().from('ai_books').select(projection).eq('user_id',req.userId!).eq('id',id).single()
    if(error) throw error; res.json({book:publicBook(data)})
  } catch(e) { fail(res,e) }
})
aiBooksRouter.get('/operations/:id',async(req:AuthRequest,res)=>{
  try {
    if(!uuidPattern.test(req.params.id)) throw new BookError('BOOK_INPUT',400,'受付番号が正しくありません。')
    const {data,error}=await getSupabaseAdmin().from('ai_books').select(projection).eq('user_id',req.userId!).eq('operation_id',req.params.id).maybeSingle()
    if(error) throw error; res.json({book:data?publicBook(data):null})
  } catch(e) { fail(res,e) }
})
aiBooksRouter.get('/:id',async(req:AuthRequest,res)=>{
  try {
    if(!uuidPattern.test(req.params.id)) throw new BookError('BOOK_INPUT',400,'本の指定が正しくありません。')
    const {data,error}=await getSupabaseAdmin().from('ai_books').select(projection).eq('user_id',req.userId!).eq('id',req.params.id).maybeSingle()
    if(error) throw error; if(!data) throw new BookError('BOOK_NOT_FOUND',404,'本が見つかりません。')
    res.json({book:publicBook(data)})
  } catch(e) { fail(res,e) }
})
async function prepare(req:AuthRequest) {
  const question=validateBookQuestion(req.body?.question,req.body?.theme)
  if(!uuidPattern.test(req.body?.sourceId??'')) throw new BookError('BOOK_INPUT',422,'もとになる鑑定書を選んでください。')
  const {data,error}=await getSupabaseAdmin().from('reading_conversations').select('id,title,kind,report_text,calculated_data').eq('user_id',req.userId!).eq('id',req.body.sourceId).maybeSingle()
  if(error) throw error
  if(!data || data.kind==='chat') throw new BookError('BOOK_SOURCE',422,'保存済みの自己鑑定または相性鑑定を選んでください。')
  const sources=bookSources(data,req.body.theme)
  if(sources.length<3) throw new BookError('BOOK_SOURCE',422,'この鑑定書には必要な原稿が揃っていません。別の鑑定書を選んでください。')
  return {question,sources,row:data}
}
aiBooksRouter.post('/validate',async(req:AuthRequest,res)=>{
  try { if(!(await settings()).enabled) throw new BookError('BOOK_DISABLED',503,'AI鑑定書は準備中です。'); await prepare(req); res.json({valid:true}) } catch(e) {fail(res,e)}
})
aiBooksRouter.post('/',async(req:AuthRequest,res)=>{
  try {
    if(!uuidPattern.test(req.body?.operationId??'')) throw new BookError('BOOK_INPUT',422,'受付番号が必要です。')
    // Read retries before source lookup: source deletion must not strand an accepted order.
    const {data:old,error}=await getSupabaseAdmin().from('ai_books').select('id,title,target_title,theme,question,state,created_at,delivered_at,document,source_snapshot,source_id').eq('user_id',req.userId!).eq('operation_id',req.body.operationId).maybeSingle()
    if(error) throw error
    if(old) {
      if(old.source_id!==String(req.body.sourceId).toLowerCase() || old.theme!==req.body.theme || old.question!==String(req.body.question).trim()) throw new BookError('BOOK_OPERATION_CONFLICT',409,'受付済みの相談と内容が異なります。')
      res.json({book:publicBook(old)}); return
    }
    const {question,sources,row}=await prepare(req)
    await bookRPC('ai_book_sync_member',{p_user:req.userId!})
    const id=await bookRPC('ai_book_order',{p_user:req.userId!,p_operation:req.body.operationId,p_source:row.id,p_target:row.title,p_theme:req.body.theme,p_question:question,p_snapshot:sources})
    const result=await getSupabaseAdmin().from('ai_books').select(projection).eq('user_id',req.userId!).eq('id',id).single()
    if(result.error) throw result.error
    res.status(201).json({book:publicBook(result.data)})
  } catch(e) {fail(res,e)}
})
