import { createHash } from 'node:crypto'

export type RelationAxis = 'attraction' | 'depth' | 'communication' | 'fun' | 'safety' | 'values' | 'growth' | 'domestic' | 'conflict' | 'repair' | 'binding'
export type SynastryKind = 'cross-aspect' | 'element' | 'stem-relation' | 'sukuyo' | 'number' | 'shared-timing'

export interface SynastryFact {
  id: string
  kind: SynastryKind
  selfFactId: string | null
  partnerFactId: string | null
  axis: RelationAxis
  signal: string
  polarity: -1 | 0 | 1
  strength: number
  requiresSelfBirthTime: boolean
  requiresPartnerBirthTime: boolean
  detail: string
}

export interface RelationScore { key: RelationAxis; value: number; confidence: number; contributingFacts: string[] }
export type CompatibilityProfileKey = 'conversational_flow'
export interface CompatibilityProfileScore { key: CompatibilityProfileKey; value: number; confidence: number; contributingFacts: string[] }
type JsonRecord = Record<string, unknown>
const record = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
const text = (value: unknown) => typeof value === 'string' ? value : ''
const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null
const id = (parts: unknown[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)

const STEM_ELEMENT: Record<string, string> = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' }
const GENERATES: Record<string, string> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' }
const CONTROLS: Record<string, string> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' }
const SIGN_INDEX: Record<string, number> = { 牡羊座: 0, Aries: 0, 牡牛座: 1, Taurus: 1, 双子座: 2, Gemini: 2, 蟹座: 3, Cancer: 3, 獅子座: 4, Leo: 4, 乙女座: 5, Virgo: 5, 天秤座: 6, Libra: 6, 蠍座: 7, Scorpio: 7, 射手座: 8, Sagittarius: 8, 山羊座: 9, Capricorn: 9, 水瓶座: 10, Aquarius: 10, 魚座: 11, Pisces: 11 }
const PLANET_NAME: Record<string, string> = { Sun: '太陽', Moon: '月', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星' }
const canonicalPlanet = (name: string) => PLANET_NAME[name] ?? name
const pairKey = (left: string, right: string) => [canonicalPlanet(left), canonicalPlanet(right)].sort().join(':')
const FLOW_PAIRS = new Set(['水星:水星', '太陽:水星', '水星:金星', '木星:水星', '天王星:水星'].map(value => value.split(':').sort().join(':')))
const DEPTH_PAIRS = new Set(['月:水星', '冥王星:水星', '月:月', '太陽:月', '月:金星', '月:冥王星'].map(value => value.split(':').sort().join(':')))

function add(result: SynastryFact[], value: Omit<SynastryFact, 'id'>) { result.push({ id: id([value.kind, value.selfFactId, value.partnerFactId, value.axis, value.signal, value.detail]), ...value }) }

function planetMap(person: JsonRecord): Map<string, number> {
  const rawPlanets = record(record(person.astrology).western).planets
  const entries: Array<[string, unknown]> = Array.isArray(rawPlanets)
    ? rawPlanets.flatMap(raw => {
      const point = record(raw)
      const name = text(point.name)
      return name ? [[name, point]] : []
    })
    : Object.entries(record(rawPlanets))
  return new Map(entries.flatMap(([name, raw]) => {
    const point = record(raw)
    const longitude = numeric(point.longitude)
    if (longitude !== null) return [[name, ((longitude % 360) + 360) % 360] as const]
    const sign = SIGN_INDEX[text(point.sign)]
    const degree = numeric(point.degree)
    return sign !== undefined && degree !== null ? [[name, sign * 30 + degree] as const] : []
  }))
}

function aspect(left: number, right: number): { name: string; polarity: -1 | 1; strength: number; axis: RelationAxis } | null {
  const distance = Math.min(Math.abs(left - right), 360 - Math.abs(left - right))
  const specs = [
    { angle: 0, orb: 8, name: 'conjunction', polarity: 1 as const, axis: 'binding' as const },
    { angle: 60, orb: 5, name: 'sextile', polarity: 1 as const, axis: 'fun' as const },
    { angle: 90, orb: 7, name: 'square', polarity: -1 as const, axis: 'conflict' as const },
    { angle: 120, orb: 7, name: 'trine', polarity: 1 as const, axis: 'safety' as const },
    { angle: 180, orb: 8, name: 'opposition', polarity: -1 as const, axis: 'growth' as const },
  ]
  const match = specs.find(item => Math.abs(distance - item.angle) <= item.orb)
  return match ? { name: match.name, polarity: match.polarity, axis: match.axis, strength: Number((1 - Math.abs(distance - match.angle) / (match.orb + 1)).toFixed(3)) } : null
}

export function buildSynastryFacts(selfValue: unknown, partnerValue: unknown): SynastryFact[] {
  const self = record(selfValue); const partner = record(partnerValue); const result: SynastryFact[] = []
  const selfStem = text(self.shichuDay)[0]; const partnerStem = text(partner.shichuDay)[0]
  const selfElement = STEM_ELEMENT[selfStem]; const partnerElement = STEM_ELEMENT[partnerStem]
  if (selfElement && partnerElement) {
    const aligned = selfElement === partnerElement
    const generating = GENERATES[selfElement] === partnerElement || GENERATES[partnerElement] === selfElement
    const controlling = CONTROLS[selfElement] === partnerElement || CONTROLS[partnerElement] === selfElement
    add(result, { kind: 'stem-relation', selfFactId: `stem:${selfStem}`, partnerFactId: `stem:${partnerStem}`, axis: aligned ? 'values' : generating ? 'growth' : controlling ? 'conflict' : 'communication', signal: aligned ? 'shared-rhythm' : generating ? 'mutual-growth' : controlling ? 'pace-friction' : 'different-language', polarity: controlling ? -1 : 1, strength: aligned ? 0.9 : generating ? 0.8 : 0.7, requiresSelfBirthTime: false, requiresPartnerBirthTime: false, detail: `${selfStem}:${partnerStem}` })
  }
  const selfNumber = numeric(self.lifePathNumber); const partnerNumber = numeric(partner.lifePathNumber)
  if (selfNumber && partnerNumber) {
    const distance = Math.abs(selfNumber - partnerNumber)
    add(result, { kind: 'number', selfFactId: `lifePath:${selfNumber}`, partnerFactId: `lifePath:${partnerNumber}`, axis: distance <= 2 ? 'fun' : 'growth', signal: distance === 0 ? 'same-tempo' : distance <= 2 ? 'near-tempo' : 'different-tempo', polarity: distance <= 2 ? 1 : 0, strength: Math.max(0.45, 0.85 - distance * 0.05), requiresSelfBirthTime: false, requiresPartnerBirthTime: false, detail: `${selfNumber}:${partnerNumber}` })
  }
  const selfSukuyo = text(self.sukuyo).replace(/宿$/, ''); const partnerSukuyo = text(partner.sukuyo).replace(/宿$/, '')
  if (selfSukuyo && partnerSukuyo) add(result, { kind: 'sukuyo', selfFactId: `sukuyo:${selfSukuyo}`, partnerFactId: `sukuyo:${partnerSukuyo}`, axis: selfSukuyo === partnerSukuyo ? 'depth' : 'repair', signal: selfSukuyo === partnerSukuyo ? 'emotional-recognition' : 'different-recovery', polarity: selfSukuyo === partnerSukuyo ? 1 : 0, strength: selfSukuyo === partnerSukuyo ? 0.85 : 0.55, requiresSelfBirthTime: false, requiresPartnerBirthTime: false, detail: `${selfSukuyo}:${partnerSukuyo}` })
  const selfPlanets = planetMap(self); const partnerPlanets = planetMap(partner)
  const relevant = new Set(['太陽', '月', '水星', '金星', '火星', '木星', '土星', '天王星', '冥王星'])
  for (const [selfName, selfLongitude] of selfPlanets) for (const [partnerName, partnerLongitude] of partnerPlanets) {
    if (!relevant.has(canonicalPlanet(selfName)) || !relevant.has(canonicalPlanet(partnerName))) continue
    const found = aspect(selfLongitude, partnerLongitude)
    if (!found) continue
    const planets = pairKey(selfName, partnerName)
    const axis: RelationAxis = FLOW_PAIRS.has(planets) ? 'communication' : DEPTH_PAIRS.has(planets) ? 'depth' : /金星|火星/.test(planets) ? 'attraction' : found.axis
    add(result, { kind: 'cross-aspect', selfFactId: `planet:${canonicalPlanet(selfName)}`, partnerFactId: `planet:${canonicalPlanet(partnerName)}`, axis, signal: `${planets.replace(':', '-')}-${found.name}`, polarity: found.polarity, strength: found.strength, requiresSelfBirthTime: false, requiresPartnerBirthTime: false, detail: `${planets}:${found.name}` })
  }
  return result.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
}

/** 相性§44。会話の流れだけを算出し、月・冥王星による深い理解とは分離する。 */
export function computeCompatibilityProfile(facts: SynastryFact[]): CompatibilityProfileScore[] {
  const contributors = facts.filter(fact => fact.kind === 'cross-aspect' && fact.axis === 'communication' && FLOW_PAIRS.has(fact.signal.split('-').slice(0, 2).sort().join(':')))
  const signed = contributors.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  return [{
    key: 'conversational_flow',
    value: Number((contributors.length ? 1 / (1 + Math.exp(-signed)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.9, contributors.length * 0.18).toFixed(3)),
    contributingFacts: contributors.map(fact => fact.id),
  }]
}

export function computeRelationScores(facts: SynastryFact[]): RelationScore[] {
  const axes: RelationAxis[] = ['attraction', 'depth', 'communication', 'fun', 'safety', 'values', 'growth', 'domestic', 'conflict', 'repair', 'binding']
  return axes.map(key => {
    const contributors = facts.filter(fact => fact.axis === key)
    const signed = contributors.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
    const value = contributors.length ? 1 / (1 + Math.exp(-signed)) : 0.5
    return { key, value: Number(value.toFixed(3)), confidence: Number(Math.min(0.95, contributors.length * 0.2 + new Set(contributors.map(fact => fact.kind)).size * 0.2).toFixed(3)), contributingFacts: contributors.map(fact => fact.id) }
  })
}
