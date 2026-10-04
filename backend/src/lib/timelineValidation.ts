import {birthInput,parseEvents} from './timelineContext.js'
import {toValidationRecord} from './report/timelineV3/events.js'

/** Export callers must supply consent rows read at export time, never cached consent. */
export function consentedValidationRecords(rows:Array<{birth:unknown;events:unknown;consent:{consented_at:string|null;withdrawn_at:string|null}|null}>) {
 return rows.flatMap(row=>{
  if(!row.consent?.consented_at||row.consent.withdrawn_at)return []
  const input=birthInput(row.birth)
  if(!input.birthDate)return []
  return [toValidationRecord(input,parseEvents(row.events,Number(input.birthDate.slice(0,4))))]
 })
}
