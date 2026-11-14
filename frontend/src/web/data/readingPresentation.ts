import type { ReadingSection } from './types'

// Display-only filtering: keep source evidence intact for calculation and AI context.
export function visibleYearSections(sections: ReadingSection[]) {
  return sections.filter(section => section.heading.trim() !== '根拠と期間')
}

export function keepReadingVisible(status: string, years: readonly unknown[], chapters: readonly unknown[]) {
  return status === 'ready' && years.length > 0 && chapters.length > 0
}
