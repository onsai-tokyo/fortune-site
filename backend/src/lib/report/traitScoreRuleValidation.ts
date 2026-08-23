import type { TraitScoreKey, TraitScoreRule } from './traitScores.js'

export type RuleSourceDocument = '性格' | '時期'

export interface ParsedRuleSource {
  document: RuleSourceDocument
  section: number
}

export interface TraitScoreRuleValidationOptions {
  availableSections: Partial<Record<RuleSourceDocument, ReadonlySet<number>>>
  requiredScores?: readonly TraitScoreKey[]
  minimumRulesPerScore?: number
}

export interface TraitScoreRuleValidationResult {
  errors: string[]
  ruleCountByScore: Partial<Record<TraitScoreKey, number>>
}

export interface RuleSourceDocumentAudit {
  expectedSectionCount: number
  sections: number[]
  missingSections: number[]
  outOfRangeSections: number[]
  duplicateSections: number[]
  complete: boolean
}

const SOURCE_PATTERN = /^(性格|時期)§([1-9]\d*)$/
const MARKDOWN_SECTION_PATTERN = /^#\s+([1-9]\d*)\.\s+.+$/gm

export function parseTraitScoreRuleSource(source: string): ParsedRuleSource | null {
  const match = SOURCE_PATTERN.exec(source.trim())
  if (!match) return null
  return { document: match[1] as RuleSourceDocument, section: Number(match[2]) }
}

export function extractRuleSourceSections(markdown: string): ReadonlySet<number> {
  const sections = new Set<number>()
  for (const match of markdown.matchAll(MARKDOWN_SECTION_PATTERN)) sections.add(Number(match[1]))
  return sections
}

/**
 * 原文資料の受領時に、見出しの欠落や重複を実装前に検出する。
 * Setだけでは重複を失うため、本文を直接走査する。
 */
export function auditRuleSourceDocument(markdown: string, expectedSectionCount: number): RuleSourceDocumentAudit {
  if (!Number.isInteger(expectedSectionCount) || expectedSectionCount < 1) {
    throw new Error('expectedSectionCount must be a positive integer')
  }
  const counts = new Map<number, number>()
  for (const match of markdown.matchAll(MARKDOWN_SECTION_PATTERN)) {
    const section = Number(match[1])
    counts.set(section, (counts.get(section) ?? 0) + 1)
  }
  const sections = [...counts.keys()].sort((a, b) => a - b)
  const missingSections = Array.from({ length: expectedSectionCount }, (_, index) => index + 1)
    .filter(section => !counts.has(section))
  const outOfRangeSections = sections.filter(section => section > expectedSectionCount)
  const duplicateSections = sections.filter(section => (counts.get(section) ?? 0) > 1)
  return {
    expectedSectionCount,
    sections,
    missingSections,
    outOfRangeSections,
    duplicateSections,
    complete: missingSections.length === 0 && outOfRangeSections.length === 0 && duplicateSections.length === 0,
  }
}

const stableRuleIdentity = (rule: TraitScoreRule): string => JSON.stringify({
  score: rule.score,
  match: rule.match,
  weight: rule.weight,
  source: rule.source,
})

export function validateTraitScoreRules(
  rules: readonly TraitScoreRule[],
  options: TraitScoreRuleValidationOptions,
): TraitScoreRuleValidationResult {
  const errors: string[] = []
  const identities = new Set<string>()
  const ruleCountByScore: Partial<Record<TraitScoreKey, number>> = {}

  for (const [index, rule] of rules.entries()) {
    ruleCountByScore[rule.score] = (ruleCountByScore[rule.score] ?? 0) + 1
    const source = parseTraitScoreRuleSource(rule.source)
    if (!source) {
      errors.push(`rule[${index}] source must use 性格§N or 時期§N: ${rule.source}`)
    } else if (!options.availableSections[source.document]?.has(source.section)) {
      errors.push(`rule[${index}] references missing source: ${rule.source}`)
    }
    if (!Number.isFinite(rule.weight) || rule.weight === 0) {
      errors.push(`rule[${index}] weight must be a finite non-zero number`)
    }
    if (Object.keys(rule.match).length === 0) {
      errors.push(`rule[${index}] matcher must not be empty`)
    }
    const identity = stableRuleIdentity(rule)
    if (identities.has(identity)) errors.push(`rule[${index}] duplicates an earlier rule`)
    identities.add(identity)
  }

  const minimum = options.minimumRulesPerScore ?? 1
  for (const score of options.requiredScores ?? []) {
    const count = ruleCountByScore[score] ?? 0
    if (count < minimum) errors.push(`${score} requires at least ${minimum} rules; found ${count}`)
  }

  return { errors, ruleCountByScore }
}
