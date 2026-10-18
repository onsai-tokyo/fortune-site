import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrivateLedger } from './ledger.js'
import { buildFixtureReportInput } from '../lib/report/fixtures.js'
import { buildSelfReport } from '../lib/report/buildSelfReport.js'
import { extractReportMetadata } from '../lib/report/metadata.js'
import { buildAnnualHistoryCards } from '../lib/report/timingCards.js'
import type { ReportCard, ReportSectionComponent } from '../lib/reportCards.js'
import type { ReportFactV2 } from '../lib/report/factsV2.js'
import type { ReportFindingV2 } from '../lib/report/findingsV2.js'
import { traceReviewClaims, type ReviewClaimTrace } from './readingReviewEvidence.js'

export const REVIEW_POLICY = { purpose:'developer-reading-review', discoveryOnly:true, trainingEligible:false, productionApproval:false } as const
export const VERDICTS = ['unreviewed','close','partial','wrong','unknown'] as const
export interface ReviewBirth { nickname:string; birthDate:string; birthTime?:string; birthplace:string; gender:'female'|'male' }
export interface ReviewTarget { id:string; cardID:string; heading:string; body:string; claimID?:string; sourceClaimIDs?:string[]; components?:ReportSectionComponent[]; evidence:ReportCard['evidence']; selectionTrace?:ReviewClaimTrace }
export interface FeedbackItem { targetID:string; verdict:typeof VERDICTS[number]; issue:'content'|'timing'|'vague'|'wording'; actual:string; period:string; observer:'self'|'friend'|'unknown'; certainty:'confirmed'|'approximate'|'unknown' }
export interface MissingEvent { id:string; period:string; domain:'love'|'work'|'home'|'study'|'other'; actual:string; observer:'self'|'friend'|'unknown'; certainty:'confirmed'|'approximate'|'unknown' }
export interface ReviewFeedback { items:FeedbackItem[]; events:MissingEvent[]; overall:string }
export interface ReviewRun {
  schemaVersion:1; id:string; caseID:string; createdAt:string; birth:ReviewBirth; referenceDate:string
  sourceHash:string; pipelineTag:string; contentHash:string; cards:ReportCard[]; targets:ReviewTarget[]
  policy:typeof REVIEW_POLICY; revision:number; feedback:ReviewFeedback
  history:Array<{revision:number;savedAt:string;feedback:ReviewFeedback}>
}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('入力形式が正しくありません');return v as Record<string,unknown>}
const text=(v:unknown,max=4000)=>{if(typeof v!=='string'||v.length>max)throw new Error('入力の長さ・形式を確認してください');return v.trim()}
const choice=<T extends string>(v:unknown,allowed:readonly T[]):T=>{if(!allowed.includes(v as T))throw new Error('選択内容が正しくありません');return v as T}
const uuid=(v:unknown)=>{const id=text(v,36);if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id))throw new Error('IDが正しくありません');return id}
export function validateBirth(value:unknown,today=new Date().toISOString().slice(0,10)):ReviewBirth {
  const v=object(value),birthDate=text(v.birthDate,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||birthDate<'1900-01-01'||birthDate>today||!Number.isFinite(Date.parse(birthDate))||new Date(birthDate).toISOString().slice(0,10)!==birthDate)throw new Error('生年月日を確認してください（1900年以降）')
  const raw=text(v.birthTime??'',5),match=raw.match(/^(\d{1,2}):(\d{1,2})$/)
  if(raw&&(!match||Number(match[1])>23||Number(match[2])>59))throw new Error('出生時刻を確認してください。不明な場合は空欄です')
  const nickname=text(v.nickname,40),birthplace=text(v.birthplace,40)
  if(!nickname||!birthplace)throw new Error('呼び名と出生地を入力してください')
  if(!/北海道|東京都|京都府|大阪府|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県/.test(birthplace))throw new Error('出生地は日本の都道府県名で入力してください')
  return {nickname,birthDate,birthTime:match?`${match[1].padStart(2,'0')}:${match[2].padStart(2,'0')}`:undefined,birthplace,gender:choice(v.gender,['female','male'])}
}
function period(v:unknown){
  const p=text(v,10);if(!p)return p
  if(!/^\d{4}(-\d{2})?(-\d{2})?$/.test(p))throw new Error('出来事の時期は年・年月・年月日で入力してください')
  const full=p.length===4?p+'-01-01':p.length===7?p+'-01':p
  if(!Number.isFinite(Date.parse(full))||new Date(full).toISOString().slice(0,10)!==full)throw new Error('出来事の日付を確認してください')
  return p
}
export function validateFeedback(value:unknown,targets:readonly ReviewTarget[]):ReviewFeedback {
  const v=object(value),ids=new Set(targets.map(t=>t.id)),seen=new Set<string>()
  if(!Array.isArray(v.items)||!Array.isArray(v.events)||v.items.length>targets.length||v.events.length>200)throw new Error('FB件数が正しくありません')
  const items=v.items.map(raw=>{
    const r=object(raw),targetID=text(r.targetID,250)
    if(!ids.has(targetID)||seen.has(targetID))throw new Error('別の鑑定へのFB、または重複したFBです')
    seen.add(targetID)
    return {targetID,verdict:choice(r.verdict,VERDICTS),issue:choice(r.issue,['content','timing','vague','wording'] as const),actual:text(r.actual),period:period(r.period),observer:choice(r.observer,['self','friend','unknown'] as const),certainty:choice(r.certainty,['confirmed','approximate','unknown'] as const)}
  })
  seen.clear()
  const events=v.events.map(raw=>{
    const r=object(raw),id=uuid(r.id);if(seen.has(id))throw new Error('出来事が重複しています');seen.add(id)
    return {id,period:period(r.period),domain:choice(r.domain,['love','work','home','study','other'] as const),actual:text(r.actual),observer:choice(r.observer,['self','friend','unknown'] as const),certainty:choice(r.certainty,['confirmed','approximate','unknown'] as const)}
  })
  return {items,events,overall:text(v.overall,8000)}
}
export function reviewTargets(cards:ReportCard[],traces:ReadonlyMap<string,ReviewClaimTrace>=new Map()):ReviewTarget[]{
  return cards.flatMap(c=>[
    // Essence lead text comes from its first claim, not all claims in the chapter.
    {id:`${c.id}/summary`,cardID:c.id,heading:c.title,body:c.summary,
      evidence:c.kind==='essence'&&c.sections?.length?c.sections[0].evidence:c.evidence,
      claimID:c.kind==='essence'?c.sections?.[0]?.claimId:undefined,
      selectionTrace:c.kind==='essence'?traces.get(c.sections?.[0]?.claimId??''):undefined},
    ...(c.sections??[]).map((s,i)=>({id:`${c.id}/section/${i}`,cardID:c.id,heading:s.heading,body:s.body,claimID:s.claimId,sourceClaimIDs:s.sourceClaimIds,components:s.components,evidence:s.evidence,selectionTrace:traces.get(s.claimId??'')})),
    ...(!c.sections?.length?c.pages.map((p,i)=>({id:`${c.id}/page/${i}`,cardID:c.id,heading:p.label,body:p.text,evidence:c.evidence})):[])
  ])
}
/** Snapshot the actual local deterministic generator, never observations or FB. */
export function generateReview(birth:ReviewBirth,caseID:string=randomUUID(),now=new Date()):ReviewRun {
  const input=buildFixtureReportInput({...birth,birthTime:birth.birthTime??null,id:caseID,group:'same-year'},now)
  const generated=buildSelfReport(input,extractReportMetadata(input,{nickname:birth.nickname}))
  const traces=generated.options.factPipeline==='v2'&&generated.options.narrativeEngine==='blocks'
    ?traceReviewClaims(input,generated.facts as ReportFactV2[],generated.findings as ReportFindingV2[]):new Map<string,ReviewClaimTrace>()
  const cards=[...generated.report.cards.filter(c=>c.kind==='essence'),...buildAnnualHistoryCards(input,Number(now.toISOString().slice(0,4)))]
  const sourceDir=resolve(dirname(fileURLToPath(import.meta.url)),'../lib')
  const sources=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sources(join(dir,e.name)):e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')?[join(dir,e.name)]:[])
  const sourceHash=hash([...sources(sourceDir).sort().map(p=>[p.slice(sourceDir.length),readFileSync(p,'utf8')]),readFileSync(resolve(sourceDir,'../../package-lock.json'),'utf8')])
  return {schemaVersion:1,id:randomUUID(),caseID,createdAt:now.toISOString(),referenceDate:now.toISOString().slice(0,10),birth,sourceHash,pipelineTag:generated.pipelineTag,contentHash:hash(cards),cards,targets:reviewTargets(cards,traces),policy:REVIEW_POLICY,revision:0,feedback:{items:[],events:[],overall:''},history:[]}
}
export class ReviewConflict extends Error {}
export class ReadingReviewStore {
  private ledger:PrivateLedger
  constructor(readonly root:string){this.ledger=new PrivateLedger(root)}
  list(){return readdirSync(this.ledger.root).filter(n=>/^review-[0-9a-f-]+\.json$/.test(n)).map(n=>this.ledger.read<ReviewRun>(n)!).map(r=>({id:r.id,caseID:r.caseID,birth:r.birth,createdAt:r.createdAt,lastSavedAt:r.history.at(-1)?.savedAt??r.createdAt,revision:r.revision,sourceHash:r.sourceHash,reviewed:r.feedback.items.filter(i=>i.verdict!=='unreviewed').length,events:r.feedback.events.filter(e=>e.actual).length})).sort((a,b)=>b.lastSavedAt.localeCompare(a.lastSavedAt)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id))}
  get(id:string){const r=this.ledger.read<ReviewRun>(`review-${uuid(id)}.json`);if(!r)throw new Error('鑑定が見つかりません');return r}
  create(birth:unknown,previousRunID?:string){
    const validated=validateBirth(birth),previous=previousRunID?this.get(previousRunID):undefined
    // The ledger canonicalizer expects JSON values, not JS undefined properties.
    // Preserve unknown time as an absent property throughout the stored snapshot.
    const run:ReviewRun=JSON.parse(JSON.stringify(generateReview(validated,previous?.caseID)))
    this.ledger.write(`review-${run.id}.json`,run);return run
  }
  save(id:string,revision:unknown,contentHash:unknown,value:unknown){
    const run=this.get(id)
    if(run.revision!==revision||run.contentHash!==contentHash)throw new ReviewConflict('別画面で更新されました。入力を書き出してから読み直してください')
    const feedback=validateFeedback(value,run.targets)
    if(hash(feedback)===hash(run.feedback))return run
    const updated={...run,revision:run.revision+1,feedback,history:[...run.history,{revision:run.revision+1,savedAt:new Date().toISOString(),feedback}]}
    this.ledger.write(`review-${run.id}.json`,updated);return updated
  }
}
