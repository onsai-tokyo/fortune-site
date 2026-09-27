import { createHash } from 'node:crypto'
import { calcShichu, getSukuyo } from '../../divination/index.js'
import { japanDateParts } from '../../japanDate.js'
import type { ReportCard } from '../../reportCards.js'
import { composeYear, identity } from './composer.js'

export const LAYOUT_VERSION = 'all-years-since-meeting-1.1'
export type TimelineInput = { meetingYear: unknown; birthYearA:number; birthYearB:number; referenceYear:number; endYear?:number }
export function timelineLayout({ meetingYear,birthYearA,birthYearB,referenceYear,endYear=referenceYear+19 }:TimelineInput) {
  const empty=(status:string)=>({status,years:[] as number[],collapsedYears:[] as number[],groups:[] as Array<{from:number;to:number;years:number[]}>,referenceYear,endYear,meetingYear:null as number|null,version:LAYOUT_VERSION})
  if(![birthYearA,birthYearB,referenceYear].every(Number.isInteger) || birthYearA<1 || birthYearB<1 || birthYearA>referenceYear || birthYearB>referenceYear || referenceYear>9999) return empty('invalid_context')
  if(meetingYear==null) return empty('needs_meeting_year')
  if(typeof meetingYear!=='number'||!Number.isInteger(meetingYear)||meetingYear<Math.max(1000,birthYearA,birthYearB)||meetingYear>referenceYear) return empty('invalid_meeting_year')
  if(!Number.isInteger(endYear)||endYear<referenceYear||endYear>9999) return empty('invalid_end_year')
  const years=Array.from({length:endYear-meetingYear+1},(_,i)=>meetingYear+i)
  const collapsedYears=years.filter(y=>y<referenceYear-5)
  const groups=[]
  for(let i=0;i<collapsedYears.length;i+=5) { const group=collapsedYears.slice(i,i+5); groups.push({from:group[0],to:group.at(-1)!,years:group}) }
  return {status:'ready',years,collapsedYears,groups,referenceYear,endYear,meetingYear,version:LAYOUT_VERSION}
}
export type BirthInput = {birthDate:string;birthTime?:string|null}
export function birthMaterials(input:BirthInput) {
  if(!input || typeof input.birthDate!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) throw new Error('生年月日を入力してください。')
  const [y,m,d]=input.birthDate.split('-').map(Number), date=new Date(Date.UTC(y,m-1,d))
  if(y<1900||y>2100||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d) throw new Error('実在する生年月日を入力してください。')
  const time=input.birthTime
  if(time!=null&&time!==''&&(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('出生時刻を正しく入力してください。')
  const [hour,minute]=time ? time.split(':').map(Number) : [undefined,0]
  return {birthYear:y,dayPillar:calcShichu(y,m,d,hour,minute).day.kanshi,mansion:getSukuyo(y,m,d)}
}
export function yearCard(reading:ReturnType<typeof composeYear>):ReportCard {
  const body=reading.paragraphs.join('\n\n')
  return {id:`couple-all-years-${reading.year}`,kind:'timing',scope:'couple',tab:'timing',title:reading.title,summary:'ふたりの時系列',tags:['ふたりの時系列'],period:{label:`${reading.year}年`},pages:[{role:'core',label:'ふたりの時系列',text:body}],sections:[{heading:'',body,evidence:[],termGloss:[]}],evidence:[],metadataRefs:[identity(),reading.bazi_key,reading.sukuyo_key],generator:'deterministic'}
}
export type YearEntry = { year:number; label:string|null; contentStatus:'ready'|'unsupported_year'|'calculation_error'; card:ReportCard|null; reading:ReturnType<typeof composeYear>|null }
export function buildAllYears(input:TimelineInput & {dayA:string;dayB:string;mansionA:string;mansionB:string}, compose=composeYear) {
  const layout=timelineLayout(input), entries:YearEntry[]=[]
  for(const year of layout.years) {
    const base={year,label:year===layout.meetingYear?'出会った年':null}
    if(year<1900||year>2100) { entries.push({...base,contentStatus:'unsupported_year',card:null,reading:null}); continue }
    try {
      const reading=compose(input.dayA,input.dayB,input.mansionA,input.mansionB,year,input.birthYearA,input.birthYearB)
      entries.push({...base,contentStatus:'ready',card:yearCard(reading),reading})
    } catch { entries.push({...base,contentStatus:'calculation_error',card:null,reading:null}) }
  }
  return {...layout,status:entries.some(e=>e.contentStatus!=='ready')?'partial':layout.status,entries,engineVersion:identity()}
}
export function buildFromBirths(a:BirthInput,b:BirthInput,meetingYear:unknown,referenceYear=japanDateParts().year,endYear?:number) {
  const ma=birthMaterials(a),mb=birthMaterials(b)
  return buildAllYears({meetingYear,referenceYear,endYear,birthYearA:ma.birthYear,birthYearB:mb.birthYear,dayA:ma.dayPillar,dayB:mb.dayPillar,mansionA:ma.mansion,mansionB:mb.mansion})
}
// Direction belongs in content identity; meeting year belongs only in layout identity.
export function cacheKeys(relationshipId:string,input:Parameters<typeof buildAllYears>[0]) {
  const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const content=digest([relationshipId,input.dayA,input.dayB,input.mansionA,input.mansionB,input.birthYearA,input.birthYearB,identity()])
  return {content,layout:digest([content,input.meetingYear,input.referenceYear,input.endYear??input.referenceYear+19,LAYOUT_VERSION])}
}
