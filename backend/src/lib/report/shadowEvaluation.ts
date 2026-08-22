import type { FactAxis } from './facts.js'
import type { ReportFindingV2 } from './findingsV2.js'

const chapterAxes: readonly (readonly FactAxis[])[] = [
  ['drive'], ['cognition', 'expression'], ['relation'], ['shadow', 'deficit', 'tension'],
  ['domain-love', 'relation'], ['domain-love', 'tension'], ['domain-work', 'drive'], ['domain-work', 'deficit'],
]

export function median(values: number[]): number | null {
  if (!values.length) return null
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

export function assignableChapterCount(findings: ReportFindingV2[]): number {
  const assigned = new Set<number>()
  const usedFindings = new Set<string>()
  const usedFacts = new Set<string>()
  const ordered = [...findings].sort((a, b) => Number(b.kind === 'consensus') - Number(a.kind === 'consensus') || b.confidence - a.confidence || a.id.localeCompare(b.id))
  for (const pass of [0, 1] as const) {
    for (const [index, axes] of chapterAxes.entries()) {
      if (assigned.has(index)) continue
      const allowed = pass === 0 ? [axes[0]] : axes
      const finding = ordered.find(item => allowed.includes(item.axis) && !usedFindings.has(item.id) && item.primaryFacts.every(id => !usedFacts.has(id)))
      if (!finding) continue
      assigned.add(index)
      usedFindings.add(finding.id)
      finding.primaryFacts.forEach(id => usedFacts.add(id))
    }
  }
  return assigned.size
}
