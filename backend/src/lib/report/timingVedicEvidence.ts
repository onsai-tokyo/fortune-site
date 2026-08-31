import type { VedicAnnualDasha } from '../astrology.js'
import type { TimingEvidenceDefinition } from './timingScoreEngine.js'

export function buildVedicTimingEvidence(annual: readonly VedicAnnualDasha[]): ReadonlyMap<number, readonly TimingEvidenceDefinition[]> {
  return new Map(annual.map(item => {
    const make = (
      id: string, scoreKey: 'relationship_disruption' | 'relationship_idealization' | 'career_activation',
      factLineageId: string, maximumContribution: number, matched: boolean, available = item.available,
    ): TimingEvidenceDefinition => ({
      id: `${id}:${item.year}`, scoreKey, sourceFamily: 'vedic', technique: factLineageId.includes('mahadasha') ? 'mahadasha' : 'antardasha',
      factLineageId, correlationGroup: 'astronomical_ephemeris', available, matched: available && matched,
      support: available && matched ? 1 : 0, maximumContribution, polarity: 1,
      detail: available ? `マハーダシャー${item.mahadashaLord} / アンタルダシャー${item.antardashaLord}` : '出生時刻候補間でダシャー系列を確定できないため未利用',
    })
    const relationshipLords = new Set(['金星', item.house5Lord, item.house7Lord, item.house8Lord].filter(Boolean))
    const romanceContext = relationshipLords.has(item.mahadashaLord)
    const venusKetu = romanceContext && item.antardashaLord === 'ケートゥ'
    const venusRahu = romanceContext && item.antardashaLord === 'ラーフ'
    // lineage名どおりアンタルダシャーで10室支配星が巡る場合だけ成立させる。
    // マハーダシャー一致は別lineageが正本へ追加されるまで混ぜない。
    const house10Active = Boolean(item.house10Lord) && item.antardashaLord === item.house10Lord
    return [item.year, [
      make('ketu-romance', 'relationship_disruption', 'vedic:antardasha:ketu:romance_period', 0.16, venusKetu),
      make('rahu-romance', 'relationship_disruption', 'vedic:antardasha:rahu:romance_period', 0.12, venusRahu),
      make('ketu-venus', 'relationship_idealization', 'vedic:antardasha:ketu:venus_active', 0.16, venusKetu),
      make('rahu-romance-house', 'relationship_idealization', 'vedic:antardasha:rahu:romance_house_involvement', 0.12, venusRahu),
      make('mahadasha-transition', 'career_activation', 'vedic:mahadasha:transition', 0.16, item.mahadashaTransition),
      make('house10lord', 'career_activation', 'vedic:antardasha:house10lord', 0.20, house10Active, item.available && Boolean(item.house10Lord)),
    ]] as const
  }))
}
