import {createHash} from 'node:crypto'
import {Router} from 'express'
import {requireAuth,type AuthRequest} from '../middleware/auth.js'
import {getSupabaseAdmin} from '../lib/supabaseAdmin.js'
import {getSupabaseUser} from '../lib/supabaseUser.js'
import {coupleSnapshot,snapshotTimeline,validateMeetingYear} from '../lib/report/coupleAllYears/snapshot.js'
import {japanDateParts} from '../lib/japanDate.js'

export const coupleTimelineRouter=Router()
coupleTimelineRouter.route('/:id/couple-timeline').get(requireAuth,(req,res)=>handleCoupleTimeline(req,res)).patch(requireAuth,(req,res)=>handleCoupleTimeline(req,res))
coupleTimelineRouter.route('/couple-timeline-settings/:partnerId').get(requireAuth,(req,res)=>handleMeetingSettings(req,res)).patch(requireAuth,(req,res)=>handleMeetingSettings(req,res))
export async function handleMeetingSettings(req:AuthRequest,res:import('express').Response,deps={user:getSupabaseUser,admin:getSupabaseAdmin}) {
  res.setHeader('Cache-Control','private, no-store')
  const source=req.query.selfReadingId
  if((source!==undefined&&(typeof source!=='string'||!/^[0-9a-f-]{36}$/i.test(source)))||!/^[0-9a-f-]{36}$/i.test(String(req.params.partnerId))){res.status(400).json({error:'鑑定書と相手を選択してください'});return}
  try {
    const db=deps.admin()
    const [{data:self,error:se},{data:partner,error:pe}]=await Promise.all([
      source ? deps.user(req.accessToken!).from('reading_conversations').select('birth_data,kind').eq('id',source).eq('user_id',req.userId!).maybeSingle() : Promise.resolve({data:null,error:null}),
      db.from('partner_profiles').select('id,birth_date,birth_time').eq('id',req.params.partnerId).eq('user_id',req.userId!).maybeSingle(),
    ])
    if(se||pe)throw new Error('READ_UNAVAILABLE')
    if(!partner||(source&&(!self||!['self','personal'].includes(self.kind)))){res.status(404).json({error:'本人の鑑定書または相手が見つかりません'});return}
    const minMeetingYear=self ? coupleSnapshot({self:self.birth_data,partner},partner.id).minMeetingYear : Number(partner.birth_date.slice(0,4))
    const key={user_id:req.userId!,relationship_key:profileMeetingKey(partner.id)}
    let meetingYear:number|null=null
    if(req.method==='PATCH') {
      meetingYear=validateMeetingYear(req.body?.meetingYear,minMeetingYear)
      const {error}=await db.from('couple_timeline_settings').upsert({...key,partner_profile_id:partner.id,meeting_year:meetingYear,updated_at:new Date().toISOString()},{onConflict:'user_id,relationship_key'})
      if(error)throw new Error('SAVE_UNAVAILABLE')
    } else {
      const {data,error}=await db.from('couple_timeline_settings').select('meeting_year').match(key).maybeSingle()
      if(error)throw new Error('READ_UNAVAILABLE')
      meetingYear=data?.meeting_year??null
      if(!data&&self){
        const legacyKey=coupleSnapshot({self:self.birth_data,partner},partner.id).relationshipKey
        const legacy=await db.from('couple_timeline_settings').select('meeting_year').match({user_id:req.userId!,relationship_key:legacyKey}).maybeSingle()
        if(legacy.error)throw new Error('READ_UNAVAILABLE')
        meetingYear=legacy.data?.meeting_year??null
      }
    }
    res.json({meetingYear,minMeetingYear:minMeetingYear,referenceYear:japanDateParts().year})
  }catch(error){
    const invalid=error instanceof Error&&error.message==='INVALID_MEETING_YEAR'
    res.status(invalid?400:503).json({error:invalid?'出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください':'出会った年を確認・保存できませんでした。時間をおいて再試行してください'})
  }
}
export async function handleCoupleTimeline(req:AuthRequest,res:import('express').Response,deps={user:getSupabaseUser,admin:getSupabaseAdmin}) {
  res.setHeader('Cache-Control','private, no-store')
  if(!/^[0-9a-f-]{36}$/i.test(String(req.params.id))){res.status(400).json({error:'鑑定書IDが正しくありません'});return}
  try {
    const {data:conversation,error}=await deps.user(req.accessToken!).from('reading_conversations').select('birth_data,kind,partner_profile_id').eq('id',req.params.id).eq('user_id',req.userId!).maybeSingle()
    if(error)throw new Error('READ_UNAVAILABLE')
    if(!conversation){res.status(404).json({error:'鑑定書が見つかりません'});return}
    if(conversation.kind!=='compatibility'){res.status(422).json({error:'ふたりの鑑定書から開いてください'});return}
    const snapshot=coupleSnapshot(conversation.birth_data,conversation.partner_profile_id)
    const db=deps.admin(),key={user_id:req.userId!,relationship_key:snapshot.relationshipKey}
    let meetingYear:number|null
    if(req.method==='PATCH') {
      meetingYear=validateMeetingYear(req.body?.meetingYear,snapshot.minMeetingYear)
      // Validate the entire timeline before saving. A network retry sets the same value.
      const timeline=snapshotTimeline(snapshot,meetingYear)
      if(timeline.status!=='ready'&&timeline.status!=='partial'&&timeline.status!=='needs_meeting_year')throw new Error('BIRTH_UNAVAILABLE')
      const {error:saveError}=await db.from('couple_timeline_settings').upsert({...key,relationship_key:conversation.partner_profile_id?profileMeetingKey(conversation.partner_profile_id):key.relationship_key,partner_profile_id:conversation.partner_profile_id,meeting_year:meetingYear,updated_at:new Date().toISOString()},{onConflict:'user_id,relationship_key'})
      if(saveError)throw new Error('SAVE_UNAVAILABLE')
      res.json(timeline);return
    }
    const {data:settings,error:settingsError}=await db.from('couple_timeline_settings').select('meeting_year').match(key).maybeSingle()
    if(settingsError)throw new Error('READ_UNAVAILABLE')
    meetingYear=settings?.meeting_year??null
    if(conversation.partner_profile_id){
      const profile=await db.from('couple_timeline_settings').select('meeting_year').match({user_id:req.userId!,relationship_key:profileMeetingKey(conversation.partner_profile_id)}).maybeSingle()
      if(profile.error)throw new Error('READ_UNAVAILABLE')
      if(profile.data)meetingYear=profile.data.meeting_year??null
    }
    res.json(snapshotTimeline(snapshot,meetingYear))
  } catch(error) {
    const message=error instanceof Error?error.message:''
    if(message==='INVALID_MEETING_YEAR'){res.status(400).json({error:'出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください'});return}
    if(message==='BIRTH_UNAVAILABLE'){res.status(422).json({error:'この鑑定書の出生情報を確認できませんでした'});return}
    res.status(503).json({error:req.method==='PATCH'?'出会った年の保存結果を確認できませんでした。同じ年でもう一度保存してください':'時系列を取得できませんでした。時間をおいて再試行してください'})
  }
}

export function profileMeetingKey(partnerId:string){return createHash('sha256').update('partner-meeting-year|'+partnerId).digest('hex')}
