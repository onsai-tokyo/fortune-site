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
export const COMPATIBILITY_PROFILE_KEYS = [
  'conversational_flow',
  'conversational_depth',
  'humor_compatibility',
  'friendship_compatibility',
  'domestic_compatibility',
  'novelty_compatibility',
  'shared_project_compatibility',
  'adventure_compatibility',
  'admiration_mutual',
  'pride_collision',
  'ego_competition',
  'emotional_intimacy',
  'repair_capacity',
  'forgiveness_capacity',
  'emotional_safety',
  'conflict_intensity',
  'growth_compatibility',
  'value_alignment',
] as const
export type CompatibilityProfileKey = typeof COMPATIBILITY_PROFILE_KEYS[number]
export interface CompatibilityProfileScore { key: CompatibilityProfileKey; value: number; confidence: number; contributingFacts: string[] }
interface TraitScoreInput { value: number; confidence: number; contributingFacts: string[] }
export type UnderstandingComponentKey = 'cognitive' | 'emotional' | 'deep'
export interface UnderstandingComponentScore {
  key: UnderstandingComponentKey
  value: number
  confidence: number
  contributingFacts: string[]
}
export interface MutualUnderstandingProfile {
  key: 'mutual_understanding'
  components: Record<UnderstandingComponentKey, UnderstandingComponentScore>
}
export const IMPLEMENTED_COMPATIBILITY_SCORE_KEYS = [...COMPATIBILITY_PROFILE_KEYS, 'mutual_understanding'] as const
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
const CONVERSATIONAL_DEPTH_PAIRS = new Set(['月:水星', '冥王星:水星', '月:冥王星'].map(value => value.split(':').sort().join(':')))
const HUMOR_COMPATIBILITY_PAIRS = new Set(['木星:水星', '水星:火星', '天王星:水星'].map(value => value.split(':').sort().join(':')))
const FRIENDSHIP_COMPATIBILITY_PAIRS = new Set(['水星:水星', '月:水星', '水星:金星', '木星:水星', '水星:火星', '天王星:水星'].map(value => value.split(':').sort().join(':')))
const DOMESTIC_COMPATIBILITY_PAIRS = new Set(['月:月', '月:金星', '金星:金星'].map(value => value.split(':').sort().join(':')))
const NOVELTY_COMPATIBILITY_PAIRS = new Set([
  '木星:太陽', '木星:月', '木星:水星', '木星:金星', '木星:火星',
  '天王星:太陽', '天王星:月', '天王星:水星', '天王星:金星', '天王星:火星',
].map(value => value.split(':').sort().join(':')))
const SHARED_PROJECT_COMPATIBILITY_PAIRS = new Set([
  '火星:火星', '木星:火星', '土星:火星', '木星:木星', '土星:木星', '土星:土星',
].map(value => value.split(':').sort().join(':')))
// 相性§26。同じ新体験Fact群のうち、実際の行動へつながる太陽・火星接触を強く扱う。
const ADVENTURE_COMPATIBILITY_PAIRS = new Set([
  '木星:太陽', '木星:火星', '天王星:太陽', '天王星:火星',
].map(value => value.split(':').sort().join(':')))
// 相性§27・§33。職業・役職入力は推測せず、相手の核と行動を支える接触だけを部分算出する。
const ADMIRATION_MUTUAL_PAIRS = new Set([
  '木星:太陽', '土星:太陽', '木星:火星', '土星:火星',
].map(value => value.split(':').sort().join(':')))
const PRIDE_COLLISION_PAIRS = new Set([
  '太陽:火星', '火星:火星', '太陽:太陽', '月:月',
].map(value => value.split(':').sort().join(':')))
const EMOTIONAL_INTIMACY_PAIRS = new Set(['月:月', '太陽:月', '月:水星', '月:金星'].map(value => value.split(':').sort().join(':')))
const REPAIR_CAPACITY_PAIRS = new Set(['木星:月', '木星:金星', '木星:水星', '月:金星'].map(value => value.split(':').sort().join(':')))
const FORGIVENESS_CAPACITY_PAIRS = new Set(['木星:月', '木星:金星', '木星:水星'].map(value => value.split(':').sort().join(':')))
const EMOTIONAL_SAFETY_PAIRS = new Set(['月:月', '太陽:月', '月:金星', '木星:月'].map(value => value.split(':').sort().join(':')))
const CONFLICT_INTENSITY_PAIRS = new Set(['太陽:火星', '火星:火星', '水星:火星', '月:火星'].map(value => value.split(':').sort().join(':')))
const GROWTH_COMPATIBILITY_PAIRS = new Set(['木星:太陽', '木星:月', '木星:水星', '木星:火星'].map(value => value.split(':').sort().join(':')))
const VALUE_ALIGNMENT_PAIRS = new Set(['太陽:太陽', '太陽:金星', '金星:金星'].map(value => value.split(':').sort().join(':')))
const COGNITIVE_UNDERSTANDING_PAIRS = new Set(['水星:水星', '太陽:水星'].map(value => value.split(':').sort().join(':')))
const EMOTIONAL_UNDERSTANDING_PAIRS = new Set(['月:水星', '月:月', '月:金星'].map(value => value.split(':').sort().join(':')))
const DEEP_UNDERSTANDING_PAIRS = new Set(['月:冥王星', '冥王星:水星'].map(value => value.split(':').sort().join(':')))

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
  // 正式な27宿×27宿の関係表が未収録のため、異なる宿を栄親・安壊等へ推測分類しない。
  // 同一宿だけは入力から直接確定できる事実として保持する。
  if (selfSukuyo && partnerSukuyo && selfSukuyo === partnerSukuyo) add(result, {
    kind: 'sukuyo', selfFactId: `sukuyo:${selfSukuyo}`, partnerFactId: `sukuyo:${partnerSukuyo}`,
    axis: 'depth', signal: 'same-mansion', polarity: 1, strength: 0.85,
    requiresSelfBirthTime: false, requiresPartnerBirthTime: false, detail: `${selfSukuyo}:${partnerSukuyo}`,
  })
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
export function computeCompatibilityProfile(facts: SynastryFact[], birthTimeKnown = { self: false, partner: false }): CompatibilityProfileScore[] {
  const pairFromSignal = (fact: SynastryFact) => fact.signal.split('-').slice(0, 2).sort().join(':')
  const conversation = facts.filter(fact => fact.kind === 'cross-aspect' && fact.axis === 'communication' && FLOW_PAIRS.has(pairFromSignal(fact)))
  const conversationSigned = conversation.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const conversationDepth = facts.filter(fact => fact.kind === 'cross-aspect' && fact.axis === 'depth' && CONVERSATIONAL_DEPTH_PAIRS.has(pairFromSignal(fact)))
  const conversationDepthSigned = conversationDepth.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const conversationDepthHasMoon = conversationDepth.some(fact => pairFromSignal(fact).includes('月'))
  const humor = facts.filter(fact => fact.kind === 'cross-aspect' && HUMOR_COMPATIBILITY_PAIRS.has(pairFromSignal(fact)))
  const humorSigned = humor.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const friendship = facts.filter(fact => fact.kind === 'cross-aspect' && FRIENDSHIP_COMPATIBILITY_PAIRS.has(pairFromSignal(fact)))
  const friendshipSigned = friendship.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const friendshipHasMoon = friendship.some(fact => pairFromSignal(fact).includes('月'))
  const domestic = facts.filter(fact => fact.kind === 'cross-aspect' && DOMESTIC_COMPATIBILITY_PAIRS.has(pairFromSignal(fact)))
  const domesticSigned = domestic.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const domesticHasMoon = domestic.some(fact => pairFromSignal(fact).includes('月'))
  const novelty = facts.filter(fact => fact.kind === 'cross-aspect' && NOVELTY_COMPATIBILITY_PAIRS.has(pairFromSignal(fact)))
  const noveltySigned = novelty.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const noveltyHasMoon = novelty.some(fact => pairFromSignal(fact).includes('月'))
  const sharedProject = facts.filter(fact => fact.kind === 'cross-aspect' && SHARED_PROJECT_COMPATIBILITY_PAIRS.has(pairFromSignal(fact)))
  const sharedProjectSigned = sharedProject.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const adventure = facts.filter(fact => fact.kind === 'cross-aspect' && ADVENTURE_COMPATIBILITY_PAIRS.has(pairFromSignal(fact)))
  const adventureSigned = adventure.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const admiration = facts.filter(fact => fact.kind === 'cross-aspect' && ADMIRATION_MUTUAL_PAIRS.has(pairFromSignal(fact)))
  const admirationSigned = admiration.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const pride = facts.filter(fact => fact.kind === 'cross-aspect'
    && PRIDE_COLLISION_PAIRS.has(pairFromSignal(fact))
    && /-(square|opposition)$/.test(fact.signal))
  const prideStrength = pride.reduce((sum, fact) => sum + fact.strength, 0)
  const prideHasMoon = pride.some(fact => pairFromSignal(fact).includes('月'))
  const emotional = facts.filter(fact => fact.kind === 'cross-aspect' && fact.axis === 'depth' && EMOTIONAL_INTIMACY_PAIRS.has(pairFromSignal(fact)))
  const emotionalSigned = emotional.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const repair = facts.filter(fact => fact.kind === 'cross-aspect' && REPAIR_CAPACITY_PAIRS.has(pairFromSignal(fact)))
  const repairSigned = repair.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const forgiveness = facts.filter(fact => fact.kind === 'cross-aspect' && FORGIVENESS_CAPACITY_PAIRS.has(pairFromSignal(fact)))
  const forgivenessSigned = forgiveness.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const safety = facts.filter(fact => fact.kind === 'cross-aspect' && EMOTIONAL_SAFETY_PAIRS.has(pairFromSignal(fact)))
  const safetySigned = safety.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const conflict = facts.filter(fact => fact.kind === 'cross-aspect'
    && CONFLICT_INTENSITY_PAIRS.has(pairFromSignal(fact))
    && /-(square|opposition)$/.test(fact.signal))
  const conflictStrength = conflict.reduce((sum, fact) => sum + fact.strength, 0)
  const conflictHasMoon = conflict.some(fact => pairFromSignal(fact).includes('月'))
  const growth = facts.filter(fact => fact.kind === 'cross-aspect' && GROWTH_COMPATIBILITY_PAIRS.has(pairFromSignal(fact)))
  const growthSigned = growth.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const growthHasMoon = growth.some(fact => pairFromSignal(fact).includes('月'))
  const values = facts.filter(fact => fact.kind === 'cross-aspect' && VALUE_ALIGNMENT_PAIRS.has(pairFromSignal(fact)))
  const valuesSigned = values.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
  const timeConfidenceFactor = birthTimeKnown.self && birthTimeKnown.partner ? 1 : birthTimeKnown.self || birthTimeKnown.partner ? 0.75 : 0.55
  return [{
    key: 'conversational_flow',
    value: Number((conversation.length ? 1 / (1 + Math.exp(-conversationSigned)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.9, conversation.length * 0.18).toFixed(3)),
    contributingFacts: conversation.map(fact => fact.id),
  }, {
    key: 'conversational_depth',
    value: Number((conversationDepth.length ? 1 / (1 + Math.exp(-conversationDepthSigned)) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.8, conversationDepth.length * 0.18) * (conversationDepthHasMoon ? timeConfidenceFactor : 1)).toFixed(3)),
    contributingFacts: conversationDepth.map(fact => fact.id),
  }, {
    key: 'humor_compatibility',
    value: Number((humor.length ? 1 / (1 + Math.exp(-humorSigned)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.75, humor.length * 0.18).toFixed(3)),
    contributingFacts: humor.map(fact => fact.id),
  }, {
    key: 'friendship_compatibility',
    value: Number((friendship.length ? 1 / (1 + Math.exp(-friendshipSigned)) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.8, friendship.length * 0.15) * (friendshipHasMoon ? timeConfidenceFactor : 1)).toFixed(3)),
    contributingFacts: [...new Set(friendship.map(fact => fact.id))],
  }, {
    key: 'domestic_compatibility',
    value: Number((domestic.length ? 1 / (1 + Math.exp(-domesticSigned)) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.8, domestic.length * 0.2) * (domesticHasMoon ? timeConfidenceFactor : 1)).toFixed(3)),
    contributingFacts: [...new Set(domestic.map(fact => fact.id))],
  }, {
    key: 'novelty_compatibility',
    value: Number((novelty.length ? 1 / (1 + Math.exp(-noveltySigned)) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.8, novelty.length * 0.16) * (noveltyHasMoon ? timeConfidenceFactor : 1)).toFixed(3)),
    contributingFacts: [...new Set(novelty.map(fact => fact.id))],
  }, {
    key: 'shared_project_compatibility',
    value: Number((sharedProject.length ? 1 / (1 + Math.exp(-sharedProjectSigned)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.8, sharedProject.length * 0.16).toFixed(3)),
    contributingFacts: [...new Set(sharedProject.map(fact => fact.id))],
  }, {
    key: 'adventure_compatibility',
    value: Number((adventure.length ? 1 / (1 + Math.exp(-adventureSigned)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.75, adventure.length * 0.18).toFixed(3)),
    contributingFacts: [...new Set(adventure.map(fact => fact.id))],
  }, {
    key: 'admiration_mutual',
    value: Number((admiration.length ? 1 / (1 + Math.exp(-admirationSigned)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.65, admiration.length * 0.16).toFixed(3)),
    contributingFacts: [...new Set(admiration.map(fact => fact.id))],
  }, {
    key: 'pride_collision',
    value: Number((pride.length ? 1 - Math.exp(-prideStrength) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.75, pride.length * 0.18) * (prideHasMoon ? timeConfidenceFactor : 1)).toFixed(3)),
    contributingFacts: [...new Set(pride.map(fact => fact.id))],
  }, {
    key: 'emotional_intimacy',
    value: Number((emotional.length ? 1 / (1 + Math.exp(-emotionalSigned)) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.85, emotional.length * 0.18) * timeConfidenceFactor).toFixed(3)),
    contributingFacts: emotional.map(fact => fact.id),
  }, {
    key: 'repair_capacity',
    value: Number((repair.length ? 1 / (1 + Math.exp(-repairSigned)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.85, repair.length * 0.18).toFixed(3)),
    contributingFacts: repair.map(fact => fact.id),
  }, {
    key: 'forgiveness_capacity',
    value: Number((forgiveness.length ? 1 / (1 + Math.exp(-forgivenessSigned)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.75, forgiveness.length * 0.18).toFixed(3)),
    contributingFacts: forgiveness.map(fact => fact.id),
  }, {
    key: 'emotional_safety',
    value: Number((safety.length ? 1 / (1 + Math.exp(-safetySigned)) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.85, safety.length * 0.18) * timeConfidenceFactor).toFixed(3)),
    contributingFacts: safety.map(fact => fact.id),
  }, {
    key: 'conflict_intensity',
    value: Number((conflict.length ? 1 - Math.exp(-conflictStrength) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.7, conflict.length * 0.16) * (conflictHasMoon ? timeConfidenceFactor : 1)).toFixed(3)),
    contributingFacts: conflict.map(fact => fact.id),
  }, {
    key: 'growth_compatibility',
    value: Number((growth.length ? 1 / (1 + Math.exp(-growthSigned)) : 0.5).toFixed(3)),
    confidence: Number((Math.min(0.7, growth.length * 0.16) * (growthHasMoon ? timeConfidenceFactor : 1)).toFixed(3)),
    contributingFacts: growth.map(fact => fact.id),
  }, {
    key: 'value_alignment',
    value: Number((values.length ? 1 / (1 + Math.exp(-valuesSigned)) : 0.5).toFixed(3)),
    confidence: Number(Math.min(0.65, values.length * 0.16).toFixed(3)),
    contributingFacts: values.map(fact => fact.id),
  }]
}

