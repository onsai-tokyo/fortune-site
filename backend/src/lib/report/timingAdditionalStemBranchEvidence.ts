import { calcShichu } from '../divination/index.js'
import type { TimingScoreKey } from './timingClaim.js'
import type { TimingEvidenceDefinition } from './timingScoreEngine.js'

interface AnnualInput { year: number; kanshi: string; tenGod: string }
interface DecadeInput { startYear: number; endYear: number }
export interface AdditionalStemBranchInput {
  birthYear: number; birthMonth: number; birthDay: number
  birthHour?: number; birthMinute?: number
  gender: 'male' | 'female'
  annual: readonly AnnualInput[]
  decades: readonly DecadeInput[]
}

const CLASH: Readonly<Record<string, string>> = {
  子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
}
const COMBINE: Readonly<Record<string, string>> = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
}
const BREAK: Readonly<Record<string, string>> = {
  子: '酉', 酉: '子', 丑: '辰', 辰: '丑', 寅: '亥', 亥: '寅', 卯: '午', 午: '卯', 巳: '申', 申: '巳', 未: '戌', 戌: '未',
}
const HARM: Readonly<Record<string, string>> = {
  子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉',
}
const PEACH: Readonly<Record<string, string>> = {
  申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 亥: '子', 卯: '子', 未: '子', 巳: '午', 酉: '午', 丑: '午',
}

const branch = (kanshi: string) => [...kanshi].at(-1) ?? ''

function item(
  id: string, year: number, scoreKey: TimingScoreKey, factLineageId: string,
  maximumContribution: number, available: boolean, matched: boolean, detail: string,
): TimingEvidenceDefinition {
  return {
    id: `${id}:${year}`, scoreKey, sourceFamily: 'stem_branch', technique: factLineageId.split(':')[1]!,
    factLineageId, correlationGroup: 'stem_branch_calendar', available,
    matched: available && matched, support: available && matched ? 1 : 0,
    maximumContribution, polarity: 1, detail: `shadow provisional / ${detail}`,
  }
}

/**
 * 正本§18-24・§33および追加ルール§18-24から直接構造化できる干支系Evidence。
 * ウェイトは分布校正前の仮値。本番接続は禁止。
 */
