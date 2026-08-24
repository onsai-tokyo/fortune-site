import { calcAstrology, type AstrologyProfile } from '../astrology.js'
import type { ReportInput } from '../deterministicReport.js'
import type { FactAxis } from './facts.js'
import type { ReportFactV2 } from './factsV2.js'

export type Element = 'fire' | 'earth' | 'air' | 'water'
export type Modality = 'cardinal' | 'fixed' | 'mutable'
type AspectType = 'コンジャンクション' | 'セクスタイル' | 'スクエア' | 'トライン' | 'オポジション'
type Planet = NonNullable<AstrologyProfile['western']>['planets'][number]
type FactValue = Omit<ReportFactV2, 'id'>

type PlanetSpec = {
  axis: FactAxis
  signal: string
  signalDominant: boolean
  strength: number
  requiresBirthTime: boolean
}

type SignSpec = {
  element: Element
  modality: Modality
  signal: string
  polarity: -1 | 0 | 1
  strength: number
}

export const PLANET_SPEC: Record<string, PlanetSpec> = {
  太陽: { axis: 'drive', signal: 'expression', signalDominant: false, strength: 1, requiresBirthTime: false },
  月: { axis: 'relation', signal: 'care', signalDominant: false, strength: 1, requiresBirthTime: true },
  水星: { axis: 'cognition', signal: 'communication', signalDominant: false, strength: 0.85, requiresBirthTime: false },
  金星: { axis: 'domain-love', signal: 'harmony', signalDominant: false, strength: 0.95, requiresBirthTime: false },
  火星: { axis: 'drive', signal: 'initiative', signalDominant: false, strength: 0.9, requiresBirthTime: false },
  木星: { axis: 'cognition', signal: 'exploration', signalDominant: true, strength: 0.7, requiresBirthTime: false },
  土星: { axis: 'shadow', signal: 'responsibility', signalDominant: true, strength: 0.75, requiresBirthTime: false },
  天王星: { axis: 'expression', signal: 'transformation', signalDominant: true, strength: 0.35, requiresBirthTime: false },
  海王星: { axis: 'cognition', signal: 'sensitivity', signalDominant: true, strength: 0.35, requiresBirthTime: false },
  冥王星: { axis: 'shadow', signal: 'transformation', signalDominant: true, strength: 0.35, requiresBirthTime: false },
}

export const SIGN_SPEC: Record<string, SignSpec> = {
  牡羊座: { element: 'fire', modality: 'cardinal', signal: 'initiative', polarity: 1, strength: 1 },
  牡牛座: { element: 'earth', modality: 'fixed', signal: 'stability', polarity: 1, strength: 1 },
  双子座: { element: 'air', modality: 'mutable', signal: 'communication', polarity: 1, strength: 1 },
  蟹座: { element: 'water', modality: 'cardinal', signal: 'care', polarity: 1, strength: 1 },
  獅子座: { element: 'fire', modality: 'fixed', signal: 'expression', polarity: 1, strength: 1 },
  乙女座: { element: 'earth', modality: 'mutable', signal: 'critique', polarity: 0, strength: 1 },
  天秤座: { element: 'air', modality: 'cardinal', signal: 'harmony', polarity: 1, strength: 1 },
  蠍座: { element: 'water', modality: 'fixed', signal: 'transformation', polarity: 0, strength: 1 },
  射手座: { element: 'fire', modality: 'mutable', signal: 'exploration', polarity: 1, strength: 1 },
  山羊座: { element: 'earth', modality: 'cardinal', signal: 'responsibility', polarity: 1, strength: 1 },
  水瓶座: { element: 'air', modality: 'fixed', signal: 'independence', polarity: 1, strength: 1 },
  魚座: { element: 'water', modality: 'mutable', signal: 'sensitivity', polarity: 1, strength: 1 },
}

