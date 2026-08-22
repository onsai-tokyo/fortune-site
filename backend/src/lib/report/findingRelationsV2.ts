import type { ReportFindingV2 } from './findingsV2.js'
import type { FindingPattern, RelationKind } from './narrativeV2.js'

export interface FindingRelation {
  primary: string
  support: string
  kind: RelationKind
  strength: number
}

export function buildFindingRelationsV2(findings: ReportFindingV2[], patterns: FindingPattern[]): FindingRelation[] {
  const patternByKey = new Map(patterns.map(pattern => [pattern.key, pattern]))
  const relations: FindingRelation[] = []
  for (let leftIndex = 0; leftIndex < findings.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < findings.length; rightIndex += 1) {
      const left = findings[leftIndex]
      const right = findings[rightIndex]
      const difference = Math.abs(left.confidence - right.confidence)
      const leftPattern = patternByKey.get(left.key)
      const rightPattern = patternByKey.get(right.key)
      const opposed = left.axis === 'tension' || right.axis === 'tension' || leftPattern?.oppositions?.includes(right.key) || rightPattern?.oppositions?.includes(left.key)
      const affine = left.axis === right.axis || leftPattern?.affinities?.includes(right.key) || rightPattern?.affinities?.includes(left.key)
      let kind: RelationKind | null = null
      if (opposed && difference <= 0.3) kind = 'contradict'
      else if (affine && difference <= 0.25) kind = 'reinforce'
      else if (!opposed && !affine) kind = 'complement'
      if (!kind) continue
      relations.push({ primary: left.id, support: right.id, kind, strength: Math.max(0, 1 - difference) })
      relations.push({ primary: right.id, support: left.id, kind, strength: Math.max(0, 1 - difference) })
    }
  }
  return relations.sort((a, b) => b.strength - a.strength || a.primary.localeCompare(b.primary) || a.support.localeCompare(b.support))
}
