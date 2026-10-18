import type { SpousePendingReason } from './spouseCalculation.js'

export type MaterialFamily = 'day_pillar' | 'shukuyo' | 'spouse_star' | 'spouse_branch'
export type GenderSupplement = 'female' | 'male' | null
export type ReviewStatus = 'representative_reviewed' | 'composition_revised' | 'material_reviewed' | 'material_revised' | 'legacy_unreviewed'
export interface PersonalityInput {
  dayPillar: string
  mansion: string
  /** Explicit editorial preference; never populated from timing direction or profile.gender. */
  genderSupplement?: GenderSupplement
  /** Calculated using the adopted convention by a trusted caller, never inferred from day pillar. */
  spouse?: { star: string; branch: string }
  pendingSpouseReason?: 'missing_birth_input' | 'calculation_not_connected' | SpousePendingReason
}
export interface PersonalitySource {
  id: string
  family: MaterialFamily
  key: string
  scope: string | null
  scopeBasis: string
  reviewedUsage?: string
  exclusionReasons: string[]
  text: string
  urls: string[]
}
export interface PersonalityParagraph {
  id: string
  text: string
  refs: string[]
  kind: 'astrological_interpretation' | 'editorial_advice' | 'interpretation_limit'
  scope: 'common' | 'female' | 'male'
  owner?: { family: MaterialFamily; key: string }
  derivedFrom?: string[]
  derivationNote?: string
  reviewStatus: ReviewStatus
  /** Bounded source-summary review, distinct from approving a combined reading. */
  reviewId?: string
  withheldReasons?: string[]
}
export interface PersonalityCell {
  family: MaterialFamily
  key: string
  sectionId: string
  paragraphIds: string[]
}
export interface PersonalityRecipe {
  id: string
  sectionId: string
  conditions: { dayPillar?: string; mansion?: string; spouseStar?: string; spouseBranch?: string }
  paragraphIds: string[]
}
export interface PersonalityCatalog {
  version: string
  chapters: Array<{ id: string; title: string; items: string[] }>
  dayPillars: string[]
  mansions: string[]
  sources: Record<string, PersonalitySource>
  paragraphs: Record<string, PersonalityParagraph>
  cells: PersonalityCell[]
  recipes: PersonalityRecipe[]
  provenance: { inputs: Array<{ path: string; sha256: string }>; notes: string[] }
}
export interface PersonalityAuditEntry {
  sectionId: string
  paragraphId: string
  disposition: 'withheld' | 'duplicate'
  reasons: string[]
}
export interface PersonalityOutputParagraph {
  id: string
  text: string
  refs: string[]
  kind: PersonalityParagraph['kind'] | 'pending_input'
  reviewStatus: ReviewStatus | 'pending'
  reviewId?: string
  derivedFrom?: string[]
  derivationNote?: string
}
export interface PersonalitySection {
  id: string
  title: string
  paragraphs: PersonalityOutputParagraph[]
  status: 'ready' | 'pending'
  reviewStatus: ReviewStatus | 'pending'
}
export interface PersonalityReading {
  version: string
  chapters: Array<{ id: string; title: string; sections: PersonalitySection[] }>
  audit: PersonalityAuditEntry[]
}
