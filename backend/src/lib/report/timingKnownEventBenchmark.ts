import type { MonthlyTimingScoreTimeline, TimingEvidenceBirthInput, TimingScoreTimeline } from './timingEvidencePipeline.js'
import type { TimingScoreKey } from './timingClaim.js'
import type { TimingScoreResult } from './timingScoreEngine.js'
import { passesTimingScoreGate } from './timingClaimSelector.js'

/**
 * 既知の人生イベントは「正解文」ではなく、時期ロジックの検証ラベルとしてだけ扱う。
 * このモジュールは shadow 専用で、鑑定カード生成から参照してはならない。
 */
export interface KnownTimingEvent {
  id: string
  year: number
  months?: readonly number[]
  expectedScores: readonly TimingScoreKey[]
  note: string
}

export interface KnownTimingCase {
  id: string
  input: TimingEvidenceBirthInput
  events: readonly KnownTimingEvent[]
}

export const CASE_A_TIMING_BENCHMARK: KnownTimingCase = {
  id: 'case-a-1995-02-20-0302-nagoya',
  input: {
    birthYear: 1995, birthMonth: 2, birthDay: 20,
    birthHour: 3, birthMinute: 2, gender: 'female', birthplace: '愛知県名古屋市',
  },
  events: [
    { id: 'a-2013-setback', year: 2013, months: [3], expectedScores: ['education_disruption', 'emotional_stress'], note: '受験失敗と再挑戦の開始' },
    { id: 'a-2014-move-study-love', year: 2014, months: [4], expectedScores: ['education_activation', 'relocation', 'relationship_activation'], note: '進学・上京・初めての交際' },
    { id: 'a-2016-career-turn', year: 2016, months: [10], expectedScores: ['career_activation', 'career_change'], note: 'インターンと仕事方向の転換' },
    { id: 'a-2016-breakup', year: 2016, months: [11], expectedScores: ['relationship_disruption', 'emotional_stress'], note: '交際相手から別れを告げられる' },
    { id: 'a-2018-heartbreak', year: 2018, months: [3], expectedScores: ['relationship_disruption', 'relationship_idealization', 'emotional_stress'], note: '初恋の本格的な失恋' },
    { id: 'a-2019-breakup', year: 2019, months: [12], expectedScores: ['relationship_disruption', 'emotional_stress'], note: '交際相手との別れ' },
    { id: 'a-2021-job-change', year: 2021, months: [1], expectedScores: ['career_activation', 'career_change', 'money_status', 'identity_reset'], note: '転職・環境変化・収入上昇' },
    { id: 'a-2021-relationship', year: 2021, months: [6, 11], expectedScores: ['relationship_activation', 'relationship_binding'], note: '出会いから交際へ進む' },
    { id: 'a-2022-promotion', year: 2022, expectedScores: ['career_activation', 'career_expansion', 'responsibility'], note: '管理職・部門長への昇進' },
    { id: 'a-2023-betrayal', year: 2023, months: [5, 6, 7], expectedScores: ['relationship_disruption', 'relationship_secrecy', 'relationship_idealization', 'emotional_stress'], note: '相手の既婚・複数関係が発覚' },
    { id: 'a-2024-job-change', year: 2024, months: [1], expectedScores: ['career_activation', 'career_change', 'identity_reset'], note: '現職への転職' },
    { id: 'a-2025-executive', year: 2025, months: [2], expectedScores: ['career_activation', 'career_expansion', 'money_status', 'responsibility'], note: '役員就任と収入上昇' },
    { id: 'a-2026-closure', year: 2026, months: [1], expectedScores: ['relationship_disruption', 'identity_reset', 'career_activation'], note: '恋愛の区切りと仕事への集中' },
  ],
}

export const CASE_B_TIMING_BENCHMARK: KnownTimingCase = {
  id: 'case-b-1995-06-30-unknown-time-place',
  input: { birthYear: 1995, birthMonth: 6, birthDay: 30, gender: 'female', birthplace: '' },
  events: [
    { id: 'b-2016-crisis', year: 2016, months: [11], expectedScores: ['relationship_disruption', 'emotional_stress', 'responsibility'], note: '妊娠・中絶・交際終了という重大な転換' },
    { id: 'b-2017-relationship', year: 2017, expectedScores: ['relationship_activation', 'relationship_binding'], note: '長期交際相手との出会い' },
    { id: 'b-2024-transition', year: 2024, months: [2, 3, 4], expectedScores: ['relationship_disruption', 'relationship_activation', 'identity_reset'], note: '長期交際終了と将来の配偶者との出会い' },
    { id: 'b-2024-engagement', year: 2024, months: [12], expectedScores: ['relationship_binding', 'marriage_legalization', 'responsibility'], note: 'プロポーズから翌年入籍へ進む' },
  ],
}

