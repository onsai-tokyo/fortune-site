import { createHash } from 'crypto'
import type { ReportInput } from '../deterministicReport.js'
import type { ReportMetadata } from './metadata.js'

export type FactAxis = 'drive' | 'cognition' | 'relation' | 'expression' | 'shadow' | 'deficit' | 'tension' | 'domain-work' | 'domain-love' | 'timing'
export type FactLineage = 'stems' | 'ephemeris' | 'number' | 'lunar'

export interface ReportFact {
  id: string
  system: string
  lineage: FactLineage
  factor: string
  axis: FactAxis
  signal: string
  polarity: -1 | 0 | 1
  strength: number
  requiresBirthTime: boolean
  signature: boolean
}

function factId(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)
}

function makeFact(value: Omit<ReportFact, 'id'>): ReportFact {
  return { id: factId([value.system, value.factor, value.axis, value.signal]), ...value }
}

const tenGodSignals: Record<string, { axis: FactAxis; signal: string }> = {
  比肩: { axis: 'drive', signal: 'independence' }, 劫財: { axis: 'relation', signal: 'competition' },
  食神: { axis: 'expression', signal: 'expression' }, 傷官: { axis: 'expression', signal: 'critique' },
  偏財: { axis: 'relation', signal: 'adaptability' }, 正財: { axis: 'domain-work', signal: 'practicality' },
  偏官: { axis: 'drive', signal: 'initiative' }, 正官: { axis: 'domain-work', signal: 'responsibility' },
  偏印: { axis: 'cognition', signal: 'insight' }, 印綬: { axis: 'cognition', signal: 'learning' },
}
const sanmeiSignals: Record<string, { axis: FactAxis; signal: string }> = {
  貫索星: { axis: 'drive', signal: 'independence' }, 石門星: { axis: 'relation', signal: 'harmony' },
  鳳閣星: { axis: 'expression', signal: 'expression' }, 調舒星: { axis: 'expression', signal: 'sensitivity' },
  禄存星: { axis: 'relation', signal: 'care' }, 司禄星: { axis: 'domain-work', signal: 'stability' },
  車騎星: { axis: 'drive', signal: 'initiative' }, 牽牛星: { axis: 'domain-work', signal: 'responsibility' },
  龍高星: { axis: 'cognition', signal: 'exploration' }, 玉堂星: { axis: 'cognition', signal: 'learning' },
}
const ziweiStarSignals: Record<string, string> = {
  紫微: 'responsibility', 天府: 'stability', 武曲: 'practicality', 天相: 'harmony',
  天機: 'insight', 巨門: 'communication', 太陽: 'expression', 太陰: 'sensitivity',
  七殺: 'initiative', 破軍: 'transformation', 廉貞: 'independence', 貪狼: 'exploration',
}

function palaceAxis(name: string): FactAxis {
  if (/官禄|財帛/.test(name)) return 'domain-work'
  if (/夫妻/.test(name)) return 'domain-love'
  if (/交友|兄弟|父母/.test(name)) return 'relation'
  return 'drive'
}

