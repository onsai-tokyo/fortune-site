import type { FactAxis } from './facts.js'
import type { ReportMetadata } from './metadata.js'

export type MeaningAxis = FactAxis
export type NarrativeDomain = 'self' | 'love' | 'work' | 'timing' | 'compatibility'
export type RelationshipType = 'romantic' | 'friend' | 'family' | 'crush' | 'dating' | 'married' | 'ex'
export type PageRole = 'opening' | 'core' | 'cause' | 'scene' | 'inner' | 'strength' | 'shadow' | 'conflict' | 'exception' | 'relation' | 'love' | 'work' | 'change' | 'question' | 'action' | 'closing' | 'supplement'

export interface FindingPattern {
  key: string
  axis: MeaningAxis
  trait: string
  coreAssertion: string
  strengthFraming: string
  shadowFraming: string
  affinities?: string[]
  oppositions?: string[]
  semanticTags: string[]
}

export interface BlockCondition {
  findingKind?: ('consensus' | 'signature')[]
  minConfidence?: number
  maxConfidence?: number
  minLineageCount?: number
  minIndependence?: number
  requiresBirthTime?: boolean
  withSupport?: string[]
  withoutSupport?: string[]
  lifeStage?: ReportMetadata['lifeStage'][]
  relationshipTypes?: RelationshipType[]
}

export interface NarrativeBlock {
  id: string
  patternKey: string | null
  axis: MeaningAxis
  role: PageRole
  domain: NarrativeDomain
  text: string
  when?: BlockCondition
  semanticFingerprint: string[]
  priority: number
}

export type RelationKind = 'reinforce' | 'complement' | 'contradict'

export interface CompositionRule {
  id: string
  primary: string
  support: string[]
  relation: RelationKind
  blocks: Partial<Record<PageRole, string>>
  priority: number
}