export const CASE_C_TIMING_BENCHMARK: KnownTimingCase = {
  id: 'case-c-1995-03-16-0052-aichi',
  input: { birthYear: 1995, birthMonth: 3, birthDay: 16, birthHour: 0, birthMinute: 52, gender: 'female', birthplace: '愛知県' },
  events: [
    { id: 'c-2017-career-love', year: 2017, expectedScores: ['career_activation', 'social_network_change', 'relationship_activation'], note: '新卒入社と将来の配偶者との出会い' },
    { id: 'c-2018-breakup', year: 2018, months: [3], expectedScores: ['relationship_disruption', 'emotional_stress'], note: '結婚を考えた相手との喧嘩別れ' },
    { id: 'c-2019-distance', year: 2019, months: [3, 4, 5], expectedScores: ['relationship_disruption', 'identity_reset'], note: '将来の配偶者と一度決別し距離を置く' },
    { id: 'c-2022-reunion', year: 2022, months: [10], expectedScores: ['relationship_activation', 'relationship_binding'], note: '再会して交際を再開する' },
    { id: 'c-2025-marriage-decision', year: 2025, months: [8], expectedScores: ['relationship_binding', 'marriage_legalization', 'responsibility'], note: '結婚を決意する' },
  ],
}

export const CASE_D_TIMING_BENCHMARK: KnownTimingCase = {
  id: 'case-d-1997-07-30-1830-saga',
  input: { birthYear: 1997, birthMonth: 7, birthDay: 30, birthHour: 18, birthMinute: 30, gender: 'female', birthplace: '佐賀県' },
  events: [
    { id: 'd-2016-university-meeting', year: 2016, expectedScores: ['education_activation', 'relocation', 'social_network_change', 'relationship_activation'], note: '大学入学と将来の交際相手との出会い' },
    { id: 'd-2018-relationship', year: 2018, expectedScores: ['relationship_activation', 'relationship_binding'], note: '2016年に出会った相手との交際開始' },
    { id: 'd-2020-career-transition', year: 2020, months: [4], expectedScores: ['career_activation', 'career_change', 'relationship_disruption', 'relationship_activation'], note: '新卒入社・別れ・新しい相手との出会い' },
    { id: 'd-2021-relationship', year: 2021, expectedScores: ['relationship_activation', 'relationship_binding'], note: '現在の相手との交際開始' },
    { id: 'd-2025-role-change', year: 2025, expectedScores: ['career_change', 'career_activation', 'identity_reset'], note: '営業から総務へ異動し仕事が好転' },
  ],
}

export const KNOWN_TIMING_BENCHMARKS: readonly KnownTimingCase[] = [
  CASE_A_TIMING_BENCHMARK,
  CASE_B_TIMING_BENCHMARK,
  CASE_C_TIMING_BENCHMARK,
  CASE_D_TIMING_BENCHMARK,
]

export interface KnownTimingEventResult {
  event: KnownTimingEvent
  measurableScores: readonly TimingScoreKey[]
  unsupportedScores: readonly TimingScoreKey[]
  detectedScores: readonly TimingScoreKey[]
  claimEligibleScores: readonly TimingScoreKey[]
  diagnostics: readonly KnownTimingScoreDiagnostic[]
}

export type KnownTimingDiagnosticStatus = 'detected' | 'no_support' | 'below_relative_strength' | 'no_confidence' | 'no_source_family'

export interface KnownTimingScoreDiagnostic {
  key: TimingScoreKey
  status: KnownTimingDiagnosticStatus
  rawSupport: number
  relativeStrength: number
  confidence: number
  sourceFamilyCount: number
  correlationGroupCount: number
  evidenceCount: number
}

export interface UnlabelledTimingActivation {
  year: number
  activatedScores: readonly TimingScoreKey[]
  claimEligibleScores: readonly TimingScoreKey[]
}

export interface KnownTimingMonthlyResult {
  event: KnownTimingEvent
  claimEligibleScoresByMonth: Readonly<Record<number, readonly TimingScoreKey[]>>
}