/** 相性§4・§5・§19。占術Factを再加算せず、双方の個人Traitの積から競争性を派生する。 */
export function computeEgoCompetitionProfile(
  self: { pride_sensitivity: TraitScoreInput; status_attraction: TraitScoreInput },
  partner: { pride_sensitivity: TraitScoreInput; status_attraction: TraitScoreInput },
): CompatibilityProfileScore {
  const inputs = [self.pride_sensitivity, partner.pride_sensitivity, self.status_attraction, partner.status_attraction]
  const hasEvidence = inputs.every(score => score.confidence > 0)
  const value = hasEvidence
    ? (self.pride_sensitivity.value * partner.pride_sensitivity.value
      + self.status_attraction.value * partner.status_attraction.value) / 2
    : 0.5
  return {
    key: 'ego_competition',
    value: Number(value.toFixed(3)),
    confidence: hasEvidence ? Number(Math.min(...inputs.map(score => score.confidence)).toFixed(3)) : 0,
    contributingFacts: hasEvidence ? [...new Set(inputs.flatMap(score => score.contributingFacts))] : [],
  }
}

/** 相性§52。認知・感情・深層の理解を平均せず、3成分のまま保持する。 */
export function computeMutualUnderstanding(
  facts: SynastryFact[],
  birthTimeKnown = { self: false, partner: false },
): MutualUnderstandingProfile {
  const pairFromSignal = (fact: SynastryFact) => fact.signal.split('-').slice(0, 2).sort().join(':')
  const timeConfidenceFactor = birthTimeKnown.self && birthTimeKnown.partner ? 1 : birthTimeKnown.self || birthTimeKnown.partner ? 0.75 : 0.55
  const component = (
    key: UnderstandingComponentKey,
    pairs: Set<string>,
    usesMoon: boolean,
  ): UnderstandingComponentScore => {
    const contributors = facts.filter(fact => fact.kind === 'cross-aspect' && pairs.has(pairFromSignal(fact)))
    const signed = contributors.reduce((sum, fact) => sum + fact.strength * fact.polarity, 0)
    return {
      key,
      value: Number((contributors.length ? 1 / (1 + Math.exp(-signed)) : 0.5).toFixed(3)),
      confidence: Number((Math.min(0.8, contributors.length * 0.18) * (usesMoon ? timeConfidenceFactor : 1)).toFixed(3)),
      contributingFacts: contributors.map(fact => fact.id),
    }
  }
  return {
    key: 'mutual_understanding',
    components: {
      cognitive: component('cognitive', COGNITIVE_UNDERSTANDING_PAIRS, false),
      emotional: component('emotional', EMOTIONAL_UNDERSTANDING_PAIRS, true),
      deep: component('deep', DEEP_UNDERSTANDING_PAIRS, true),
    },
  }
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
