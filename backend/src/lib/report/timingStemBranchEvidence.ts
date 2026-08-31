import { calcShichu } from '../divination/index.js'
import type { TimingEvidenceDefinition } from './timingScoreEngine.js'

interface AnnualStemBranchInput {
  year: number
  kanshi: string
}

interface MajorLuckPeriodInput {
  startYear: number
  endYear: number
}

export interface StemBranchTimingInput {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour?: number
  birthMinute?: number
  annual: readonly AnnualStemBranchInput[]
  decades: readonly MajorLuckPeriodInput[]
}

const BRANCH_CLASH: Readonly<Record<string, string>> = {
  子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
}
const BRANCH_BREAK: Readonly<Record<string, string>> = {
  子: '酉', 酉: '子', 丑: '辰', 辰: '丑', 寅: '亥', 亥: '寅', 卯: '午', 午: '卯', 巳: '申', 申: '巳', 未: '戌', 戌: '未',
}
const BRANCH_HARM: Readonly<Record<string, string>> = {
  子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉',
}

const branchOf = (kanshi: string) => [...kanshi].at(-1) ?? ''

function evidence(
  id: string,
  year: number,
  scoreKey: 'relationship_disruption' | 'career_activation',
  technique: 'annual_pillar' | 'major_luck_cycle',
  factLineageId: string,
  maximumContribution: number,
  available: boolean,
  matched: boolean,
  detail: string,
): TimingEvidenceDefinition {
  return {
    id: `${id}:${year}`,
    scoreKey,
    sourceFamily: 'stem_branch',
    technique,
    factLineageId,
    correlationGroup: 'stem_branch_calendar',
    available,
    matched: available && matched,
    support: available && matched ? 1 : 0,
    maximumContribution,
    polarity: 1,
    detail,
  }
}

/**
 * 第1弾カタログのうち、出生時刻なしでも確定する stem_branch 6 Lineage を年ごとに作る。
 * 本番カード選択にはまだ接続せず、シャドー集計・分布測定から利用する。
 */
export function buildStemBranchTimingEvidence(input: StemBranchTimingInput): ReadonlyMap<number, readonly TimingEvidenceDefinition[]> {
  // 時刻入力済みの場合は日界・節入り境界を含む正確な命式を使う。
  // 時刻不明の場合だけ従来どおり時刻なしの安全な計算へ戻す。
  const natal = calcShichu(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0)
  const dayBranch = natal.day.branch
  const monthBranch = natal.month.branch
  const monthKanshi = natal.month.kanshi
  // lunar-javascriptの年柱・月柱は節入り瞬間で一方向に1回だけ切り替わり、同一暦日内で逆戻りしない。
  // したがって時刻不明日は00:00と23:59が一致すれば日内全域で不変。毎正時の離散近似は使わない。
  const timedCandidates = input.birthHour === undefined
    ? [calcShichu(input.birthYear, input.birthMonth, input.birthDay, 0, 0), calcShichu(input.birthYear, input.birthMonth, input.birthDay, 23, 59)]
    : [natal]
  const dayAvailable = timedCandidates.every(candidate => candidate.day.branch === dayBranch)
  const monthAvailable = timedCandidates.every(candidate => candidate.month.kanshi === monthKanshi)
  // 大運開始年は出生時刻で動き得る。時刻不明時は、厳密な境界判定が入るまで利用しない。
  const majorLuckAvailable = input.birthHour !== undefined
  const transitionYears = new Set(input.decades.flatMap(period => [period.startYear - 1, period.startYear, period.startYear + 1]))
  return new Map(input.annual.map(annual => {
    const annualBranch = branchOf(annual.kanshi)
    const definitions = [
      evidence('day-clash', annual.year, 'relationship_disruption', 'annual_pillar', 'stem_branch:annual_pillar:day_branch:clash', 0.24, dayAvailable, BRANCH_CLASH[dayBranch] === annualBranch, `流年${annual.kanshi} / 日支${dayBranch}`),
      evidence('day-break', annual.year, 'relationship_disruption', 'annual_pillar', 'stem_branch:annual_pillar:day_branch:break', 0.16, dayAvailable, BRANCH_BREAK[dayBranch] === annualBranch, `流年${annual.kanshi} / 日支${dayBranch}`),
      evidence('day-harm', annual.year, 'relationship_disruption', 'annual_pillar', 'stem_branch:annual_pillar:day_branch:harm', 0.12, dayAvailable, BRANCH_HARM[dayBranch] === annualBranch, `流年${annual.kanshi} / 日支${dayBranch}`),
      evidence('month-clash', annual.year, 'career_activation', 'annual_pillar', 'stem_branch:annual_pillar:month_pillar:clash', 0.20, monthAvailable, BRANCH_CLASH[monthBranch] === annualBranch, `流年${annual.kanshi} / 月支${monthBranch}`),
      evidence('month-repeat', annual.year, 'career_activation', 'annual_pillar', 'stem_branch:annual_pillar:month_pillar:repeat', 0.14, monthAvailable, annual.kanshi === monthKanshi, `流年${annual.kanshi} / 月柱${monthKanshi}`),
      evidence('major-luck-transition', annual.year, 'career_activation', 'major_luck_cycle', 'stem_branch:major_luck_cycle:transition', 0.18, majorLuckAvailable, transitionYears.has(annual.year), `流年${annual.year} / 大運切替±1年`),
    ]
    return [annual.year, definitions] as const
  }))
}
