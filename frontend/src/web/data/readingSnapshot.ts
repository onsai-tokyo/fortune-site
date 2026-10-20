import type { YearReading, Chapter, Partner, CoupleYear, ReadingSection } from './types'
export type SnapshotPayload = { key: string; kind: 'you'|'couple'; title: string; label: string; sections: ReadingSection[] }
export type ReadingSnapshot = { id: string; source_id: string|null; partner_id: string|null; created_at: string; payload: SnapshotPayload }
export function snapshotForReading(key: string, state: {
  selfSourceId?: string; years: YearReading[]; chapters: Chapter[]; partners: Partner[]; coupleYears: Record<string,CoupleYear[]>
}): {sourceId: string; partnerId: string|null; payload: SnapshotPayload}|null {
  if (!state.selfSourceId) return null
  const y = state.years.find(y => key === `you-${y.year}`)
  if(y) return {sourceId:state.selfSourceId,partnerId:null,payload:{key,kind:'you',title:`${y.year}年 ${y.title}`,label:'あなた・年ごとの流れ',sections:y.sections}}
  const c = state.chapters.find(c => key === `chapter-${c.id}`)
  if(c) return {sourceId:state.selfSourceId,partnerId:null,payload:{key,kind:'you',title:c.title,label:'あなた・性格の章',sections:c.sections??[]}}
  for(const p of state.partners) {
    const y=state.coupleYears[p.id]?.find(y=>key===`couple-${p.id}-${y.year}`)
    if(y)return {sourceId:state.selfSourceId,partnerId:p.id,payload:{key,kind:'couple',title:`${p.name}との${y.year}年 ${y.title}`,label:`ふたり・${p.name}`,sections:y.body.map(body=>({heading:'',body}))}}
  }
  return null
}
export function matchingSnapshot(rows: ReadingSnapshot[], input: ReturnType<typeof snapshotForReading>) {
  const signature=(p:SnapshotPayload)=>JSON.stringify([p.key,p.kind,p.title,p.label,p.sections.map(s=>[s.heading,s.body])])
  return input ? rows.find(r=>r.source_id===input.sourceId && r.partner_id===input.partnerId && signature(r.payload)===signature(input.payload)) : undefined
}
