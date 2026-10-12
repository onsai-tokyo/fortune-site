import {Router} from 'express'
import {requireAuth,type AuthRequest} from '../middleware/auth.js'
import {getSupabaseAdmin} from '../lib/supabaseAdmin.js'
const events=new Set(['timeline_viewed','book_create_tapped','paywall_viewed'])
export function clientProductEvent(body:any,user:string) {
 if(!body || !events.has(body.event) || typeof body.id!=='string' || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(body.id))throw new Error('EVENT_INPUT')
 const properties:Record<string,string>={}
 if(['self','couple','book','membership'].includes(body.surface))properties.surface=body.surface
 if(typeof body.build==='string' && /^\d{1,6}$/.test(body.build))properties.build=body.build
 return {user_id:user,event:body.event,event_key:`client:${user}:${body.id.toLowerCase()}`,origin:'client',properties}
}
export const productEventsRouter=Router()
productEventsRouter.use(requireAuth)
productEventsRouter.post('/',async(req:AuthRequest,res)=>{
 let event
 try {event=clientProductEvent(req.body,req.userId!)} catch {res.status(422).json({code:'EVENT_INPUT'});return}
 try {
  const db=getSupabaseAdmin()
  const config=await db.from('ai_book_settings').select('*').eq('id',true).single()
  if(config.error)throw config.error
  const {error}=await db.from('product_events').upsert({...event,properties:{...event.properties,trialEnabled:config.data.trial_enabled===true}},{onConflict:'event_key',ignoreDuplicates:true})
  if(error)throw error
  res.sendStatus(204)
 } catch {res.status(503).json({code:'EVENT_UNAVAILABLE'})}
})
