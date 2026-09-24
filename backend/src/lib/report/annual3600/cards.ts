import type { ReportCard, StructuredReport } from '../../reportCards.js'
import { withCardProvenance, finalizeReportProvenance } from '../provenance.js'
import { annualReading, natalContext, type AnnualContext } from './engine.js'
import { ANNUAL3600_VERSION } from './version.js'
const display = (iso: string) => iso.replace('T',' ').replace('+09:00','')
export const ANNUAL_LABEL_NOTE = '候補ラベルは、出来事を振り返ったり考えたりするための目印です。発生や確率を示すものではありません。ラベルのない年にも、出会いや変化はあり得ます。'
export function annual3600Cards(input: AnnualContext, from: number, to: number): ReportCard[] {
  const context = natalContext(input)
  if (!context) {
    const body = '年間鑑定の対象は、1952〜2100年生まれ・日本標準時の出生情報です。生年月日と出生地を確認してください。対応外の出生情報については、年間本文と候補ラベルを表示していません。'
    return [withCardProvenance({id:'annual-unavailable',kind:'timing',scope:'self',tab:'timing',title:'年間鑑定の出生情報を確認してください',summary:body,tags:['時期'],period:null,pages:[{role:'opening',label:'出生情報について',text:body}],sections:[{heading:'出生情報について',body,evidence:[],termGloss:[]}],evidence:[],metadataRefs:[ANNUAL3600_VERSION]},'deterministic')]
  }
  const start = Math.max(1952,Number(input.birthDate!.slice(0,4)),from), end = Math.min(2100,to)
  return Array.from({length:Math.max(0,end-start+1)},(_,i) => {
    const r = annualReading(input,start+i,context)!, t = r.text
    const whole = new Set(r.labels.map(l => l.kind))
    const partial = r.segments.flatMap(s => s.labels.filter(l => l.state === 'candidate' && !whole.has(l.kind)).map(l => `${l.text}：${display(s.start)} 〜 ${display(s.endExclusive)}直前`))
    const missing = r.segments.some(s => s.labels.some(l => l.state === 'needs_personal_context'))
    const guide = [
      `対象期間：${display(r.start)} 〜 ${display(r.endExclusive)}直前（日本時間）。年の区切りは立春です。`,
      ...r.labels.map(l => `${l.text}：対象期間全体`), ...partial,
      ...(missing ? ['入力情報が足りない候補ラベルは保留しています。プロフィールの出生時刻と年間鑑定の設定を確認できます。'] : []),
      ANNUAL_LABEL_NOTE,
    ].join('\n\n')
    const sections = [
      {heading:'恋愛・人との関わり',body:t.relationship},
      {heading:'仕事・活動',body:t.career},
      {heading:'暮らし・自分の時間',body:t.life},
      {heading:'対象期間と候補ラベル',body:guide},
    ].map(s => ({...s,evidence:[],termGloss:[]}))
    return withCardProvenance({
      id:`turning-year-${r.year}`,kind:'timing',scope:'self',tab:'timing',title:t.title,summary:t.description,
      period:{label:`${r.year}年（立春から翌年の立春まで）`},
      tags:['時期',...r.labels.map(l=>l.text),...(partial.length ? ['期間限定の候補あり'] : [])],
      sections,pages:[{role:'opening',label:'この年の流れ',text:t.description},...sections.map(s=>({role:'core' as const,label:s.heading,text:s.body}))],
      annualCalculation:{version:ANNUAL3600_VERSION,patternId:t.pattern_id,sourcePatternId:t.source_pattern_id,segments:r.segments},
      evidence:[],metadataRefs:[ANNUAL3600_VERSION,t.pattern_id,t.source_pattern_id],
    },'deterministic')
  })
}
export function replaceAnnual3600(report: StructuredReport, input: AnnualContext, nowYear: number): StructuredReport {
  const cards = [...report.cards.filter(c=>c.kind !== 'timing'),...annual3600Cards(input,Math.max(nowYear-15,Number(input.birthDate?.slice(0,4) ?? nowYear)+18),nowYear+20)]
  return finalizeReportProvenance({...report,cards,reportText:cards.flatMap(c=>[`【${c.title}】`,c.summary,...(c.sections??[]).flatMap(s=>[s.heading,s.body])]).join('\n\n')},`self-report-v3|${ANNUAL3600_VERSION}`)
}
