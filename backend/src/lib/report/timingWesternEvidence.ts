import type { WesternAnnualAspect } from '../astrology.js'
import type { TimingEvidenceDefinition } from './timingScoreEngine.js'

export interface WesternAnnualTimingInput {
  year: number
  /** 個人天体対象。時刻なしの正午代表値は診断用であり、Evidenceとしては利用しない。 */
  aspects: readonly WesternAnnualAspect[]
  /** 実出生時刻から算出したASC/DESC/MC/IC対象だけを渡す。 */
  angleAspects?: readonly WesternAnnualAspect[]
}

/** 第1弾カタログのうち、現在上流計算が揃っている土星×金星ハードをEvidence化する。 */
export function buildWesternTimingEvidence(
  annual: readonly WesternAnnualTimingInput[],
  options: { hasBirthTime?: boolean; personalPlanetsAvailable?: boolean } = {},
): ReadonlyMap<number, readonly TimingEvidenceDefinition[]> {
  return new Map(annual.map((item, index) => {
    const make = (
      id: string, scoreKey: 'relationship_disruption' | 'relationship_idealization' | 'career_activation',
      factLineageId: string, maximumContribution: number, transit: WesternAnnualAspect['transit'], natal: readonly string[],
      allowedAngles: readonly number[], orbLimit: number, requiresBirthTime = false,
    ): TimingEvidenceDefinition => {
      const source = requiresBirthTime ? (item.angleAspects ?? []) : item.aspects
      const best = source.filter(aspect => aspect.transit === transit
        && natal.includes(aspect.natal)
        && allowedAngles.includes(aspect.aspect)
        && Number.isFinite(aspect.orb)
        && aspect.orb >= 0
        && aspect.orb <= orbLimit).sort((left, right) => left.orb - right.orb)[0]
      const evidenceAvailable = requiresBirthTime
        ? Boolean(options.hasBirthTime) && Array.isArray(item.angleAspects)
        : Boolean(options.personalPlanetsAvailable)
      return {
        id: `${id}:${item.year}`, scoreKey, sourceFamily: 'western', technique: 'transit', factLineageId,
        correlationGroup: 'astronomical_ephemeris', available: evidenceAvailable, matched: evidenceAvailable && Boolean(best),
        support: evidenceAvailable && best ? Math.max(0, 1 - best.orb / orbLimit) : 0, maximumContribution, polarity: 1,
        detail: best ? `${transit}×${best.natal} ${best.aspect}° / orb ${best.orb.toFixed(2)}°` : undefined,
      }
    }
    const descHard = (entry: WesternAnnualTimingInput | undefined) => entry?.angleAspects?.some(aspect =>
      aspect.transit === '海王星' && aspect.natal === 'DESC' && [0, 90, 180].includes(aspect.aspect)
      && Number.isFinite(aspect.orb) && aspect.orb >= 0 && aspect.orb <= 3,
    ) ?? false
    const next = annual[index + 1]
    const hasFollowingYear = next?.year === item.year + 1
    const angleEndingObservable = Boolean(options.hasBirthTime) && hasFollowingYear
      && Array.isArray(item.angleAspects) && Array.isArray(next?.angleAspects)
    const neptuneDescEnding = angleEndingObservable && descHard(item) && !descHard(next)
    const definitions = [
      make('saturn-venus-hard', 'relationship_disruption', 'western:transit:saturn:venus_hard', 0.14, '土星', ['金星'], [0, 90, 180], 4),
      make('uranus-venus-mars-hard', 'relationship_disruption', 'western:transit:uranus:venus_mars_desc_hard', 0.16, '天王星', ['金星', '火星'], [0, 90, 180], 3),
      make('uranus-desc-hard', 'relationship_disruption', 'western:transit:uranus:venus_mars_desc_hard', 0.16, '天王星', ['DESC'], [0, 90, 180], 3, true),
      make('neptune-venus', 'relationship_disruption', 'western:transit:neptune:venus_desc', 0.12, '海王星', ['金星'], [0, 90, 180], 3),
      make('neptune-desc', 'relationship_disruption', 'western:transit:neptune:venus_desc', 0.12, '海王星', ['DESC'], [0, 90, 180], 3, true),
      make('pluto-venus', 'relationship_disruption', 'western:transit:pluto:venus_desc', 0.18, '冥王星', ['金星'], [0, 90, 180], 3),
      make('pluto-desc', 'relationship_disruption', 'western:transit:pluto:venus_desc', 0.18, '冥王星', ['DESC'], [0, 90, 180], 3, true),
      make('neptune-venus-idealization', 'relationship_idealization', 'western:transit:neptune:desc_house7lord_venus_hard', 0.24, '海王星', ['金星'], [0, 90, 180], 3),
      make('neptune-desc-idealization', 'relationship_idealization', 'western:transit:neptune:desc_house7lord_venus_hard', 0.24, '海王星', ['DESC'], [0, 90, 180], 3, true),
      {
        id: `neptune-desc-ending:${item.year}`, scoreKey: 'relationship_idealization' as const, sourceFamily: 'western' as const, technique: 'transit',
        factLineageId: 'western:transit:neptune:desc_long_term_end', correlationGroup: 'astronomical_ephemeris' as const,
        available: angleEndingObservable, matched: neptuneDescEnding,
        support: neptuneDescEnding ? 1 : 0, maximumContribution: 0.10, polarity: -1 as const,
        detail: neptuneDescEnding ? '海王星とDESCのハードアスペクトが翌年に終了' : undefined,
      },
      make('uranus-mercury', 'career_activation', 'western:transit:uranus:mc_ic_mercury_house10lord', 0.18, '天王星', ['水星'], [0, 60, 90, 120, 180], 3),
      make('uranus-mc-ic', 'career_activation', 'western:transit:uranus:mc_ic_mercury_house10lord', 0.18, '天王星', ['MC', 'IC'], [0, 60, 90, 120, 180], 3, true),
      make('pluto-mc-asc', 'career_activation', 'western:transit:pluto:mc_asc_house10lord', 0.20, '冥王星', ['MC', 'ASC'], [0, 60, 90, 120, 180], 3, true),
      make('jupiter-mercury', 'career_activation', 'western:transit:jupiter:mercury_mc_house10lord', 0.14, '木星', ['水星'], [0, 60, 120], 5),
      make('jupiter-mc', 'career_activation', 'western:transit:jupiter:mercury_mc_house10lord', 0.14, '木星', ['MC'], [0, 60, 120], 5, true),
      make('saturn-mc', 'career_activation', 'western:transit:saturn:mc_house10lord', 0.12, '土星', ['MC'], [0, 90, 180], 4, true),
    ]
    return [item.year, definitions] as const
  }))
}
