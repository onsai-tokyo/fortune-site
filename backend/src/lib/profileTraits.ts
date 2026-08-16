export const TRAIT_CATEGORIES = ['decision', 'work', 'love', 'relation', 'value'] as const
export type TraitCategory = typeof TRAIT_CATEGORIES[number]
export type TraitCandidate = { category: TraitCategory; text: string }

const forbidden = /優柔不断|決断力がない|計画が苦手|能力がない|不安傾向|回避型|HSP|愛着障害|発達障害|人格障害|病気|診断|今の相手とは合わない|絶対|必ず|100%/i

export function normalizeTraitText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s、。,.・「」『』（）()]/g, '')
}

function bigrams(value: string) {
  const normalized = normalizeTraitText(value)
  if (normalized.length < 2) return new Set([normalized])
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2)))
}

export function traitsAreSimilar(left: string, right: string) {
  const a = normalizeTraitText(left)
  const b = normalizeTraitText(right)
  if (a === b || a.includes(b) || b.includes(a)) return true
  const aSet = bigrams(a); const bSet = bigrams(b)
  const overlap = [...aSet].filter(item => bSet.has(item)).length
  return overlap / Math.max(1, Math.min(aSet.size, bSet.size)) >= 0.65
}

export function validateTraitCandidate(value: unknown): TraitCandidate | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!TRAIT_CATEGORIES.includes(raw.category as TraitCategory) || typeof raw.text !== 'string') return null
  const text = raw.text.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length < 4 || text.length > 120 || forbidden.test(text)) return null
  return { category: raw.category as TraitCategory, text }
}

export function filterTraitCandidates(values: unknown[], existing: string[]) {
  const accepted: TraitCandidate[] = []
  for (const value of values) {
    const candidate = validateTraitCandidate(value)
    if (!candidate) continue
    if ([...existing, ...accepted.map(item => item.text)].some(text => traitsAreSimilar(candidate.text, text))) continue
    accepted.push(candidate)
    if (accepted.length === 2) break
  }
  return accepted
}
