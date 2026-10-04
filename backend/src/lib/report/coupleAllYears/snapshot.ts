import { buildCoupleTimelineV3 } from '../timelineV3/couple.js'
import type { LifeEvent } from '../timelineV3/eventKinds.js'
import {createHash} from 'node:crypto'
import {birthMaterials,buildFromBirths,type BirthInput} from './timeline.js'
import {japanDateParts} from '../../japanDate.js'

function birth(value:unknown):BirthInput {
  if(!value||typeof value!=='object')throw new Error('BIRTH_UNAVAILABLE')
  const v=value as Record<string,unknown>
  const birthDate=v.birthDate??v.birth_date,birthTime=v.birthTime??v.birth_time
  if(typeof birthDate!=='string'||(birthTime!=null&&typeof birthTime!=='string'))throw new Error('BIRTH_UNAVAILABLE')
  // PostgreSQL TIME serializes minute-precision inputs with trailing :00.
  const normalizedTime=typeof birthTime==='string'&&/^\d{2}:\d{2}:00$/.test(birthTime)?birthTime.slice(0,5):birthTime
  const string=(key:string,legacy?:string)=>typeof(v[key]??(legacy?v[legacy]:undefined))==='string'?(v[key]??(legacy?v[legacy]:undefined)) as string:undefined
  const input={birthDate,birthTime:normalizedTime as string|null|undefined,birthplace:string('birthplace'),birthTimeZone:string('birthTimeZone','birth_time_zone'),gender:string('gender'),spouseConvention:string('spouseConvention'),annualYunConvention:string('annualYunConvention')};birthMaterials(input);return input
}
export function coupleSnapshot(value:unknown,partnerId:string|null) {
  if(!value||typeof value!=='object')throw new Error('BIRTH_UNAVAILABLE')
  const v=value as Record<string,unknown>,a=birth(v.self),b=birth(v.partner)
  // Stored births identify the pair; display direction and meeting year do not.
  const births=[a,b].map(x=>[x.birthDate,x.birthTime||''].join('|')).sort()
  const relationshipKey=createHash('sha256').update(JSON.stringify([partnerId,births])).digest('hex')
  return {a,b,relationshipType:v.relationshipType,relationshipLabel:v.relationshipLabel,relationshipKey,minMeetingYear:Math.max(Number(a.birthDate.slice(0,4)),Number(b.birthDate.slice(0,4)))}
}
export function validateMeetingYear(value:unknown,minYear:number,referenceYear=japanDateParts().year):number|null {
  if(value===null)return null
  if(typeof value!=='number'||!Number.isInteger(value)||value<Math.max(1000,minYear)||value>referenceYear)throw new Error('INVALID_MEETING_YEAR')
  return value
}
export function snapshotTimeline(snapshot:ReturnType<typeof coupleSnapshot>,meetingYear:number|null,lifeEvents:LifeEvent[] = []) {
  const relationshipType=typeof snapshot.relationshipType==='string'?snapshot.relationshipType:undefined
  const relationshipLabel=typeof snapshot.relationshipLabel==='string'?snapshot.relationshipLabel:undefined
  if(process.env.COUPLE_TIMELINE_ENGINE?.trim()==='v3') return {...buildCoupleTimelineV3({self:{...snapshot.a,birthTime:snapshot.a.birthTime??undefined,lifeEvents},partner:{...snapshot.b,birthTime:snapshot.b.birthTime??undefined},relationshipLabel,meetingYear,referenceYear:japanDateParts().year}),minMeetingYear:snapshot.minMeetingYear}
  const result=buildFromBirths(snapshot.a,snapshot.b,meetingYear,undefined,undefined,{relationshipType,relationshipLabel})
  const isFormer=relationshipLabel==='復縁希望'||relationshipLabel==='元恋人'
  return {...result,minMeetingYear:snapshot.minMeetingYear,
    relationshipContext:{label:relationshipLabel??null,source:'saved_reading_input',breakupYear:null,
      note:isFormer?'この鑑定に入力された関係は、別れた状態です。過去の壁タグは年ごとの材料から表示しています。別れた年や原因は入力されていません。':null},
    entries:result.entries.map(({reading,...entry})=>entry)}
}