const isDetected = (
  score: TimingScoreResult,
  minimumRelativeStrength: number,
) => score.relativeStrength >= minimumRelativeStrength && score.confidence > 0 && score.sourceFamilyCount > 0

function diagnosticStatus(
  score: TimingScoreResult,
  minimumRelativeStrength: number,
): KnownTimingDiagnosticStatus {
  if (isDetected(score, minimumRelativeStrength)) return 'detected'
  if (score.rawSupport <= 0) return 'no_support'
  if (score.relativeStrength < minimumRelativeStrength) return 'below_relative_strength'
  if (score.confidence <= 0) return 'no_confidence'
  return 'no_source_family'
}

/** 現在接続済みのEvidenceだけを測り、未実装を「不一致」と誤記録しない。 */
export function evaluateKnownTimingCase(
  fixture: KnownTimingCase,
  timeline: TimingScoreTimeline,
  minimumRelativeStrength = 0.33,
): readonly KnownTimingEventResult[] {
  const implementedScores = new Set<TimingScoreKey>([...timeline.byYear.values()]
    .flatMap(items => items.map(item => item.scoreKey)))
  return fixture.events.map(event => {
    const scores = timeline.scoresByYear.get(event.year)
    if (!scores) throw new RangeError(`Missing timing score year: ${event.year}`)
    // Evidenceが非成立の年でも、カタログ接続済みのスコアは「計測したが不一致」。
    // evidence.lengthだけを見ると非発火を未実装と誤分類するため、正本契約で判定する。
    const measurableScores = event.expectedScores.filter(key => implementedScores.has(key))
    const unsupportedScores = event.expectedScores.filter(key => !implementedScores.has(key))
    const diagnostics = measurableScores.map(key => {
      const score = scores[key]
      return {
        key,
        status: diagnosticStatus(score, minimumRelativeStrength),
        rawSupport: score.rawSupport,
        relativeStrength: score.relativeStrength,
        confidence: score.confidence,
        sourceFamilyCount: score.sourceFamilyCount,
        correlationGroupCount: score.correlationGroupCount,
        evidenceCount: score.evidence.length,
      }
    })
    const detectedScores = diagnostics.filter(item => item.status === 'detected').map(item => item.key)
    const claimEligibleScores = measurableScores.filter(key => passesTimingScoreGate(
      { key, op: 'gte', value: 0.33, level: 'medium_or_high' }, scores[key],
    ))
    return { event, measurableScores, unsupportedScores, detectedScores, claimEligibleScores, diagnostics }
  })
}

/**
 * 出来事が記録されていない年を「外れ」とは断定せず、高スコアの発火量だけを測る。
 * ルール追加で全ての年が強くなる退行を検知するための shadow 診断。
 */
export function measureUnlabelledTimingActivation(
  fixture: KnownTimingCase,
  timeline: TimingScoreTimeline,
  minimumRelativeStrength = 0.33,
): readonly UnlabelledTimingActivation[] {
  const labelledYears = new Set(fixture.events.map(item => item.year))
  return [...timeline.scoresByYear.entries()]
    .filter(([year]) => !labelledYears.has(year))
    .sort(([left], [right]) => left - right)
    .map(([year, scores]) => ({
      year,
      activatedScores: (Object.keys(scores) as TimingScoreKey[])
        .filter(key => isDetected(scores[key], minimumRelativeStrength))
        .sort(),
      claimEligibleScores: (Object.keys(scores) as TimingScoreKey[])
        .filter(key => passesTimingScoreGate(
          { key, op: 'gte', value: minimumRelativeStrength, level: 'medium_or_high' }, scores[key],
        ))
        .sort(),
    }))
}

/** 月指定の既知イベントだけを、年次＋流月EvidenceのClaim安全条件で測る。 */
export function evaluateKnownTimingMonths(
  fixture: KnownTimingCase,
  timeline: MonthlyTimingScoreTimeline,
): readonly KnownTimingMonthlyResult[] {
  return fixture.events.filter(event => event.months?.length).map(event => ({
    event,
    claimEligibleScoresByMonth: Object.fromEntries(event.months!.map(month => {
      const monthKey = `${event.year}-${String(month).padStart(2, '0')}`
      const scores = timeline.byMonth.get(monthKey)
      if (!scores) throw new RangeError(`Missing timing score month: ${monthKey}`)
      return [month, event.expectedScores.filter(key => passesTimingScoreGate(
        { key, op: 'gte', value: 0.33, level: 'medium_or_high' }, scores[key],
      ))]
    })),
  }))
}
