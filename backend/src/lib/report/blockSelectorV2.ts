import { createHash } from 'crypto'
import type { ReportFindingV2 } from './findingsV2.js'
import type { NarrativeBlock, PageRole, RelationshipType } from './narrativeV2.js'
import type { ReportMetadata } from './metadata.js'

export interface BlockSelectionContext {
  primary: ReportFindingV2
  support?: ReportFindingV2 | null
  role: PageRole
  domain: NarrativeBlock['domain']
  birthTimeAvailable: boolean
  lifeStage: ReportMetadata['lifeStage']
  relationshipType?: RelationshipType
  seed: string
  usedBlockIds?: ReadonlySet<string>
}

function matches(block: NarrativeBlock, context: BlockSelectionContext): boolean {
  if (block.role !== context.role || block.domain !== context.domain || block.axis !== context.primary.axis) return false
  if (block.patternKey !== null && block.patternKey !== context.primary.key) return false
  const condition = block.when
  if (!condition) return true
  if (condition.findingKind && !condition.findingKind.includes(context.primary.kind)) return false
  if (condition.minConfidence !== undefined && context.primary.confidence < condition.minConfidence) return false
  if (condition.maxConfidence !== undefined && context.primary.confidence > condition.maxConfidence) return false
  if (condition.minLineageCount !== undefined && context.primary.lineages.length < condition.minLineageCount) return false
  if (condition.minIndependence !== undefined && context.primary.independence < condition.minIndependence) return false
  if (condition.requiresBirthTime !== undefined && context.birthTimeAvailable !== condition.requiresBirthTime) return false
  if (condition.lifeStage && !condition.lifeStage.includes(context.lifeStage)) return false
  if (condition.relationshipTypes && (!context.relationshipType || !condition.relationshipTypes.includes(context.relationshipType))) return false
  if (condition.withSupport && (!context.support || !condition.withSupport.includes(context.support.key))) return false
  if (condition.withoutSupport?.includes(context.support?.key ?? '')) return false
  return true
}

export function selectNarrativeBlock(blocks: NarrativeBlock[], context: BlockSelectionContext): NarrativeBlock | null {
  const candidates = blocks.filter(block => matches(block, context) && !context.usedBlockIds?.has(block.id)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  if (!candidates.length) return null
  const topPriority = candidates[0].priority
  const top = candidates.filter(block => block.priority === topPriority)
  const digest = createHash('sha256').update(`${context.seed}:${context.primary.id}:${context.role}`).digest()
  return top[digest.readUInt32BE(0) % top.length]
}
