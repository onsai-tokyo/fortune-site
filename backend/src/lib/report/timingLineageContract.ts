import type { TimingScoreKey } from './timingClaim.js'
import type { SourceFamily } from './timingScoreEngine.js'

export interface TimingLineageContractEntry {
  factLineageId: string
  scoreKey: TimingScoreKey
  sourceFamily: SourceFamily
  maximumContribution: number
  polarity: 1 | -1
  status: 'connected' | 'upstream_missing' | 'mathematically_impossible'
}

const entry = (
  factLineageId: string, scoreKey: TimingScoreKey, maximumContribution: number,
  status: TimingLineageContractEntry['status'] = 'connected', polarity: 1 | -1 = 1,
): TimingLineageContractEntry => ({
  factLineageId, scoreKey, sourceFamily: factLineageId.split(':')[0] as SourceFamily,
  maximumContribution, polarity, status,
})

/** 納品カタログ第1弾26件の実装契約。文章資産や本番カードとは独立。 */
export const TIMING_LINEAGE_CONTRACT: readonly TimingLineageContractEntry[] = [
  entry('stem_branch:annual_pillar:day_branch:clash', 'relationship_disruption', .24),
  entry('stem_branch:annual_pillar:day_branch:break', 'relationship_disruption', .16),
  entry('stem_branch:annual_pillar:day_branch:harm', 'relationship_disruption', .12),
  entry('stem_branch:annual_pillar:day_branch:clash_consecutive', 'relationship_disruption', .08, 'mathematically_impossible'),
  entry('western:transit:saturn:venus_hard', 'relationship_disruption', .14),
  entry('western:transit:uranus:venus_mars_desc_hard', 'relationship_disruption', .16),
  entry('western:transit:neptune:venus_desc', 'relationship_disruption', .12),
  entry('western:transit:pluto:venus_desc', 'relationship_disruption', .18),
  entry('vedic:antardasha:ketu:romance_period', 'relationship_disruption', .16),
  entry('vedic:antardasha:rahu:romance_period', 'relationship_disruption', .12),
  entry('ziwei:annual_four_transformations:spouse:ji', 'relationship_disruption', .23),

  entry('western:transit:neptune:desc_house7lord_venus_hard', 'relationship_idealization', .24),
  entry('vedic:antardasha:ketu:venus_active', 'relationship_idealization', .16),
  entry('vedic:antardasha:rahu:romance_house_involvement', 'relationship_idealization', .12),
  entry('western:transit:neptune:desc_long_term_end', 'relationship_idealization', .10, 'connected', -1),

  entry('stem_branch:annual_pillar:month_pillar:clash', 'career_activation', .20),
  entry('stem_branch:annual_pillar:month_pillar:repeat', 'career_activation', .14),
  entry('stem_branch:major_luck_cycle:transition', 'career_activation', .18),
  entry('western:transit:uranus:mc_ic_mercury_house10lord', 'career_activation', .18),
  entry('western:transit:pluto:mc_asc_house10lord', 'career_activation', .20),
  entry('western:transit:jupiter:mercury_mc_house10lord', 'career_activation', .14),
  entry('western:transit:saturn:mc_house10lord', 'career_activation', .12),
  entry('vedic:antardasha:house10lord', 'career_activation', .20),
  entry('vedic:mahadasha:transition', 'career_activation', .16),
  entry('ziwei:annual_life_palace:career_travel_wealth', 'career_activation', .23),
  entry('ziwei:annual_four_transformations:career', 'career_activation', .18),
]