const SIGN_ORDER = Object.keys(SIGN_SPEC)
const PERSONAL_PLANETS = new Set(['太陽', '月', '水星', '金星', '火星'])
const HARD = new Set<AspectType>(['スクエア', 'オポジション'])
const ASPECT_PATTERN = /^(.+?)と(.+?)の(コンジャンクション|セクスタイル|スクエア|トライン|オポジション)（オーブ([\d.]+)°）$/

export interface ParsedAspect { a: string; b: string; type: AspectType; orb: number }

export function parseAspect(text: string): ParsedAspect | null {
  const match = ASPECT_PATTERN.exec(text)
  if (!match) return null
  const orb = Number(match[4])
  if (!Number.isFinite(orb)) return null
  return { a: match[1], b: match[2], type: match[3] as AspectType, orb }
}

function combineSignal(planet: PlanetSpec, sign: SignSpec): string {
  return planet.signalDominant ? planet.signal : sign.signal
}

function parseBirthDate(value: string | undefined): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

function calculatedProfile(input: ReportInput, hour: number, minute: number): AstrologyProfile | undefined {
  const date = parseBirthDate(input.birthDate)
  return date ? calcAstrology(date[0], date[1], date[2], hour, minute, input.birthplace) : undefined
}

/** The Moon is safe without a birth time only when its sign agrees at both ends of the local civil day. */
export function isMoonSignStableForDay(input: ReportInput): boolean {
  const start = calculatedProfile(input, 0, 0)?.western?.planets.find(planet => planet.name === '月')?.sign
  const end = calculatedProfile(input, 23, 59)?.western?.planets.find(planet => planet.name === '月')?.sign
  return Boolean(start && end && start === end)
}

function profileForFacts(input: ReportInput): AstrologyProfile | undefined {
  if (input.astrology?.western?.planets?.length) return input.astrology as AstrologyProfile
  // The existing calculator requires a time for ASC/MC. Noon is used only to recover
  // time-independent planetary signs; ASC, MC and houses remain suppressed below.
  return calculatedProfile(input, 12, 0)
}

function placementFacts(planets: Planet[], system: '西洋占星術' | 'インド占星術', moonStable: boolean): FactValue[] {
  const vedic = system === 'インド占星術'
  return planets.flatMap(planet => {
    const planetSpec = PLANET_SPEC[planet.name]
    const signSpec = SIGN_SPEC[planet.sign]
    if (!planetSpec || !signSpec) return []
    const requiresBirthTime = planet.name === '月' ? !moonStable : planetSpec.requiresBirthTime
    return [{
      system, lineage: 'ephemeris' as const,
      factor: `${vedic ? 'vedic-' : ''}planet:${planet.name}:${planet.sign}${planet.retrograde ? ':R' : ''}`,
      axis: planetSpec.axis, signal: combineSignal(planetSpec, signSpec), polarity: signSpec.polarity,
      strength: planetSpec.strength * signSpec.strength * (vedic ? 0.7 : 1), requiresBirthTime, signature: false,
      derivations: vedic
        ? [{ key: 'solar-longitude' as const, weight: 1 }, { key: 'moon-longitude' as const, weight: 0.3 }]
        : [{ key: 'solar-longitude' as const, weight: 1 }],
      canonicalSourceId: `${vedic ? 'vedic-' : ''}planet:${planet.name}`, votesInConsensus: true,
    }]
  })
}

const ELEMENT_MAPPING: Record<Element, { axis: FactAxis; signal: string }> = {
  fire: { axis: 'drive', signal: 'initiative' }, earth: { axis: 'drive', signal: 'practicality' },
  air: { axis: 'cognition', signal: 'communication' }, water: { axis: 'relation', signal: 'sensitivity' },
}
const MODALITY_MAPPING: Record<Modality, { axis: FactAxis; signal: string }> = {
  cardinal: { axis: 'drive', signal: 'initiative' }, fixed: { axis: 'drive', signal: 'stability' },
  mutable: { axis: 'cognition', signal: 'adaptability' },
}

