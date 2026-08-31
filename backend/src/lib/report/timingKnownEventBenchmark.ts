import type { TimingEvidenceBirthInput, TimingScoreTimeline } from './timingEvidencePipeline.js'
import type { TimingScoreKey } from './timingClaim.js'

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

export interface KnownTimingEventResult {
  event: KnownTimingEvent
  measurableScores: readonly TimingScoreKey[]
  unsupportedScores: readonly TimingScoreKey[]
  detectedScores: readonly TimingScoreKey[]
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
    const detectedScores = measurableScores.filter(key => {
      const score = scores[key]
      return score.relativeStrength >= minimumRelativeStrength && score.confidence > 0 && score.sourceFamilyCount > 0
    })
    return { event, measurableScores, unsupportedScores, detectedScores }
  })
}
