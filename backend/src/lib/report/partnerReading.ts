import { selfTimingHistoryFromBirthSnapshot } from './coupleTimingHistory.js'
import { calcShichu, calcNayin, calcSanmei, calcExpandedDivination, calcSanmeiRelations, calcTimingCycles, calcNumerologyProfile, calcKyuseiProfile, getSukuyo, calcHonmeiStar, calcLifePathNumber, KYUSEI_NAMES } from '../divination/index.js'
import { calcZiwei } from '../ziwei.js'
import { calcAstrology } from '../astrology.js'
import { calcAge } from '../age.js'
import { buildSelfReport, resolveSelfReportOptions } from './buildSelfReport.js'
import { extractReportMetadata } from './metadata.js'
import { buildChartSections } from './chartSections.js'

// Read the birth snapshot belonging to this saved relationship, not a later edited profile.
export function partnerReadingFromBirthSnapshot(snapshot: unknown) {
  const birth = (snapshot as {partner?: Record<string, unknown>})?.partner
  const birthDate = String(birth?.birthDate ?? birth?.birth_date ?? '')
  const birthTime = String(birth?.birthTime ?? birth?.birth_time ?? '')
  const birthplace = String(birth?.birthplace ?? '')
  const gender = String(birth?.gender ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || (gender!=='male' && gender!=='female') || (birthTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(birthTime))) throw new Error('PARTNER_BIRTH_MISSING')
  const [year,month,day] = birthDate.split('-').map(Number)
  const date = new Date(Date.UTC(year,month-1,day))
  if (year<1900 || date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day) throw new Error('PARTNER_BIRTH_INVALID')
  const [hour,minute] = birthTime ? birthTime.split(':').map(Number) : [undefined,0]
  const shichu = calcShichu(year,month,day,hour,minute)
  const sanmei = calcSanmei(shichu.day.stemIdx,shichu.day.branchIdx,shichu.month.branchIdx,shichu.jieDays)
  const input = {
    birthDate,birthTime,birthplace,gender,age:calcAge(birthDate)??0,
    shichuYear:shichu.year.kanshi,shichuMonth:shichu.month.kanshi,shichuDay:shichu.day.kanshi,shichuHour:shichu.hour?.kanshi??null,
    nayin:calcNayin(shichu.day.stemIdx,shichu.day.branchIdx),sanmeiStar:sanmei.shukumeiStar,chusatsu:sanmei.chusatsu,
    sukuyo:getSukuyo(year,month,day),lifePathNumber:calcLifePathNumber(birthDate),numerologyProfile:calcNumerologyProfile(year,month,day),
    honmeiName:KYUSEI_NAMES[calcHonmeiStar(year,month,day)],kyuseiProfile:calcKyuseiProfile(year,month,day,hour,minute),
    timing:calcTimingCycles(year,month,day,hour,minute,gender),sanmeiRelations:calcSanmeiRelations(shichu,sanmei.chusatsu),
    ziwei:calcZiwei(year,month,day,hour,gender,birthplace),astrology:calcAstrology(year,month,day,hour,minute,birthplace),...calcExpandedDivination(shichu),
  }
  const {report} = buildSelfReport(input,extractReportMetadata(input),resolveSelfReportOptions())
  const history = selfTimingHistoryFromBirthSnapshot(birth).cards
  const currentIds = new Set(report.cards.map(c=>c.id))
  return {...report,cards:[...report.cards,...history.filter(c=>!currentIds.has(c.id))],chartSections:buildChartSections(input)}
}