function balanceFacts(planets: Planet[], points: Array<{ sign?: string }>): FactValue[] {
  const signs = [...planets.map(planet => planet.sign), ...points.map(point => point.sign).filter((sign): sign is string => Boolean(sign))]
  const elements: Record<Element, number> = { fire: 0, earth: 0, air: 0, water: 0 }
  const modalities: Record<Modality, number> = { cardinal: 0, fixed: 0, mutable: 0 }
  for (const sign of signs) {
    const spec = SIGN_SPEC[sign]
    if (!spec) continue
    elements[spec.element] += 1
    modalities[spec.modality] += 1
  }
  const facts: FactValue[] = []
  for (const [element, count] of Object.entries(elements) as Array<[Element, number]>) {
    const mapped = ELEMENT_MAPPING[element]
    if (count >= 4) facts.push({ system: '西洋占星術', lineage: 'ephemeris', factor: `elementDominant:${element}:${count}`, ...mapped, polarity: 1,
      strength: 0.6 + 0.1 * Math.min(count - 4, 3), requiresBirthTime: false, signature: false,
      derivations: [{ key: 'solar-longitude', weight: 1 }], canonicalSourceId: `element:${element}`, votesInConsensus: true })
    if (count === 0) facts.push({ system: '西洋占星術', lineage: 'ephemeris', factor: `elementMissing:${element}`, axis: 'deficit', signal: mapped.signal, polarity: -1,
      strength: 0.85, requiresBirthTime: false, signature: true,
      derivations: [{ key: 'solar-longitude', weight: 1 }], canonicalSourceId: `element-missing:${element}`, votesInConsensus: true })
  }
  for (const [modality, count] of Object.entries(modalities) as Array<[Modality, number]>) {
    if (count < 4) continue
    const mapped = MODALITY_MAPPING[modality]
    facts.push({ system: '西洋占星術', lineage: 'ephemeris', factor: `modalityDominant:${modality}:${count}`, ...mapped, polarity: 1,
      strength: 0.6 + 0.1 * Math.min(count - 4, 3), requiresBirthTime: false, signature: false,
      derivations: [{ key: 'solar-longitude', weight: 1 }], canonicalSourceId: `modality:${modality}`, votesInConsensus: true })
  }
  return facts
}

function aspectKey(a: string, b: string) { return [a, b].sort((left, right) => left.localeCompare(right, 'ja')).join('-') }

const SPECIAL_ASPECTS: Record<string, { axis: FactAxis; signal: string; hardOnly?: boolean }> = {
  [aspectKey('太陽', '月')]: { axis: 'tension', signal: 'integration', hardOnly: true },
  [aspectKey('月', '火星')]: { axis: 'shadow', signal: 'transformation' },
  [aspectKey('月', '天王星')]: { axis: 'shadow', signal: 'transformation' },
  [aspectKey('月', '冥王星')]: { axis: 'shadow', signal: 'transformation' },
  [aspectKey('土星', '金星')]: { axis: 'domain-love', signal: 'responsibility', hardOnly: true },
  [aspectKey('冥王星', '金星')]: { axis: 'domain-love', signal: 'transformation' },
  [aspectKey('木星', '水星')]: { axis: 'expression', signal: 'communication' },
}

