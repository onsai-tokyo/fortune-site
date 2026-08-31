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
      id: string, scoreKey: 'relationship_disruption' | 'career_activation', factLineageId: string,
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
    ]] as const
  }))
}
