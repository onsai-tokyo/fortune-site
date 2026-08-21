import type { ReportCard, StructuredReport } from '../reportCards.js'

export type ReportTab = 'essence' | 'timing' | 'chart'
export type ContractCard = ReportCard & { tab?: ReportTab }

export function cardContractViolations(cards: ContractCard[]): string[] {
  const violations: string[] = []
  const ids = new Set<string>()
  const titles = new Set<string>()
  for (const card of cards) {
    if (!card.tab) violations.push(`${card.id}: tab is missing`)
    if (card.tags.length === 0) violations.push(`${card.id}: tags are empty`)
    if (ids.has(card.id)) violations.push(`${card.id}: duplicate id`)
    ids.add(card.id)
    const normalizedTitle = card.title.normalize('NFKC').trim()
    if (titles.has(normalizedTitle)) violations.push(`${card.id}: duplicate title ${normalizedTitle}`)
    titles.add(normalizedTitle)
    for (const [index, page] of card.pages.entries()) {
      const length = [...page.text.trim()].length
      if (length < 1 || length > 120) violations.push(`${card.id}.pages[${index}]: text length ${length}`)
    }
  }
  if (!cards.some(card => card.kind === 'timing')) violations.push('timing card is missing')
  return violations
}

export function assertCardContract(report: StructuredReport): void {
  const violations = cardContractViolations(report.cards)
  if (violations.length > 0) throw new Error(`Report card contract violated:\n${violations.join('\n')}`)
}
