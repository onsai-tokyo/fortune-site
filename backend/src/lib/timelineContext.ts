import {createHash} from 'node:crypto'
import {getSupabaseAdmin} from './supabaseAdmin.js'
import {getSupabaseUser} from './supabaseUser.js'
import {parseRelationshipStatus,type TimelineV3Input,type PartnerKind} from './report/timelineV3/index.js'
import {parseLifeEvent,type LifeEvent} from './report/timelineV3/events.js'
import {japanDateParts} from './japanDate.js'

export const timelineEnabled = () => process.env.ANNUAL_READING_ENGINE?.trim() === 'timeline3'
export function birthInput(raw: unknown): TimelineV3Input {
  const v=(raw && typeof raw==='object' ? raw : {}) as Record<string,unknown>
  const str=(a:string,b=a)=>typeof(v[a]??v[b])==='string'?String(v[a]??v[b]):undefined
  return {birthDate:str('birthDate','birth_date'),birthTime:str('birthTime','birth_time')?.replace(/^(\d{2}:\d{2}):00$/, '$1'),birthplace:str('birthplace'),birthTimeZone:str('birthTimeZone','birth_time_zone'),gender:str('gender'),workContext:str('workContext'),relationshipStatus:parseRelationshipStatus(v.relationshipStatus??v.relationship_status)}
}
export function sameBirth(a:unknown,b:unknown) {
  const x=birthInput(a),y=birthInput(b)
  return !!x.birthDate && x.birthDate===y.birthDate && (x.birthTime||'')===(y.birthTime||'') && (x.birthplace||'')===(y.birthplace||'') && (x.gender||'')===(y.gender||'') && (x.birthTimeZone||'Asia/Tokyo')===(y.birthTimeZone||'Asia/Tokyo')
}
export function parseEvents(raw:unknown,birthYear:number,nowYear=japanDateParts().year):LifeEvent[] {
  if(!Array.isArray(raw)||raw.length>100)throw new Error('INVALID_EVENTS')
  const events=raw.map(e=>{
    if(!e||typeof e!=='object'||Object.keys(e).some(k=>!['year','month','kind'].includes(k))||typeof e.year!=='number'||(e.month!=null&&typeof e.month!=='number'))throw new Error('INVALID_EVENTS')
    const parsed=parseLifeEvent(e,birthYear,nowYear);if(!parsed)throw new Error('INVALID_EVENTS');return parsed
  })
  return [...new Map(events.map(e=>[`${e.year}|${e.month??''}|${e.kind}`,e])).values()].sort((a,b)=>a.year-b.year||(a.month??0)-(b.month??0)||a.kind.localeCompare(b.kind))
}
const kinds:Record<string,PartnerKind>={'片思い':'crush','お付き合い中':'partnered','婚約中':'partnered','夫婦':'married','復縁希望':'former','元恋人':'former'}
export function choosePartner(rows:Array<{id:string;label:string;year:number;birth:unknown}>) {
  return rows.filter(r=>kinds[r.label]&&Number.isInteger(r.year)).sort((a,b)=>{
    const rank=(x:typeof a)=>['partnered','married'].includes(kinds[x.label])?0:1
    return rank(a)-rank(b)||b.year-a.year||a.id.localeCompare(b.id)
  }).map(r=>({partnerSince:r.year,partnerKind:kinds[r.label],partnerBirth:birthInput(r.birth)}))[0]
}
export async function loadTimelineContext(token:string,userID:string,snapshot:unknown,deps={user:getSupabaseUser,admin:getSupabaseAdmin}) {
  const db=deps.user(token)
  const [{data:profile,error:pe},{data:events,error:ee},{data:partners,error:pre},{data:settings,error:se},{data:conversations,error:ce}]=await Promise.all([
    db.from('timeline_profiles').select('birth_data,relationship_status').eq('user_id',userID).maybeSingle(),
    db.from('life_events').select('year,month,kind').eq('user_id',userID),
    deps.admin().from('partner_profiles').select('id,relationship_label').eq('user_id',userID),
    deps.admin().from('couple_timeline_settings').select('partner_profile_id,relationship_key,meeting_year,updated_at').eq('user_id',userID),
    db.from('reading_conversations').select('partner_profile_id,birth_data,created_at').eq('user_id',userID).eq('kind','compatibility').order('created_at',{ascending:false}),
  ])
  if(pe||ee||pre||se||ce)throw new Error('TIMELINE_CONTEXT_UNAVAILABLE')
  const matches=sameBirth(snapshot,profile?.birth_data)
  const lifeEvents=matches?parseEvents(events??[],Number(birthInput(snapshot).birthDate?.slice(0,4))):[]
  const candidates=(partners??[]).flatMap(p=>{
    const conversation=(conversations??[]).find(c=>c.partner_profile_id===p.id&&sameBirth(snapshot,c.birth_data?.self))
    const key=createHash('sha256').update('partner-meeting-year|'+p.id).digest('hex')
    const all=(settings??[]).filter(s=>s.partner_profile_id===p.id).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))
    const setting=all.find(s=>s.relationship_key===key)??all[0]
    return conversation&&typeof setting?.meeting_year==='number'?[{id:p.id,label:p.relationship_label,year:setting.meeting_year,birth:conversation.birth_data.partner}]:[]
  })
  return {lifeEvents,...choosePartner(candidates)}
}
