import { createHash } from 'crypto'
import type { ReportInput } from '../deterministicReport.js'
import type { ReportMetadata } from './metadata.js'
import { buildReportFacts, type ReportFact } from './facts.js'
import { extractAstrologyFacts, SIGN_SPEC } from './astrologyFacts.js'
import { logUnmatched, resolveNakshatra, resolveNayin, resolveSukuyo, resolveZiweiStar } from './keywordSignalMappings.js'

export type DerivationKey =
  | 'year-pillar' | 'month-pillar' | 'day-pillar' | 'hour-pillar' | 'day-stem'
  | 'lunar-date' | 'birth-time' | 'birthplace' | 'year-stem' | 'moon-longitude'
  | 'solar-longitude' | 'nine-star-cycle' | 'gregorian-digits'

export interface Derivation { key: DerivationKey; weight: number }

export type FactLineageV2 = 'shichu' | 'sanmei' | 'ziwei' | 'lunar' | 'ephemeris' | 'number'

export interface ReportFactV2 extends Omit<ReportFact, 'lineage'> {
  lineage: FactLineageV2
  derivations: Derivation[]
  canonicalSourceId: string
  votesInConsensus: boolean
}

function factId(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)
}

function makeFact(value: Omit<ReportFactV2, 'id'>): ReportFactV2 {
  return { id: factId([value.system, value.factor, value.axis, value.signal, value.canonicalSourceId]), ...value }
}

const pillarKeys: DerivationKey[] = ['year-pillar', 'month-pillar', 'day-pillar', 'hour-pillar']