function aspectFacts(aspects: string[]): FactValue[] {
  return aspects.flatMap(text => {
    const parsed = parseAspect(text)
    if (!parsed) return [] // The legacy Fact remains the compatibility fallback.
    const specA = PLANET_SPEC[parsed.a]
    const specB = PLANET_SPEC[parsed.b]
    if (!specA || !specB || (!PERSONAL_PLANETS.has(parsed.a) && !PERSONAL_PLANETS.has(parsed.b))) return []
    const isHard = HARD.has(parsed.type)
    const special = SPECIAL_ASPECTS[aspectKey(parsed.a, parsed.b)]
    const selected = special && (!special.hardOnly || isHard) ? special : undefined
    const orbFactor = 1 - Math.min(parsed.orb / 8, 0.6)
    const personalSpec = PERSONAL_PLANETS.has(parsed.a) ? specA : specB
    return [{ system: '西洋占星術', lineage: 'ephemeris' as const,
      factor: `structuredAspect:${parsed.a}:${parsed.type}:${parsed.b}:orb${parsed.orb}`,
      axis: selected?.axis ?? (isHard ? 'tension' : personalSpec.axis),
      signal: selected?.signal ?? (isHard ? 'integration' : personalSpec.signal), polarity: isHard ? -1 : 1,
      strength: 0.9 * orbFactor * Math.min(specA.strength, specB.strength),
      requiresBirthTime: specA.requiresBirthTime || specB.requiresBirthTime,
      signature: isHard && parsed.orb <= 3,
      derivations: [{ key: 'solar-longitude' as const, weight: 1 }],
      canonicalSourceId: `aspect:${aspectKey(parsed.a, parsed.b)}`, votesInConsensus: true }]
  })
}

const HOUSE_SPEC: Partial<Record<number, { axis: FactAxis; signal: string }>> = {
  4: { axis: 'relation', signal: 'care' }, 5: { axis: 'domain-love', signal: 'expression' },
  7: { axis: 'domain-love', signal: 'harmony' }, 8: { axis: 'shadow', signal: 'transformation' },
  10: { axis: 'domain-work', signal: 'responsibility' }, 11: { axis: 'relation', signal: 'communication' },
  12: { axis: 'cognition', signal: 'insight' },
}

export function wholeSignHouse(planetSign: string, ascSign: string): number | null {
  const planetIndex = SIGN_ORDER.indexOf(planetSign)
  const ascIndex = SIGN_ORDER.indexOf(ascSign)
  return planetIndex < 0 || ascIndex < 0 ? null : ((planetIndex - ascIndex + 12) % 12) + 1
}

function houseFacts(planets: Planet[], ascSign: string | undefined, hasBirthTime: boolean): FactValue[] {
  if (!hasBirthTime || !ascSign) return []
  return planets.flatMap(planet => {
    const planetSpec = PLANET_SPEC[planet.name]
    const house = wholeSignHouse(planet.sign, ascSign)
    const spec = house === null ? undefined : HOUSE_SPEC[house]
    if (!planetSpec || house === null || !spec) return []
    // Whole-sign houses are deliberate: they remain stable under small ASC degree errors.
    return [{ system: '西洋占星術', lineage: 'ephemeris' as const, factor: `house:${house}:${planet.name}`,
      axis: spec.axis, signal: spec.signal, polarity: 0 as const, strength: 0.55 * planetSpec.strength,
      requiresBirthTime: true, signature: false,
      derivations: [{ key: 'solar-longitude' as const, weight: 0.5 }, { key: 'birth-time' as const, weight: 1 }, { key: 'birthplace' as const, weight: 1 }],
      canonicalSourceId: `house:${house}`, votesInConsensus: true }]
  })
}

export function extractAstrologyFacts(input: ReportInput): FactValue[] {
  const profile = profileForFacts(input)
  const western = profile?.western
  if (!western) return []
  const moonStable = isMoonSignStableForDay(input)
  const hasBirthTime = Boolean(input.birthTime)
  const points = hasBirthTime ? [western.ascendant, western.midheaven].filter((point): point is { sign: string; degree: number } => Boolean(point)) : []
  return [
    ...placementFacts(western.planets, '西洋占星術', moonStable),
    ...balanceFacts(western.planets, points),
    ...aspectFacts(western.aspects),
    ...houseFacts(western.planets, western.ascendant?.sign, hasBirthTime),
    ...placementFacts(profile?.vedic?.planets ?? [], 'インド占星術', moonStable),
  ]
}
