import type { VedicAnnualDasha } from '../astrology.js'
import type { TimingEvidenceDefinition } from './timingScoreEngine.js'

export function buildVedicTimingEvidence(annual: readonly VedicAnnualDasha[]): ReadonlyMap<number, readonly TimingEvidenceDefinition[]> {
  return new Map(annual.map(item => {
    const make = (
      id: string, scoreKey: TimingEvidenceDefinition['scoreKey'],
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
    const antar = item.antardashaLord
    const house2Active = Boolean(item.house2Lord) && antar === item.house2Lord
    const house4Active = Boolean(item.house4Lord) && antar === item.house4Lord
    const house5Active = Boolean(item.house5Lord) && antar === item.house5Lord
    const house7Active = Boolean(item.house7Lord) && antar === item.house7Lord
    const house8Active = Boolean(item.house8Lord) && antar === item.house8Lord
    const house9Active = Boolean(item.house9Lord) && antar === item.house9Lord
    const venusActive = antar === '金星'
    const jupiterActive = antar === '木星'
    const saturnActive = antar === '土星'
    const nodeActive = antar === 'ラーフ' || antar === 'ケートゥ'
    return [item.year, [
      make('ketu-romance', 'relationship_disruption', 'vedic:antardasha:ketu:romance_period', 0.16, venusKetu),
      make('rahu-romance', 'relationship_disruption', 'vedic:antardasha:rahu:romance_period', 0.12, venusRahu),
      make('ketu-venus', 'relationship_idealization', 'vedic:antardasha:ketu:venus_active', 0.16, venusKetu),
      make('rahu-romance-house', 'relationship_idealization', 'vedic:antardasha:rahu:romance_house_involvement', 0.12, venusRahu),
      make('mahadasha-transition', 'career_activation', 'vedic:mahadasha:transition', 0.16, item.mahadashaTransition),
      make('house10lord', 'career_activation', 'vedic:antardasha:house10lord', 0.20, house10Active, item.available && Boolean(item.house10Lord)),
      make('relationship-active', 'relationship_activation', 'vedic:antardasha:house5_house7_venus', 0.18, house5Active || house7Active || venusActive),
      make('relationship-binding', 'relationship_binding', 'vedic:antardasha:house7_venus_saturn', 0.18, house7Active || (romanceContext && saturnActive)),
      make('relationship-secrecy', 'relationship_secrecy', 'vedic:antardasha:rahu_house8', 0.18, antar === 'ラーフ' && (house8Active || romanceContext)),
      make('marriage-legalization', 'marriage_legalization', 'vedic:antardasha:house7_venus_jupiter', 0.18, house7Active || (romanceContext && jupiterActive)),
      make('career-change', 'career_change', 'vedic:antardasha:house10_transition', 0.20, house10Active || item.mahadashaTransition),
      make('career-expansion', 'career_expansion', 'vedic:antardasha:house10_jupiter', 0.18, house10Active || jupiterActive),
      make('money-status', 'money_status', 'vedic:antardasha:house2_house10', 0.18, house2Active || house10Active, item.available && Boolean(item.house2Lord) && Boolean(item.house10Lord)),
      make('home-family', 'home_family', 'vedic:antardasha:house2_house4', 0.18, house2Active || house4Active, item.available && Boolean(item.house2Lord) && Boolean(item.house4Lord)),
      make('relocation', 'relocation', 'vedic:antardasha:house4_house9_rahu', 0.18, house4Active || house9Active || antar === 'ラーフ', item.available && Boolean(item.house4Lord) && Boolean(item.house9Lord)),
      make('education-active', 'education_activation', 'vedic:antardasha:house5_house9_jupiter', 0.18, house5Active || house9Active || jupiterActive, item.available && Boolean(item.house5Lord) && Boolean(item.house9Lord)),
      make('education-disrupt', 'education_disruption', 'vedic:antardasha:house9_rahu_ketu_saturn', 0.18, house9Active && (nodeActive || saturnActive), item.available && Boolean(item.house9Lord)),
      make('identity-reset', 'identity_reset', 'vedic:mahadasha:transition_nodes', 0.20, item.mahadashaTransition || nodeActive),
      make('social-network', 'social_network_change', 'vedic:antardasha:rahu_mercury', 0.16, antar === 'ラーフ' || antar === '水星'),
      make('responsibility', 'responsibility', 'vedic:antardasha:saturn_house10', 0.18, saturnActive || house10Active, item.available && Boolean(item.house10Lord)),
      make('emotional-stress', 'emotional_stress', 'vedic:antardasha:rahu_ketu_house8', 0.18, nodeActive || house8Active, item.available && Boolean(item.house8Lord)),
    ]] as const
  }))
}
