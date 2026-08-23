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
