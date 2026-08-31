import { calcShichu } from '../divination/index.js'
import type { TimingScoreKey } from './timingClaim.js'
import type { TimingEvidenceDefinition } from './timingScoreEngine.js'

interface MonthlyInput { month: number; kanshi: string; tenGod: string }
interface AnnualInput { year: number; monthly: readonly MonthlyInput[] }
export interface MonthlyStemBranchInput {
  birthYear: number; birthMonth: number; birthDay: number
  birthHour?: number; birthMinute?: number
  gender: 'male' | 'female'
  annual: readonly AnnualInput[]
}

const CLASH: Readonly<Record<string, string>> = { 子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳' }
const COMBINE: Readonly<Record<string, string>> = { 子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午' }
const BREAK: Readonly<Record<string, string>> = { 子:'酉',酉:'子',丑:'辰',辰:'丑',寅:'亥',亥:'寅',卯:'午',午:'卯',巳:'申',申:'巳',未:'戌',戌:'未' }
const HARM: Readonly<Record<string, string>> = { 子:'未',未:'子',丑:'午',午:'丑',寅:'巳',巳:'寅',卯:'辰',辰:'卯',申:'亥',亥:'申',酉:'戌',戌:'酉' }
const PEACH: Readonly<Record<string, string>> = { 申:'酉',子:'酉',辰:'酉',寅:'卯',午:'卯',戌:'卯',亥:'子',卯:'子',未:'子',巳:'午',酉:'午',丑:'午' }
const branch = (kanshi: string) => [...kanshi].at(-1) ?? ''
const key = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

function evidence(
  id: string, year: number, month: number, scoreKey: TimingScoreKey, lineage: string,
  maximumContribution: number, available: boolean, matched: boolean, detail: string,
): TimingEvidenceDefinition {
  return {
    id: `${id}:${year}-${month}`, scoreKey, sourceFamily: 'stem_branch', technique: 'monthly_pillar',
    factLineageId: lineage, correlationGroup: 'stem_branch_calendar', available,
    matched: available && matched, support: available && matched ? 1 : 0,
    maximumContribution, polarity: 1, detail: `shadow provisional / ${detail}`,
  }
}

/** 提出ルールの流月部分。月次単独では使わず、同じ年の年次Evidenceへ合流させる。 */
export function buildMonthlyStemBranchEvidence(input: MonthlyStemBranchInput): ReadonlyMap<string, readonly TimingEvidenceDefinition[]> {
  const natal = calcShichu(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0)
  const endpoints = input.birthHour === undefined
    ? [calcShichu(input.birthYear, input.birthMonth, input.birthDay, 0, 0), calcShichu(input.birthYear, input.birthMonth, input.birthDay, 23, 59)]
    : [natal]
  const dayAvailable = endpoints.every(value => value.day.kanshi === natal.day.kanshi)
  const monthAvailable = endpoints.every(value => value.month.kanshi === natal.month.kanshi)
  const yearAvailable = endpoints.every(value => value.year.kanshi === natal.year.kanshi)
  const spouseGods = new Set(input.gender === 'male' ? ['偏財','正財'] : ['偏官','正官'])
  const result = new Map<string, readonly TimingEvidenceDefinition[]>()
  for (const annual of input.annual) for (const monthly of annual.monthly) {
    const monthlyBranch = branch(monthly.kanshi)
    const dayClash = CLASH[natal.day.branch] === monthlyBranch
    const dayBreak = BREAK[natal.day.branch] === monthlyBranch
    const dayHarm = HARM[natal.day.branch] === monthlyBranch
    const dayCombine = COMBINE[natal.day.branch] === monthlyBranch
    const monthClash = CLASH[natal.month.branch] === monthlyBranch
    const yearClash = CLASH[natal.year.branch] === monthlyBranch
    const spouse = spouseGods.has(monthly.tenGod)
    const wealth = monthly.tenGod === '偏財' || monthly.tenGod === '正財'
    const official = monthly.tenGod === '偏官' || monthly.tenGod === '正官'
    const resource = monthly.tenGod === '偏印' || monthly.tenGod === '正印'
    const peach = PEACH[natal.day.branch] === monthlyBranch
    const detail = `流月${monthly.month}月 ${monthly.kanshi}(${monthly.tenGod})`
    result.set(key(annual.year, monthly.month), [
      evidence('monthly-rel-spouse', annual.year, monthly.month, 'relationship_activation', 'stem_branch:monthly_pillar:ten_god:spouse_star', .08, dayAvailable, spouse, detail),
      evidence('monthly-rel-combine', annual.year, monthly.month, 'relationship_activation', 'stem_branch:monthly_pillar:day_branch:combine', .08, dayAvailable, dayCombine, detail),
      evidence('monthly-rel-peach', annual.year, monthly.month, 'relationship_activation', 'stem_branch:monthly_pillar:day_branch:peach_blossom', .05, dayAvailable, peach, detail),
      evidence('monthly-rel-disruption', annual.year, monthly.month, 'relationship_disruption', 'stem_branch:monthly_pillar:day_branch:disruption', .10, dayAvailable, dayClash || dayBreak || dayHarm, detail),
      evidence('monthly-rel-secrecy', annual.year, monthly.month, 'relationship_secrecy', 'stem_branch:monthly_pillar:day_branch:break_harm', .08, dayAvailable, dayBreak || dayHarm, detail),
      evidence('monthly-career-change', annual.year, monthly.month, 'career_change', 'stem_branch:monthly_pillar:natal_month:clash', .10, monthAvailable, monthClash, detail),
      evidence('monthly-money', annual.year, monthly.month, 'money_status', 'stem_branch:monthly_pillar:ten_god:wealth_star', .08, yearAvailable, wealth, detail),
      evidence('monthly-study', annual.year, monthly.month, 'education_activation', 'stem_branch:monthly_pillar:ten_god:resource_star', .08, yearAvailable, resource, detail),
      evidence('monthly-study-disrupt', annual.year, monthly.month, 'education_disruption', 'stem_branch:monthly_pillar:natal_year_month:clash', .08, monthAvailable || yearAvailable, monthClash || yearClash, detail),
      evidence('monthly-relocation', annual.year, monthly.month, 'relocation', 'stem_branch:monthly_pillar:natal_year_month:clash', .08, monthAvailable || yearAvailable, monthClash || yearClash, detail),
      evidence('monthly-identity', annual.year, monthly.month, 'identity_reset', 'stem_branch:monthly_pillar:multiple_relations', .06, dayAvailable && (monthAvailable || yearAvailable), (dayClash || dayBreak || dayHarm) && (monthClash || yearClash), detail),
      evidence('monthly-responsibility', annual.year, monthly.month, 'responsibility', 'stem_branch:monthly_pillar:ten_god:official_star', .08, yearAvailable, official, detail),
      evidence('monthly-stress', annual.year, monthly.month, 'emotional_stress', 'stem_branch:monthly_pillar:day_branch:disruption', .08, dayAvailable, dayClash || dayBreak || dayHarm, detail),
    ])
  }
  return result
}
