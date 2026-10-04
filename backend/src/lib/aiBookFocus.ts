import {createHash} from 'node:crypto'
import {BookError} from './aiBooks.js'
import {getSupabaseAdmin} from './supabaseAdmin.js'
import {storedReportFromCalculatedData} from './report/storedReport.js'
import {refreshSavedTimelineCards} from './report/savedTimelineCards.js'
import {selfTimingHistoryFromBirthSnapshot} from './report/coupleTimingHistory.js'
import {coupleSnapshot,snapshotTimeline} from './report/coupleAllYears/snapshot.js'
import {loadTimelineContext,timelineEnabled} from './timelineContext.js'
import type {ReportCard} from './reportCards.js'

// Resolve the selected ID only from the authenticated owner's saved inputs.
// No client-provided prose or calculation is promoted to a confirmed source.
export async function resolveBookFocus(row: {kind?:string;calculated_data?:unknown;birth_data?:any;partner_profile_id?:string|null}, id:unknown, token:string, userID:string):Promise<ReportCard|undefined> {
  if(id===undefined)return undefined
  if(typeof id!=='string'||!id.length||id.length>200)throw new BookError('BOOK_FOCUS',422,'相談のもとになる鑑定を開き直してください。')
  const report=storedReportFromCalculatedData(row.calculated_data)
  if(!report||report.generator!=='deterministic')throw new BookError('BOOK_FOCUS',422,'鑑定を開き直してください。')
  const scope=row.kind==='compatibility'?'couple':'self'
  const original=report.cards.find(c=>c.id===id && c.kind!=='timing' && c.kind!=='chart' && c.tab!=='chart' && (!c.scope||c.scope===scope) && c.generator!=='ai')
  if(original)return original
  if(scope==='self') {
    const context=timelineEnabled()?await loadTimelineContext(token,userID,row.birth_data):{}
    const current=refreshSavedTimelineCards(report.cards,row.birth_data,scope,context)
    const found=current.find(c=>c.id===id && c.kind==='timing' && (!c.scope||c.scope===scope) && c.generator!=='ai')
    if(found)return found
    const history=selfTimingHistoryFromBirthSnapshot({...row.birth_data,...context})
    const historical=history.cards.find(c=>c.id===id)
    if(historical)return historical
  } else {
    const snapshot=coupleSnapshot(row.birth_data,row.partner_profile_id??null)
    const db=getSupabaseAdmin()
    const keys=[snapshot.relationshipKey]
    if(row.partner_profile_id)keys.unshift(createHash('sha256').update('partner-meeting-year|'+row.partner_profile_id).digest('hex'))
    const {data,error}=await db.from('couple_timeline_settings').select('relationship_key,meeting_year').eq('user_id',userID).in('relationship_key',keys)
    if(error)throw error
    const settings=keys.map(key=>data?.find(s=>s.relationship_key===key)).find(Boolean)
    const context=process.env.COUPLE_TIMELINE_ENGINE?.trim()==='v3'?await loadTimelineContext(token,userID,snapshot.a):{lifeEvents:[]}
    const history=snapshotTimeline(snapshot,settings?.meeting_year??null,context.lifeEvents)
    const found=history.entries.find(e=>e.card?.id===id)?.card
    if(found)return found
    // Legacy saved timing cards may still be visible before meeting information is entered.
    const saved=report.cards.find(c=>c.id===id && c.kind==='timing' && (!c.scope||c.scope===scope) && c.generator!=='ai')
    if(saved)return saved
  }
  throw new BookError('BOOK_FOCUS',422,'選んだ鑑定を確認できませんでした。元の鑑定を開き直してからお試しください。')
}
