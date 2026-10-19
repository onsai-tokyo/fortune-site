import type { BookSource } from './aiBooks.js'

const reasons = ['SOURCE_NOT_FOUND', 'SOURCE_REUSED', 'HEADING_LENGTH', 'BODY_LENGTH', 'QUOTE_LENGTH', 'QUOTE_NOT_VERBATIM', 'UNCLASSIFIED'] as const
type Reason = typeof reasons[number]
export interface WebBookDiagnostic { stage: 'evidence'; reason: Reason; sectionIndex?: number }
export class WebBookDiagnosticError extends Error {
  constructor(readonly detail: WebBookDiagnostic) { super('BOOK_DOCUMENT_EVIDENCE') }
}
const bounded = (v: unknown, min: number, max: number) => typeof v === 'string' && [...v.trim()].length >= min && [...v].length <= max

/** Classification only: never repairs, quotes, IDs, snippets or validator bypass. */
export function inspectWebBookEvidence(value: unknown, sources: BookSource[]): WebBookDiagnostic {
  const sections = (value as { sections?: unknown[] } | null)?.sections
  if (!Array.isArray(sections)) return { stage: 'evidence', reason: 'UNCLASSIFIED' }
  const seen = new Set<string>()
  for (const [index, raw] of sections.slice(0, 5).entries()) {
    const s = raw as Record<string, unknown> | null
    const source = sources.find(c => c.id === s?.sourceId)
    let reason: Reason | undefined
    if (!source) reason = 'SOURCE_NOT_FOUND'
    else if (seen.has(source.id)) reason = 'SOURCE_REUSED'
    else if (!bounded(s?.heading, 2, 60)) reason = 'HEADING_LENGTH'
    else if (!bounded(s?.body, 50, 1200)) reason = 'BODY_LENGTH'
    else if (!bounded(s?.quote, 10, 300)) reason = 'QUOTE_LENGTH'
    else if (!source.text.includes(s!.quote as string)) reason = 'QUOTE_NOT_VERBATIM'
    if (reason) return { stage: 'evidence', reason, sectionIndex: index }
    seen.add(source!.id)
  }
  return { stage: 'evidence', reason: 'UNCLASSIFIED' }
}

/** Worker metadata/logging is opt-in for Web jobs only; never spread error data. */
export function webBookFailureDiagnostic(fundingSource: unknown, error: unknown): WebBookDiagnostic | undefined {
  if (fundingSource !== 'web' || !(error instanceof WebBookDiagnosticError)) return undefined
  const d = error.detail
  if (d?.stage !== 'evidence' || !reasons.includes(d.reason)) return undefined
  return { stage: 'evidence', reason: d.reason,
    ...(Number.isInteger(d.sectionIndex) && d.sectionIndex! >= 0 && d.sectionIndex! < 5 ? { sectionIndex: d.sectionIndex } : {}) }
}
