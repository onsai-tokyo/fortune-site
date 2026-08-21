import { createHash } from 'crypto'
import type { FactAxis, ReportFact } from './facts.js'

export interface ReportFinding {
  id: string
  key: string
  kind: 'consensus' | 'signature'
  axis: FactAxis
  confidence: number
  lineages: string[]
  primaryFacts: string[]
  supportingFacts: string[]
}

function findingId(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)
}

export function buildReportFindings(facts: ReportFact[]): ReportFinding[] {
  const signatures = facts.filter(fact => fact.signature).map((fact): ReportFinding => ({
    id: findingId(['signature', fact.id]), key: fact.signal, kind: 'signature', axis: fact.axis,
    confidence: fact.strength, lineages: [fact.lineage], primaryFacts: [fact.id], supportingFacts: [],
  }))
  const groups = new Map<string, ReportFact[]>()
  for (const fact of facts.filter(value => !value.signature)) {
    const key = `${fact.axis}:${fact.signal}`
    groups.set(key, [...(groups.get(key) ?? []), fact])
  }
  const consensus = [...groups.entries()].flatMap(([key, values]): ReportFinding[] => {
    const lineages = [...new Set(values.map(value => value.lineage))]
    if (lineages.length < 2) return []
    const ordered = [...values].sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
    const primary = lineages.map(lineage => ordered.find(fact => fact.lineage === lineage)!).filter(Boolean)
    return [{ id: findingId(['consensus', key, primary.map(fact => fact.id)]), key: key.split(':')[1], kind: 'consensus', axis: ordered[0].axis,
      confidence: Math.min(1, primary.reduce((sum, fact) => sum + fact.strength, 0) / primary.length), lineages,
      primaryFacts: primary.map(fact => fact.id), supportingFacts: ordered.filter(fact => !primary.includes(fact)).map(fact => fact.id) }]
  })
  return [...signatures, ...consensus].sort((a, b) => b.confidence - a.confidence || a.axis.localeCompare(b.axis) || a.id.localeCompare(b.id))
}