export function buildReportFacts(input: ReportInput, metadata: ReportMetadata): ReportFact[] {
  const facts: ReportFact[] = []
  const add = (value: Omit<ReportFact, 'id'>) => facts.push(makeFact(value))
  for (const [pillarIndex, pillar] of (input.fourPillars ?? []).entries()) {
    const values = [pillar.stemTenGod, ...pillar.hiddenStems.map(item => item.tenGod)]
    for (const [index, tenGod] of values.entries()) {
      const mapped = tenGodSignals[tenGod]
      if (mapped) add({ system: '四柱推命', lineage: 'stems', factor: `pillar:${pillarIndex}:tenGod:${index}:${tenGod}`, ...mapped, polarity: 1, strength: index === 0 ? 1 : 0.65, requiresBirthTime: pillarIndex === 3, signature: false })
    }
  }
  for (const [position, star] of Object.entries(input.sanmeiChart?.bodyChart ?? {})) {
    const mapped = sanmeiSignals[star.star]
    if (mapped) add({ system: '算命学', lineage: 'stems', factor: `bodyChart:${position}:${star.star}`, ...mapped, polarity: 1, strength: position === 'center' ? 1 : 0.75, requiresBirthTime: false, signature: false })
  }
  for (const palace of input.ziwei?.palaces ?? []) {
    for (const star of palace.majorStars) {
      add({ system: '紫微斗数', lineage: 'stems', factor: `palace:${palace.name}:${star.name}:${star.mutagen}`, axis: palaceAxis(palace.name), signal: ziweiStarSignals[star.name] ?? 'domain-emphasis', polarity: /化忌/.test(star.mutagen) ? -1 : 1, strength: star.mutagen && !/なし/.test(star.mutagen) ? 1 : 0.7, requiresBirthTime: true, signature: false })
    }
  }
  for (const [index, aspect] of (input.astrology?.western?.aspects ?? []).entries()) {
    add({ system: '西洋占星術', lineage: 'ephemeris', factor: `aspect:${index}:${aspect}`, axis: /スクエア|オポジション|square|opposition|90°|180°/i.test(aspect) ? 'tension' : 'cognition', signal: /水星|Mercury/i.test(aspect) ? 'communication' : 'integration', polarity: /スクエア|オポジション|square|opposition|90°|180°/i.test(aspect) ? -1 : 1, strength: 0.8, requiresBirthTime: false, signature: false })
  }
  const kyuseiSignal = /一白|四緑|七赤/.test(input.honmeiName) ? 'communication' : /三碧|九紫/.test(input.honmeiName) ? 'expression' : /二黒|五黄|六白|八白/.test(input.honmeiName) ? 'responsibility' : 'stability'
  add({ system: '九星気学', lineage: 'number', factor: `yearStar:${input.honmeiName}`, axis: kyuseiSignal === 'communication' ? 'relation' : 'drive', signal: kyuseiSignal, polarity: 1, strength: 0.75, requiresBirthTime: false, signature: false })
  add({ system: '数秘術', lineage: 'number', factor: `lifePath:${input.lifePathNumber}`, axis: 'drive', signal: [3, 5, 11].includes(input.lifePathNumber) ? 'expression' : [2, 6, 9, 33].includes(input.lifePathNumber) ? 'care' : [4, 8, 22].includes(input.lifePathNumber) ? 'responsibility' : 'independence', polarity: 1, strength: 0.7, requiresBirthTime: false, signature: false })
  for (const item of metadata.missingElements) add({ system: '四柱推命', lineage: 'stems', factor: `missingElement:${item.element}:${item.score}`, axis: 'deficit', signal: `missing-${item.element}`, polarity: -1, strength: item.severity === 'missing' ? 1 : 0.8, requiresBirthTime: false, signature: true })
  for (const [index, item] of metadata.contradictions.entries()) add({ system: item.source === 'astrology' ? '西洋占星術' : '四柱推命', lineage: item.source === 'astrology' ? 'ephemeris' : 'stems', factor: `contradiction:${index}:${item.source}:${item.detail}`, axis: 'tension', signal: `tension-${item.source}-${index}`, polarity: -1, strength: 0.9, requiresBirthTime: false, signature: true })
  for (const [index, item] of metadata.relationshipDistortions.entries()) add({ system: '算命学', lineage: 'stems', factor: `distortion:${index}:${item.relation}:${item.pillars}`, axis: 'shadow', signal: `distortion-${item.relation}`, polarity: -1, strength: 1, requiresBirthTime: false, signature: true })
  for (const [index, item] of metadata.domainHighlights.entries()) add({ system: '紫微斗数', lineage: 'stems', factor: `mutagen:${index}:${item.palace}:${item.star}:${item.mutagen}`, axis: palaceAxis(item.palace), signal: `mutagen-${item.mutagen}`, polarity: /化忌/.test(item.mutagen) ? -1 : 1, strength: 1, requiresBirthTime: true, signature: true })
  return [...new Map(facts.map(fact => [fact.id, fact])).values()]
}
