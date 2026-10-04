import {Router,type Response,type NextFunction,type RequestHandler} from 'express'
import {requireAuth,type AuthRequest} from '../middleware/auth.js'
import {getSupabaseUser} from '../lib/supabaseUser.js'
import {birthInput,parseEvents,loadTimelineContext,sameBirth} from '../lib/timelineContext.js'
import {parseRelationshipStatus} from '../lib/report/timelineV3/index.js'
import {readLifeEvents} from '../lib/report/timelineV3/events.js'
import {japanDateParts} from '../lib/japanDate.js'

// Express 4 does not forward rejected promises to the error middleware.
const handled=(fn:(req:AuthRequest,res:Response)=>Promise<unknown>):RequestHandler => (req,res,next:NextFunction)=>{Promise.resolve(fn(req,res)).catch(next)}
export const timelineRouter=Router()
timelineRouter.use(requireAuth)
timelineRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next()})
timelineRouter.get('/profile',handled(async(req:AuthRequest,res)=>{
 const {data,error}=await getSupabaseUser(req.accessToken!).from('timeline_profiles').select('birth_data,relationship_status').eq('user_id',req.userId!).maybeSingle()
 if(error){res.status(503).json({error:'プロフィールを取得できませんでした'});return}
 res.json({profile:data?{...data.birth_data,relationshipStatus:data.relationship_status}:null})
}))
timelineRouter.put('/profile',handled(async(req:AuthRequest,res)=>{
 const input=birthInput(req.body)
 const date=input.birthDate??'',time=input.birthTime??''
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})||date<'1900-01-01'||(input.birthplace?.length??0)>100||(input.gender!=null&&!['male','female','other',''].includes(input.gender))||(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))|| (req.body?.relationshipStatus!=null&&!parseRelationshipStatus(req.body?.relationshipStatus))){res.status(400).json({error:'プロフィールの入力を確認してください'});return}
 const db=getSupabaseUser(req.accessToken!)
 const previous=await db.from('timeline_profiles').select('birth_data').eq('user_id',req.userId!).maybeSingle()
 if(previous.error){res.status(503).json({error:'プロフィールを確認できませんでした'});return}
 if(previous.data&&!sameBirth(previous.data.birth_data,input)){
   const check=await db.from('life_events').select('id',{count:'exact',head:true}).eq('user_id',req.userId!)
   if(check.error){res.status(503).json({error:'年表を確認できませんでした'});return}
   if(check.count){res.status(409).json({error:'年表が登録されています。別の出生情報に変更する前に、年表を削除してください。'});return}
 }
 const {error}=await db.from('timeline_profiles').upsert({user_id:req.userId!,birth_data:input,relationship_status:input.relationshipStatus??null,updated_at:new Date().toISOString()})
 if(error){res.status(503).json({error:'プロフィールを保存できませんでした'});return}
 res.json({profile:input})
}))
timelineRouter.get('/events',handled(async(req:AuthRequest,res)=>{
 const {data,error}=await getSupabaseUser(req.accessToken!).from('life_events').select('year,month,kind').eq('user_id',req.userId!).order('year')
 if(error){res.status(503).json({error:'年表を取得できませんでした'});return}
 res.json({events:data??[]})
}))
async function eventRequest(req:AuthRequest,res:import('express').Response,save:boolean){
 try {
  const db=getSupabaseUser(req.accessToken!)
  const {data,error}=await db.from('timeline_profiles').select('birth_data,relationship_status').eq('user_id',req.userId!).maybeSingle()
  if(error)throw new Error('PROFILE_UNAVAILABLE')
  if(!data){res.status(422).json({error:'プロフィールを保存してから年表を登録してください'});return}
  const input={...birthInput(data.birth_data),relationshipStatus:parseRelationshipStatus(data.relationship_status)}
  const events=parseEvents(req.body?.events,Number(input.birthDate!.slice(0,4)))
  if(save){const {error}=await db.rpc('replace_life_events',{p_events:events});if(error)throw new Error('SAVE_UNAVAILABLE');res.json({events});return}
  const context=await loadTimelineContext(req.accessToken!,req.userId!,input)
  res.json({readings:readLifeEvents({...input,...context},events,japanDateParts().year)})
 }catch(error){const invalid=error instanceof Error&&error.message==='INVALID_EVENTS';res.status(invalid?400:503).json({error:invalid?'出来事の種類・年・月を確認してください':'年表を確認できませんでした。時間をおいて再試行してください'})}
}
timelineRouter.post('/events',(req,res)=>eventRequest(req,res,true))
timelineRouter.post('/events/read',(req,res)=>eventRequest(req,res,false))
timelineRouter.get('/consent',handled(async(req:AuthRequest,res)=>{
 const {data,error}=await getSupabaseUser(req.accessToken!).from('validation_consents').select('consented_at,withdrawn_at').eq('user_id',req.userId!).maybeSingle()
 if(error){res.status(503).json({error:'同意設定を確認できませんでした'});return}
 res.json({consented:!!data?.consented_at&&!data?.withdrawn_at})
}))
timelineRouter.put('/consent',handled(async(req:AuthRequest,res)=>{
 if(typeof req.body?.consented!=='boolean'){res.status(400).json({error:'設定を確認してください'});return}
 const now=new Date().toISOString(),yes=req.body.consented
 const {error}=await getSupabaseUser(req.accessToken!).from('validation_consents').upsert({user_id:req.userId!,consented_at:yes?now:null,withdrawn_at:yes?null:now,policy_version:'timeline-v1'})
 if(error){res.status(503).json({error:'同意設定を保存できませんでした'});return}
 res.json({consented:yes})
}))

timelineRouter.get('/events/for-reading/:id',handled(async(req:AuthRequest,res)=>{
 try {
  const db=getSupabaseUser(req.accessToken!)
  const {data,error}=await db.from('reading_conversations').select('birth_data,kind').eq('id',req.params.id).eq('user_id',req.userId!).maybeSingle()
  if(error)throw error
  if(!data){res.status(404).json({error:'鑑定書が見つかりません'});return}
  if(data.kind!=='self'){res.status(422).json({error:'あなたの鑑定書から開いてください'});return}
  const context=await loadTimelineContext(req.accessToken!,req.userId!,data.birth_data)
  res.json({readings:readLifeEvents({...birthInput(data.birth_data),...context},context.lifeEvents,japanDateParts().year)})
 }catch {res.status(503).json({error:'年表の読み解きを取得できませんでした'})}
}))