export function buildAdditionalStemBranchEvidence(input: AdditionalStemBranchInput): ReadonlyMap<number, readonly TimingEvidenceDefinition[]> {
  const natal = calcShichu(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0)
  const endpoints = input.birthHour === undefined
    ? [calcShichu(input.birthYear, input.birthMonth, input.birthDay, 0, 0), calcShichu(input.birthYear, input.birthMonth, input.birthDay, 23, 59)]
    : [natal]
  const dayAvailable = endpoints.every(value => value.day.kanshi === natal.day.kanshi)
  const monthAvailable = endpoints.every(value => value.month.kanshi === natal.month.kanshi)
  const yearAvailable = endpoints.every(value => value.year.kanshi === natal.year.kanshi)
  const luckAvailable = input.birthHour !== undefined
  const transitions = new Set(input.decades.flatMap(period => [period.startYear - 1, period.startYear, period.startYear + 1]))
  const spouseGods = new Set(input.gender === 'male' ? ['偏財', '正財'] : ['偏官', '正官'])

  return new Map(input.annual.map(annual => {
    const annualBranch = branch(annual.kanshi)
    const dayClash = CLASH[natal.day.branch] === annualBranch
    const dayBreak = BREAK[natal.day.branch] === annualBranch
    const dayHarm = HARM[natal.day.branch] === annualBranch
    const dayCombine = COMBINE[natal.day.branch] === annualBranch
    const monthClash = CLASH[natal.month.branch] === annualBranch
    const yearClash = CLASH[natal.year.branch] === annualBranch
    const transition = transitions.has(annual.year)
    const spouse = spouseGods.has(annual.tenGod)
    const wealth = annual.tenGod === '偏財' || annual.tenGod === '正財'
    const official = annual.tenGod === '偏官' || annual.tenGod === '正官'
    const education = annual.tenGod === '偏印' || annual.tenGod === '正印'
    const peach = PEACH[natal.day.branch] === annualBranch
    const detail = `流年${annual.kanshi}(${annual.tenGod}) / 年${natal.year.kanshi} 月${natal.month.kanshi} 日${natal.day.kanshi}`
    return [annual.year, [
      item('additional-rel-activation-spouse', annual.year, 'relationship_activation', 'stem_branch:annual_pillar:ten_god:spouse_star', .14, dayAvailable, spouse, detail),
      item('additional-rel-activation-combine', annual.year, 'relationship_activation', 'stem_branch:annual_pillar:day_branch:combine', .14, dayAvailable, dayCombine, detail),
      item('additional-rel-activation-peach', annual.year, 'relationship_activation', 'stem_branch:annual_pillar:day_branch:peach_blossom', .08, dayAvailable, peach, detail),
      item('additional-rel-binding', annual.year, 'relationship_binding', 'stem_branch:annual_pillar:day_branch:combine', .16, dayAvailable, dayCombine && spouse, detail),
      item('additional-rel-secrecy-harm', annual.year, 'relationship_secrecy', 'stem_branch:annual_pillar:day_branch:harm', .16, dayAvailable, dayHarm, detail),
      item('additional-rel-secrecy-break', annual.year, 'relationship_secrecy', 'stem_branch:annual_pillar:day_branch:break', .12, dayAvailable, dayBreak, detail),
      item('additional-marriage', annual.year, 'marriage_legalization', 'stem_branch:annual_pillar:day_branch:combine_official', .18, dayAvailable, dayCombine && spouse, detail),
      item('additional-career-change-month', annual.year, 'career_change', 'stem_branch:annual_pillar:month_branch:clash', .20, monthAvailable, monthClash, detail),
      item('additional-career-change-luck', annual.year, 'career_change', 'stem_branch:major_luck_cycle:transition', .18, luckAvailable, transition, detail),
      item('additional-money', annual.year, 'money_status', 'stem_branch:annual_pillar:ten_god:wealth_star', .24, yearAvailable, wealth, detail),
      item('additional-home', annual.year, 'home_family', 'stem_branch:annual_pillar:year_branch:clash', .20, yearAvailable, yearClash, detail),
      item('additional-relocation-year', annual.year, 'relocation', 'stem_branch:annual_pillar:year_branch:clash', .12, yearAvailable, yearClash, detail),
      item('additional-relocation-month', annual.year, 'relocation', 'stem_branch:annual_pillar:month_branch:clash', .12, monthAvailable, monthClash, detail),
      item('additional-education-active', annual.year, 'education_activation', 'stem_branch:annual_pillar:ten_god:resource_star', .24, yearAvailable, education, detail),
      item('additional-education-disrupt-month', annual.year, 'education_disruption', 'stem_branch:annual_pillar:month_branch:clash', .12, monthAvailable, monthClash, detail),
      item('additional-education-disrupt-year', annual.year, 'education_disruption', 'stem_branch:annual_pillar:year_branch:clash', .12, yearAvailable, yearClash, detail),
      item('additional-identity-luck', annual.year, 'identity_reset', 'stem_branch:major_luck_cycle:transition', .18, luckAvailable, transition, detail),
      item('additional-identity-year', annual.year, 'identity_reset', 'stem_branch:annual_pillar:year_branch:clash', .12, yearAvailable, yearClash, detail),
      item('additional-network', annual.year, 'social_network_change', 'stem_branch:annual_pillar:month_branch:clash', .20, monthAvailable, monthClash, detail),
      item('additional-responsibility', annual.year, 'responsibility', 'stem_branch:annual_pillar:ten_god:official_star', .24, yearAvailable, official, detail),
      item('additional-stress-day', annual.year, 'emotional_stress', 'stem_branch:annual_pillar:day_branch:disruption', .14, dayAvailable, dayClash || dayBreak || dayHarm, detail),
      item('additional-stress-compound', annual.year, 'emotional_stress', 'stem_branch:annual_pillar:multiple_pillars:clash', .10, dayAvailable && (monthAvailable || yearAvailable), dayClash && (monthClash || yearClash), detail),
    ]] as const
  }))
}

