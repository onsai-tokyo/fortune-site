import type { TimingEvidenceDefinition } from './timingScoreEngine.js'

export interface ZiweiAnnualTimingInput {
  year: number
  activePalaces: readonly string[]
  mutagenPlacements: readonly { mutagen: '化禄' | '化権' | '化科' | '化忌'; star: string; palace: string }[]
}

const normalizePalace = (value: string) => value.replace('祿', '禄').replace(/宮$/, '')
const VALID_PALACES = new Set(['命', '兄弟', '夫妻', '子女', '財帛', '疾厄', '遷移', '交友', '僕役', '官禄', '田宅', '福徳', '父母'])

export function buildZiweiTimingEvidence(annual: readonly ZiweiAnnualTimingInput[], available = true): ReadonlyMap<number, readonly TimingEvidenceDefinition[]> {
  return new Map(annual.map(item => {
    const normalizedActivePalaces = item.activePalaces.map(normalizePalace).filter(Boolean)
    const active = new Set(normalizedActivePalaces)
    // 流年命宮は年ごとに1宮だけ。index解決失敗・重複・複数候補は推測せず利用不可にする。
    const annualLifePalaceAvailable = available && normalizedActivePalaces.length === 1 && active.size === 1
      && VALID_PALACES.has(normalizedActivePalaces[0]!)
    const placements = item.mutagenPlacements.map(entry => ({ ...entry, palace: normalizePalace(entry.palace) }))
    const spouseJi = placements.some(entry => entry.mutagen === '化忌' && entry.palace === '夫妻')
    const selfOrWellbeingChanged = placements.some(entry => entry.palace === '命' || entry.palace === '福徳')
    const homeActivated = active.has('田宅') || placements.some(entry => entry.palace === '田宅' && entry.mutagen !== '化忌')
    const careerPositiveMutagen = placements.some(entry => entry.palace === '官禄' && entry.mutagen !== '化忌')
    const positiveAt = (palace: string) => placements.some(entry => entry.palace === palace && entry.mutagen !== '化忌')
    const mutagenAt = (palace: string, mutagen: ZiweiAnnualTimingInput['mutagenPlacements'][number]['mutagen']) =>
      placements.some(entry => entry.palace === palace && entry.mutagen === mutagen)
    const expectedMutagens: ReadonlySet<ZiweiAnnualTimingInput['mutagenPlacements'][number]['mutagen']> = new Set(['化禄', '化権', '化科', '化忌'])
    const resolvedMutagens = new Set(placements.filter(entry => entry.star.trim() && entry.palace.trim()).map(entry => entry.mutagen))
    const resolvedStars = new Set(placements.filter(entry => entry.star.trim()).map(entry => entry.star.trim()))
    const fourTransformationsAvailable = available
      && placements.length === expectedMutagens.size
      && resolvedMutagens.size === expectedMutagens.size
      && [...expectedMutagens].every(mutagen => resolvedMutagens.has(mutagen))
      && resolvedStars.size === expectedMutagens.size
      && placements.every(entry => VALID_PALACES.has(entry.palace))
    const make = (
      id: string, scoreKey: TimingEvidenceDefinition['scoreKey'], factLineageId: string,
      technique: 'annual_life_palace' | 'annual_four_transformations', maximumContribution: number, matched: boolean, detail: string,
      evidenceAvailable = available,
    ): TimingEvidenceDefinition => ({
      id: `${id}:${item.year}`, scoreKey, sourceFamily: 'ziwei', technique, factLineageId, correlationGroup: 'ziwei_chart',
      available: evidenceAvailable, matched: evidenceAvailable && matched, support: evidenceAvailable && matched ? 1 : 0, maximumContribution, polarity: 1, detail,
    })
    return [item.year, [
      make('spouse-ji', 'relationship_disruption', 'ziwei:annual_four_transformations:spouse:ji', 'annual_four_transformations', 0.23,
        spouseJi && selfOrWellbeingChanged && !homeActivated, `夫妻宮化忌=${spouseJi} / 命・福徳変化=${selfOrWellbeingChanged} / 田宅活性=${homeActivated}`, fourTransformationsAvailable),
      make('career-life-palace', 'career_activation', 'ziwei:annual_life_palace:career_travel_wealth', 'annual_life_palace', 0.23,
        ['官禄', '遷移', '財帛'].some(palace => active.has(palace)), `流年命宮=${[...active].join('・')}`, annualLifePalaceAvailable),
      make('career-mutagen', 'career_activation', 'ziwei:annual_four_transformations:career', 'annual_four_transformations', 0.18,
        careerPositiveMutagen, `官禄宮の吉四化=${careerPositiveMutagen}`, fourTransformationsAvailable),
      make('spouse-life-activation', 'relationship_activation', 'ziwei:annual_life_palace:natal_spouse_palace', 'annual_life_palace', 0.20,
        active.has('夫妻'), `流年命宮=${[...active].join('・')}`, annualLifePalaceAvailable),
      make('spouse-positive-activation', 'relationship_activation', 'ziwei:annual_four_transformations:spouse:positive', 'annual_four_transformations', 0.18,
        positiveAt('夫妻'), `夫妻宮吉四化=${positiveAt('夫妻')}`, fourTransformationsAvailable),
      make('spouse-binding', 'relationship_binding', 'ziwei:annual_four_transformations:spouse:lu_quan_ke', 'annual_four_transformations', 0.20,
        positiveAt('夫妻'), `夫妻宮吉四化=${positiveAt('夫妻')}`, fourTransformationsAvailable),
      make('spouse-secrecy', 'relationship_secrecy', 'ziwei:annual_four_transformations:spouse:ji', 'annual_four_transformations', 0.18,
        spouseJi, `shadow provisional / 夫妻宮化忌=${spouseJi}`, fourTransformationsAvailable),
      make('marriage-home', 'marriage_legalization', 'ziwei:annual_four_transformations:spouse_property:activation', 'annual_four_transformations', 0.20,
        (positiveAt('夫妻') && homeActivated) || (spouseJi && homeActivated), `夫妻変化=${positiveAt('夫妻') || spouseJi} / 田宅活性=${homeActivated}`, fourTransformationsAvailable),
      make('career-change-life', 'career_change', 'ziwei:annual_life_palace:career_travel', 'annual_life_palace', 0.20,
        active.has('官禄') || active.has('遷移'), `流年命宮=${[...active].join('・')}`, annualLifePalaceAvailable),
      make('career-expansion-mutagen', 'career_expansion', 'ziwei:annual_four_transformations:career:lu_quan_ke', 'annual_four_transformations', 0.20,
        careerPositiveMutagen, `官禄宮吉四化=${careerPositiveMutagen}`, fourTransformationsAvailable),
      make('money-life', 'money_status', 'ziwei:annual_life_palace:wealth', 'annual_life_palace', 0.18,
        active.has('財帛'), `流年命宮=${[...active].join('・')}`, annualLifePalaceAvailable),
      make('money-mutagen', 'money_status', 'ziwei:annual_four_transformations:wealth:lu_quan', 'annual_four_transformations', 0.20,
        mutagenAt('財帛', '化禄') || mutagenAt('財帛', '化権'), `財帛宮化禄・化権=${mutagenAt('財帛', '化禄') || mutagenAt('財帛', '化権')}`, fourTransformationsAvailable),
      make('home-life', 'home_family', 'ziwei:annual_life_palace:property', 'annual_life_palace', 0.18,
        active.has('田宅'), `流年命宮=${[...active].join('・')}`, annualLifePalaceAvailable),
      make('home-mutagen', 'home_family', 'ziwei:annual_four_transformations:property:activation', 'annual_four_transformations', 0.20,
        positiveAt('田宅'), `田宅宮吉四化=${positiveAt('田宅')}`, fourTransformationsAvailable),
      make('relocation-life', 'relocation', 'ziwei:annual_life_palace:travel_property', 'annual_life_palace', 0.20,
        active.has('遷移') || active.has('田宅'), `流年命宮=${[...active].join('・')}`, annualLifePalaceAvailable),
      make('education-ke', 'education_activation', 'ziwei:annual_four_transformations:career:ke', 'annual_four_transformations', 0.18,
        mutagenAt('官禄', '化科') || mutagenAt('命', '化科'), `官禄・命宮化科=${mutagenAt('官禄', '化科') || mutagenAt('命', '化科')}`, fourTransformationsAvailable),
      make('identity-life', 'identity_reset', 'ziwei:annual_life_palace:self_travel', 'annual_life_palace', 0.20,
        active.has('命') || active.has('遷移'), `流年命宮=${[...active].join('・')}`, annualLifePalaceAvailable),
      make('identity-mutagen', 'identity_reset', 'ziwei:annual_four_transformations:self:activation', 'annual_four_transformations', 0.18,
        placements.some(entry => (entry.palace === '命' || entry.palace === '福徳')), `命・福徳四化=${selfOrWellbeingChanged}`, fourTransformationsAvailable),
      make('network-life', 'social_network_change', 'ziwei:annual_life_palace:friends_travel', 'annual_life_palace', 0.18,
        active.has('交友') || active.has('僕役') || active.has('遷移'), `流年命宮=${[...active].join('・')}`, annualLifePalaceAvailable),
      make('responsibility-career', 'responsibility', 'ziwei:annual_four_transformations:career:quan_ji', 'annual_four_transformations', 0.18,
        mutagenAt('官禄', '化権') || mutagenAt('官禄', '化忌'), `官禄宮化権・化忌=${mutagenAt('官禄', '化権') || mutagenAt('官禄', '化忌')}`, fourTransformationsAvailable),
      make('emotional-stress-ji', 'emotional_stress', 'ziwei:annual_four_transformations:self_spouse:ji', 'annual_four_transformations', 0.18,
        placements.some(entry => entry.mutagen === '化忌' && ['命', '福徳', '夫妻'].includes(entry.palace)), `命・福徳・夫妻宮化忌`, fourTransformationsAvailable),
    ]] as const
  }))
}
