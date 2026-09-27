import type {composeYear} from './composer.js'
import {meetingEditorial} from './eventEditorial.js'
export function meetingIntroduction(reading:ReturnType<typeof composeYear>,_relationshipType:unknown):string {return meetingEditorial(reading.title_basis.considered).text}
