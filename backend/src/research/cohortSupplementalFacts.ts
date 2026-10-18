import { calcShichu, calcSanmei, calcNayin, calcKyuseiProfile, getSukuyo } from '../lib/divination/index.js'
import { assertTimingEvidenceBirthInput, type TimingEvidenceBirthInput } from '../lib/report/timingEvidencePipeline.js'
import { eventWindowDays, type EventStudyWindow } from './eventPatternStudy.js'
import type { EventFact } from './eventPatternRules.js'

/** Natal classifications are context, not evidence that an event happened in a year. */
export function cohortBirthContext(birth: TimingEvidenceBirthInput) {
  assertTimingEvidenceBirthInput(birth)
  const { birthYear:y, birthMonth:m, birthDay:d, birthHour:h, birthMinute:mm } = birth
  const chart = calcShichu(y,m,d,h,mm ?? 0)
  return {
    pillars: { year:chart.year.kanshi, month:chart.month.kanshi, day:chart.day.kanshi, time:chart.hour?.kanshi ?? null },
    sanmei:calcSanmei(chart.day.stemIdx,chart.day.branchIdx,chart.month.branchIdx,chart.jieDays),
    nayin:calcNayin(chart.day.stemIdx,chart.day.branchIdx), sukuyo:getSukuyo(y,m,d),
    kyusei:calcKyuseiProfile(y,m,d,h,mm ?? 0),
    timingInferenceForNatalClasses:false, independentlyVerified:false,
  }
}

/** Uses the existing day-cycle void-branch calculation and actual solar-term pillars. */
export function supplementalSanmeiFacts(birth: TimingEvidenceBirthInput, window: EventStudyWindow): EventFact[] {
  assertTimingEvidenceBirthInput(birth)
  const natal = calcShichu(birth.birthYear,birth.birthMonth,birth.birthDay,birth.birthHour,birth.birthMinute ?? 0)
  if (birth.birthHour === undefined && [0,23].some(h => calcShichu(birth.birthYear,birth.birthMonth,birth.birthDay,h,59).day.kanshi !== natal.day.kanshi)) return []
  const chusatsu = calcSanmei(natal.day.stemIdx,natal.day.branchIdx,natal.month.branchIdx,natal.jieDays).chusatsu
  const branches = chusatsu.slice(0,2).split('')
  const facts = new Map<string, EventFact>()
  for (const day of eventWindowDays(window)) {
    const [y,m,d] = day.split('-').map(Number), chart = calcShichu(y,m,d,12,0)
    for (const scope of ['year','month'] as const) if (branches.includes(chart[scope].branch)) {
      const id = `sanmei:${scope}:chusatsu`
      const old = facts.get(id)
      if (old) old.days.push(day)
      else facts.set(id, { id, lineage:`calendar:${scope}:void-branch`, kind:'calendar_relation',
        system:'四柱推命・算命学', group:'stem_branch_calendar', days:[day], themes:[],
        detail:`算命学：${scope === 'year' ? '年' : '月'}運の支が出生${chusatsu}の支に入る。結婚・離婚の結末は未判定。` })
    }
  }
  return [...facts.values()]
}
