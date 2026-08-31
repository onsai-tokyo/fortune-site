import type { TimingScoreKey } from './timingClaim.js'
import type { SourceFamily } from './timingScoreEngine.js'

export interface TimingScoreDesignContract {
  sourceFamilies: readonly SourceFamily[]
  fullMax: number
}

const WVSZ = ['western', 'vedic', 'stem_branch', 'ziwei'] as const
const WVSZA = ['western', 'vedic', 'stem_branch', 'ziwei', 'auxiliary'] as const

/** Phase2設計表_18スコア_v2b.md §2の正本契約。個別ルールは含めない。 */
export const TIMING_SCORE_DESIGN_CONTRACT: Readonly<Record<TimingScoreKey, TimingScoreDesignContract>> = {
  relationship_activation: { sourceFamilies: WVSZA, fullMax: .904 },
  relationship_binding: { sourceFamilies: WVSZ, fullMax: .854 },
  relationship_disruption: { sourceFamilies: WVSZ, fullMax: .854 },
  relationship_secrecy: { sourceFamilies: WVSZ, fullMax: .854 },
  relationship_idealization: { sourceFamilies: ['western', 'vedic'], fullMax: .384 },
  marriage_legalization: { sourceFamilies: WVSZ, fullMax: .854 },
  career_activation: { sourceFamilies: WVSZ, fullMax: .854 },
  career_change: { sourceFamilies: WVSZ, fullMax: .854 },
  career_expansion: { sourceFamilies: WVSZ, fullMax: .854 },
  money_status: { sourceFamilies: WVSZ, fullMax: .854 },
  home_family: { sourceFamilies: WVSZ, fullMax: .854 },
  relocation: { sourceFamilies: WVSZA, fullMax: .904 },
  education_activation: { sourceFamilies: WVSZ, fullMax: .854 },
  education_disruption: { sourceFamilies: ['western', 'vedic', 'stem_branch'], fullMax: .624 },
  identity_reset: { sourceFamilies: WVSZA, fullMax: .904 },
  social_network_change: { sourceFamilies: WVSZ, fullMax: .854 },
  responsibility: { sourceFamilies: WVSZ, fullMax: .854 },
  emotional_stress: { sourceFamilies: WVSZ, fullMax: .854 },
}
