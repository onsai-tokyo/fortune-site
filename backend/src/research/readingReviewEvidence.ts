import type { ReportInput } from '../lib/deterministicReport.js'
import type { ReportFactV2 } from '../lib/report/factsV2.js'
import type { ReportFindingV2 } from '../lib/report/findingsV2.js'
import { buildClaimStructuredReport, type ClaimAuditRow } from '../lib/report/claimComposer.js'
import { CLAIM_ASSETS, CLAIM_ASSET_VERSION } from '../lib/report/claimAssets.js'
import type { ClaimTrigger } from '../lib/report/claim.js'

export interface ReviewFactTrace {
  id:string; system:string; factor:string; label:string; signal:string
  canonicalSourceId:string; lineage:string
}
export interface ReviewClaimTrace {
  version:'claim-selection-trace-v1'; claimID:string; assetVersion:string
  trigger:ClaimTrigger; findingID:string; findingKey:string; findingKind:string
  primary:ReviewFactTrace[]; supporting:ReviewFactTrace[]; scoreOnly:ReviewFactTrace[]
  scoreKey:string; scoreFactIDs:string[]; selection:ClaimAuditRow
  statisticalValidation:'not_estimated'; interpretationStatus:'editorial_hypothesis'
}

export function readableFact(factor:string):string {
  const pillar=factor.match(/^pillar:(\d+):tenGod:(\d+):(.+)$/)
  if(pillar)return `${['年柱','月柱','日柱','時柱'][Number(pillar[1])]??'柱'}・${Number(pillar[2])===0?'天干':`蔵干${pillar[2]}`}の${pillar[3]}`
  const chart=factor.match(/^bodyChart:([^:]+):(.+)$/)
  if(chart)return `人体星図・${({south:'南',north:'北',east:'東',west:'西',center:'中央'} as Record<string,string>)[chart[1]]??chart[1]}の${chart[2]}`
  const modality=factor.match(/^modalityDominant:([^:]+):(\d+)$/)
  if(modality)return `${({cardinal:'活動宮',fixed:'不動宮',mutable:'柔軟宮'} as Record<string,string>)[modality[1]]??modality[1]}が最多（計算対象${modality[2]}）`
  const element=factor.match(/^elementDominant:([^:]+):(\d+)$/)
  if(element)return `${({fire:'火',earth:'地',air:'風',water:'水'} as Record<string,string>)[element[1]]??element[1]}の要素が最多（計算対象${element[2]}）`
  const house=factor.match(/^house:(\d+):(.+)$/)
  return house?`${house[2]}が第${house[1]}室`:factor
}

/** Capture the actual selector execution; do not infer causes from prose overlap. */
export function traceReviewClaims(input:ReportInput,facts:ReportFactV2[],findings:ReportFindingV2[]):Map<string,ReviewClaimTrace> {
  let rows:readonly ClaimAuditRow[]=[]
  buildClaimStructuredReport(facts,findings,input,value=>{rows=value})
  const byID=new Map(facts.map(f=>[f.id,f]))
  const explain=(ids:readonly string[]):ReviewFactTrace[]=>[...new Set(ids)].flatMap(id=>{
    const f=byID.get(id);return f?[{id:f.id,system:f.system,factor:f.factor,label:readableFact(f.factor),signal:f.signal,canonicalSourceId:f.canonicalSourceId,lineage:f.lineage}]:[]
  })
  return new Map(rows.filter(r=>r.reason==='selected').map(row=>{
    const asset=CLAIM_ASSETS.find(a=>a.id===row.claimId)!,finding=findings.find(f=>f.id===row.findingId)
    const triggerIDs=new Set([...row.primaryFactIds,...row.supportingFactIds])
    return [row.claimId,{version:'claim-selection-trace-v1',claimID:row.claimId,assetVersion:CLAIM_ASSET_VERSION,
      trigger:asset.trigger,findingID:row.findingId!,findingKey:finding?.key??asset.scoreKey,findingKind:finding?.kind??'derived-score',
      primary:explain(row.primaryFactIds),supporting:explain(row.supportingFactIds),scoreOnly:explain(row.scoreFactIds.filter(id=>!triggerIDs.has(id))),
      scoreKey:asset.scoreKey,scoreFactIDs:row.scoreFactIds,selection:row,statisticalValidation:'not_estimated',interpretationStatus:'editorial_hypothesis'}]
  }))
}
