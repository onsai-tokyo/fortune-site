import type { FactAxis } from './facts.js'
import type { ReportFindingV2 } from './findingsV2.js'
import type { FindingRelation } from './findingRelationsV2.js'
import type { NarrativeDomain, RelationKind } from './narrativeV2.js'

export const CHAPTER_CONTRACT = {
  'life-mission': { axes: ['drive'], domain: 'self', forbid: [] },
  'core-mind-1': { axes: ['cognition', 'expression'], domain: 'self', forbid: [] },
  'core-mind-2': { axes: ['relation'], domain: 'self', forbid: [] },
  'core-mind-3': { axes: ['shadow', 'deficit', 'tension'], domain: 'self', forbid: [] },
  'love-beginning': { axes: ['domain-love', 'relation'], domain: 'love', forbid: ['work'] },
  'love-pattern': { axes: ['domain-love', 'tension'], domain: 'love', forbid: ['work'] },
  'work-mode': { axes: ['domain-work', 'drive'], domain: 'work', forbid: ['love'] },
  'work-fit': { axes: ['domain-work', 'deficit'], domain: 'work', forbid: ['love'] },
} as const satisfies Record<string, { axes: readonly FactAxis[]; domain: NarrativeDomain; forbid: readonly string[] }>

export type ChapterId = keyof typeof CHAPTER_CONTRACT
export interface ChapterPlan { id: ChapterId; primary: ReportFindingV2 | null; support: ReportFindingV2 | null; relation: RelationKind | null; supplementCount: number }

export function assignFindingsToChaptersV2(findings: ReportFindingV2[], relations: FindingRelation[]): ChapterPlan[] {
  const plans = new Map<ChapterId, ChapterPlan>()
  const usedPrimary = new Set<string>()
  const usedFacts = new Set<string>()
  const supportUse = new Map<string, number>()
  const ordered = [...findings].sort((a, b) => Number(b.kind === 'consensus') - Number(a.kind === 'consensus') || b.confidence - a.confidence || a.id.localeCompare(b.id))
  for (const pass of [0, 1] as const) {
    for (const [id, spec] of Object.entries(CHAPTER_CONTRACT) as [ChapterId, (typeof CHAPTER_CONTRACT)[ChapterId]][]) {
      if (plans.has(id)) continue
      const allowed: readonly FactAxis[] = pass === 0 ? [spec.axes[0]] : spec.axes
      const primary = ordered.find(finding => allowed.includes(finding.axis) && !usedPrimary.has(finding.id) && finding.primaryFacts.every(factId => !usedFacts.has(factId)))
      if (!primary) continue
      const relation = relations.filter(item => item.primary === primary.id && (supportUse.get(item.support) ?? 0) < 2).sort((a, b) => b.strength - a.strength)[0]
      const support = relation ? findings.find(finding => finding.id === relation.support) ?? null : null
      plans.set(id, { id, primary, support, relation: relation?.kind ?? null, supplementCount: 0 })
      usedPrimary.add(primary.id)
      primary.primaryFacts.forEach(factId => usedFacts.add(factId))
      if (support) supportUse.set(support.id, (supportUse.get(support.id) ?? 0) + 1)
    }
  }
  return (Object.keys(CHAPTER_CONTRACT) as ChapterId[]).map(id => plans.get(id) ?? { id, primary: null, support: null, relation: null, supplementCount: 16 })
}
