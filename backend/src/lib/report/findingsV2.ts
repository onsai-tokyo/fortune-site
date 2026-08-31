import { createHash } from 'crypto'
import type { FactAxis } from './facts.js'
import type { Derivation, FactLineageV2, ReportFactV2 } from './factsV2.js'

export interface ReportFindingV2 {
  id: string
  key: string
  kind: 'consensus' | 'signature'
  axis: FactAxis
  confidence: number
  lineages: FactLineageV2[]
  systems: string[]
  independence: number
  primaryFacts: string[]
  supportingFacts: string[]
}

function findingId(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)
}

export function weightedDerivationOverlap(left: Derivation[], right: Derivation[]): number {
  const leftWeights = new Map(left.map(item => [item.key, item.weight]))
  const rightWeights = new Map(right.map(item => [item.key, item.weight]))
  const overlap = [...leftWeights].reduce((sum, [key, weight]) => sum + Math.min(weight, rightWeights.get(key) ?? 0), 0)
  const denominator = Math.min(
    [...leftWeights.values()].reduce((sum, weight) => sum + weight, 0),
    [...rightWeights.values()].reduce((sum, weight) => sum + weight, 0),
  )
  return denominator > 0 ? overlap / denominator : 0
}

export function factsShareSource(left: ReportFactV2, right: ReportFactV2): boolean {
  return left.canonicalSourceId === right.canonicalSourceId || weightedDerivationOverlap(left.derivations, right.derivations) >= 0.7
}

function consolidateVotes(facts: ReportFactV2[]): ReportFactV2[][] {
  const clusters: ReportFactV2[][] = []
  for (const fact of [...facts].sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))) {
    const matches = clusters.filter(cluster => cluster.some(existing => factsShareSource(existing, fact)))
    if (matches.length === 0) {
      clusters.push([fact])
      continue
    }
    const merged = [fact, ...matches.flat()]
    for (const match of matches) clusters.splice(clusters.indexOf(match), 1)
    clusters.push(merged.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id)))
  }
  return clusters
}

export function buildReportFindingsV2(facts: ReportFactV2[]): ReportFindingV2[] {
  const signatures = facts.filter(fact => fact.signature).map((fact): ReportFindingV2 => ({
    id: findingId(['signature-v2', fact.id]), key: fact.signal, kind: 'signature', axis: fact.axis,
    confidence: Math.min(0.95, fact.strength), lineages: [fact.lineage], systems: [fact.system], independence: 1,
    primaryFacts: [fact.id], supportingFacts: [],
  }))

  const groups = new Map<string, ReportFactV2[]>()
  for (const fact of facts.filter(value => !value.signature && value.votesInConsensus)) {
    const key = `${fact.axis}:${fact.signal}`
    groups.set(key, [...(groups.get(key) ?? []), fact])
  }

  const consensus = [...groups.entries()].flatMap(([groupKey, values]): ReportFindingV2[] => {
    const clusters = consolidateVotes(values)
    const representatives = clusters.map(cluster => cluster[0])
    const lineages = [...new Set(representatives.map(fact => fact.lineage))]
    if (lineages.length < 2) return []
    const systems = [...new Set(values.map(fact => fact.system))].sort()
    const independence = clusters.length / values.length
    const base = representatives.reduce((sum, fact) => sum + fact.strength, 0) / representatives.length
    const lineageGain = 0.1 * Math.max(0, lineages.length - 2)
    const systemGain = 0.05 * Math.max(0, systems.length - 2)
    const confidence = Math.min(0.95, (base + lineageGain + systemGain) * (0.7 + 0.3 * independence))
    const primaryFacts = representatives.map(fact => fact.id)
    return [{
      id: findingId(['consensus-v2', groupKey, primaryFacts]), key: groupKey.split(':')[1], kind: 'consensus', axis: values[0].axis,
      confidence, lineages, systems, independence, primaryFacts,
      supportingFacts: values.filter(fact => !primaryFacts.includes(fact.id)).map(fact => fact.id),
    }]
  })

  return [...signatures, ...consensus].sort((a, b) => b.confidence - a.confidence || a.axis.localeCompare(b.axis) || a.id.localeCompare(b.id))
}

export function findingV2Metrics(findings: ReportFindingV2[]) {
  const consensus = findings.filter(finding => finding.kind === 'consensus')
  return {
    findingCount: findings.length,
    consensusCount: consensus.length,
    signatureCount: findings.length - consensus.length,
    averageIndependence: consensus.length ? consensus.reduce((sum, finding) => sum + finding.independence, 0) / consensus.length : null,
    averageConfidence: findings.length ? findings.reduce((sum, finding) => sum + finding.confidence, 0) / findings.length : null,
  }
}
