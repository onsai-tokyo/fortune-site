import type { ReportCard, StructuredReport } from '../reportCards.js'

export type CardGenerator = NonNullable<ReportCard['generator']>
export type CompositionMode = NonNullable<ReportCard['compositionMode']>

function fallbackMetadataRefs(card: ReportCard): string[] {
  if (card.metadataRefs?.length) return [...new Set(card.metadataRefs)]
  const refs = card.evidence.map((item, index) => `evidence:${item.family}:${item.system}:${index}`)
  return refs.length ? refs : [`card:${card.id}`]
}

export function withCardProvenance(
  card: ReportCard,
  generator: CardGenerator,
  compositionMode: CompositionMode = 'finding',
  supplementPageCount = 0,
): ReportCard {
  return {
    ...card,
    metadataRefs: fallbackMetadataRefs(card),
    generator,
    compositionMode,
    supplementPageCount: Math.max(0, Math.min(card.pages.length, supplementPageCount)),
  }
}

export function finalizeReportProvenance(
  report: StructuredReport,
  generatorVersion: string,
  defaultGenerator: CardGenerator = 'deterministic',
): StructuredReport {
  const cards = report.cards.map(card => withCardProvenance(
    card,
    card.generator ?? defaultGenerator,
    card.compositionMode ?? 'finding',
    card.supplementPageCount ?? 0,
  ))
  const aiCardCount = cards.filter(card => card.generator === 'ai').length
  const deterministicCardCount = cards.length - aiCardCount
  const supplementCardCount = cards.filter(card => card.compositionMode !== 'finding').length
  const generator = aiCardCount === 0 ? 'deterministic' : deterministicCardCount === 0 ? 'ai' : 'mixed'
  return {
    ...report,
    cards,
    generator,
    generatorVersion,
    aiCardCount,
    deterministicCardCount,
    supplementCardCount,
  }
}