function normalizedSignalPart(value: string): string {
  const readable = value.normalize('NFKC').replace(/[\s:|/]+/g, '-').replace(/[^\p{L}\p{N}\-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return readable.slice(0, 64) || createHash('sha256').update(value).digest('hex').slice(0, 12)
}

/** PR-2a: shadow V2 keys describe content, never array position. Legacy production Facts remain untouched. */
function contentBasedLegacySignal(fact: ReportFact): string {
  const contradiction = /^contradiction:\d+:([^:]+):(.+)$/.exec(fact.factor)
  if (contradiction) return `tension-${normalizedSignalPart(contradiction[1])}-${normalizedSignalPart(contradiction[2])}`
  const distortion = /^distortion:\d+:([^:]+):(.+)$/.exec(fact.factor)
  if (distortion) return `distortion-${normalizedSignalPart(distortion[1])}-${normalizedSignalPart(distortion[2])}`
  const mutagen = /^mutagen:\d+:([^:]+):([^:]+):(.+)$/.exec(fact.factor)
  if (mutagen) return `mutagen-${normalizedSignalPart(mutagen[1])}-${normalizedSignalPart(mutagen[2])}-${normalizedSignalPart(mutagen[3])}`
  return fact.signal
}

function provenanceForLegacy(fact: ReportFact): Pick<ReportFactV2, 'derivations' | 'canonicalSourceId' | 'votesInConsensus'> {
  if (fact.system === '紫微斗数') return {
    derivations: [{ key: 'lunar-date', weight: 1 }, { key: 'birth-time', weight: 1 }, { key: 'year-stem', weight: 0.4 }],
    canonicalSourceId: 'lunar-date+birth-time', votesInConsensus: true,
  }
  if (fact.system === '西洋占星術') return {
    derivations: [{ key: 'solar-longitude', weight: 1 }], canonicalSourceId: 'solar-longitude', votesInConsensus: true,
  }
  if (fact.system === '九星気学') return {
    derivations: [{ key: 'nine-star-cycle', weight: 1 }, { key: 'year-stem', weight: 0.7 }], canonicalSourceId: 'nine-star-cycle', votesInConsensus: true,
  }
  if (fact.system === '数秘術') return {
    derivations: [{ key: 'gregorian-digits', weight: 1 }], canonicalSourceId: 'gregorian-digits', votesInConsensus: true,
  }
  if (fact.system === '算命学') {
    const position = fact.factor.match(/^bodyChart:([^:]+)/)?.[1]
    const primary: DerivationKey = position === 'center' ? 'day-stem' : position === 'east' ? 'month-pillar' : 'day-pillar'
    return { derivations: [{ key: primary, weight: 1 }, ...(primary === 'day-stem' ? [{ key: 'month-pillar' as const, weight: 0.3 }] : [{ key: 'day-stem' as const, weight: 0.4 }])], canonicalSourceId: primary, votesInConsensus: true }
  }
  const pillarIndex = Number(fact.factor.match(/^pillar:(\d+)/)?.[1] ?? 2)
  const pillar = pillarKeys[pillarIndex] ?? 'day-pillar'
  return { derivations: [{ key: pillar, weight: 1 }, { key: 'day-stem', weight: pillar === 'day-pillar' ? 1 : 0.5 }], canonicalSourceId: pillar === 'day-pillar' ? 'day-stem' : pillar, votesInConsensus: true }
}

function lineageForLegacy(fact: ReportFact): FactLineageV2 {
  if (fact.system === '四柱推命') return 'shichu'
  if (fact.system === '算命学') return 'sanmei'
  if (fact.system === '紫微斗数') return 'ziwei'
  if (fact.system === '西洋占星術' || fact.system === 'インド占星術') return 'ephemeris'
  if (fact.system === '宿曜' || fact.system === '納音') return 'lunar'
  return 'number'
}

const subordinateStrength: Record<string, number> = { 天馳星: 0.55, 天極星: 0.55, 天報星: 0.6, 天胡星: 0.6, 天庫星: 0.65, 天印星: 0.65, 天恍星: 0.7, 天堂星: 0.75, 天貴星: 0.8, 天南星: 0.85, 天禄星: 0.9, 天将星: 1 }

export function buildReportFactsV2(input: ReportInput, metadata: ReportMetadata): ReportFactV2[] {
  const facts = buildReportFacts(input, metadata).map(fact => {
    const provenance = provenanceForLegacy(fact)
    const signal = contentBasedLegacySignal(fact)
    return {
      ...fact,
      id: signal === fact.signal ? fact.id : factId([fact.system, fact.factor, fact.axis, signal, provenance.canonicalSourceId]),
      signal,
      ...provenance,
      lineage: lineageForLegacy(fact),
    }
  })
  const add = (value: Omit<ReportFactV2, 'id'>) => facts.push(makeFact(value))

  const nayin = resolveNayin(input.nayin)
  if (nayin) add({ system: '納音', lineage: 'lunar', factor: `nayin:${input.nayin}`, ...nayin, polarity: 1, requiresBirthTime: false, signature: false,
    derivations: [{ key: 'year-pillar', weight: 1 }], canonicalSourceId: 'year-pillar', votesInConsensus: false })
  else logUnmatched('nayin', input.nayin)

  const sukuyo = resolveSukuyo(input.sukuyo)
  if (sukuyo) add({ system: '宿曜', lineage: 'lunar', factor: `lunarMansion:${input.sukuyo}`, ...sukuyo, polarity: 1, requiresBirthTime: false, signature: false,
    derivations: [{ key: 'lunar-date', weight: 1 }, { key: 'moon-longitude', weight: 0.6 }], canonicalSourceId: 'lunar-date', votesInConsensus: true })
  else logUnmatched('sukuyo', input.sukuyo)

  const nakshatra = input.astrology?.vedic?.moonNakshatra
  if (nakshatra) {
    const mapped = resolveNakshatra(nakshatra)
    if (mapped) add({ system: 'インド占星術', lineage: 'ephemeris', factor: `moonNakshatra:${nakshatra}:pada:${input.astrology?.vedic?.moonPada ?? ''}`, ...mapped, polarity: 1, requiresBirthTime: false, signature: false,
      derivations: [{ key: 'moon-longitude', weight: 1 }, { key: 'solar-longitude', weight: 0.3 }], canonicalSourceId: 'moon-longitude', votesInConsensus: true })
    else logUnmatched('nakshatra', nakshatra)
  }

  for (const [position, star] of Object.entries(input.sanmeiChart?.subordinateStars ?? {})) {
    add({ system: '算命学', lineage: 'sanmei', factor: `subordinate:${position}:${star.star}`, axis: 'drive', signal: 'energy-capacity', polarity: 0,
      strength: subordinateStrength[star.star] ?? 0.65, requiresBirthTime: false, signature: false,
      derivations: [{ key: 'day-stem', weight: 1 }, { key: 'month-pillar', weight: 0.4 }], canonicalSourceId: `subordinate:${position}`, votesInConsensus: true })
  }

  for (const palace of input.ziwei?.palaces ?? []) {
    for (const [index, star] of (palace.minorStars ?? []).entries()) {
      const mapped = resolveZiweiStar(star)
      if (mapped) add({ system: '紫微斗数', lineage: 'ziwei', factor: `minorStar:${palace.name}:${index}:${star}`, ...mapped,
        axis: /官禄|財帛/.test(palace.name) ? 'domain-work' : /夫妻/.test(palace.name) ? 'domain-love' : mapped.axis,
        polarity: 0, requiresBirthTime: true, signature: false,
        derivations: [{ key: 'lunar-date', weight: 1 }, { key: 'birth-time', weight: 1 }, { key: 'year-stem', weight: 0.4 }], canonicalSourceId: 'lunar-date+birth-time', votesInConsensus: true })
      else logUnmatched('ziwei-minor', star)
    }
  }

  const western = input.astrology?.western
  if (western && input.birthTime) {
    for (const [factor, point, axis] of [['ascendant', western.ascendant, 'expression'], ['midheaven', western.midheaven, 'domain-work']] as const) {
      if (!point?.sign) continue
      const mapped = SIGN_SPEC[point.sign]
      if (mapped) add({ system: '西洋占星術', lineage: 'ephemeris', factor: `${factor}:${point.sign}:${point.degree}`, axis, signal: mapped.signal, polarity: 1, strength: 0.75, requiresBirthTime: true, signature: false,
        derivations: [{ key: 'solar-longitude', weight: 0.5 }, { key: 'birth-time', weight: 1 }, { key: 'birthplace', weight: 1 }], canonicalSourceId: factor, votesInConsensus: true })
      else logUnmatched(factor, point.sign)
    }
  }

  for (const fact of extractAstrologyFacts(input)) add(fact)

  const filtered = input.birthTime ? facts : facts.filter(fact => !fact.requiresBirthTime)
  return [...new Map(filtered.map(fact => [fact.id, fact])).values()]
}

export function factV2Metrics(facts: ReportFactV2[]) {
  const lineageDistribution = facts.reduce<Record<FactLineageV2, number>>((result, fact) => { result[fact.lineage] += 1; return result }, { shichu: 0, sanmei: 0, ziwei: 0, lunar: 0, ephemeris: 0, number: 0 })
  return { factCount: facts.length, lineageDistribution, nonVotingFactCount: facts.filter(fact => !fact.votesInConsensus).length, systemCount: new Set(facts.map(fact => fact.system)).size }
}
