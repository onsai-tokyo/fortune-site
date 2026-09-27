import {meetingIntroduction} from './meeting.js'
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
  const input={birthDate,birthTime:normalizedTime as string|null|undefined};birthMaterials(input);return input
}
export function coupleSnapshot(value:unknown,partnerId:string|null) {
  if(!value||typeof value!=='object')throw new Error('BIRTH_UNAVAILABLE')
  const v=value as Record<string,unknown>,a=birth(v.self),b=birth(v.partner)
  // Stored births identify the pair; display direction and meeting year do not.
  const births=[a,b].map(x=>[x.birthDate,x.birthTime||''].join('|')).sort()
  const relationshipKey=createHash('sha256').update(JSON.stringify([partnerId,births])).digest('hex')
  return {a,b,relationshipType:v.relationshipType,relationshipKey,minMeetingYear:Math.max(Number(a.birthDate.slice(0,4)),Number(b.birthDate.slice(0,4)))}
}
export function validateMeetingYear(value:unknown,minYear:number,referenceYear=japanDateParts().year):number|null {
  if(value===null)return null
  if(typeof value!=='number'||!Number.isInteger(value)||value<Math.max(1000,minYear)||value>referenceYear)throw new Error('INVALID_MEETING_YEAR')
  return value
}
export function snapshotTimeline(snapshot:ReturnType<typeof coupleSnapshot>,meetingYear:number|null) {
  const result=buildFromBirths(snapshot.a,snapshot.b,meetingYear)
  return {...result,minMeetingYear:snapshot.minMeetingYear,entries:result.entries.map(({reading,...entry})=>{
    if(entry.year!==meetingYear || !reading || !entry.card)return entry
    const intro=meetingIntroduction(reading,snapshot.relationshipType)
    return {...entry,card:{...entry.card,title:`出会いの年 — ${entry.card.title}`,
      pages:[{role:'core',label:'出会いのきっかけ',text:intro},...entry.card.pages],
      sections:[{heading:'出会いのきっかけ',body:intro,evidence:[],termGloss:[]},...(entry.card.sections??[])],
      metadataRefs:[...(entry.card.metadataRefs??[]),'meeting-editorial-1.1']}}
  })}
}
