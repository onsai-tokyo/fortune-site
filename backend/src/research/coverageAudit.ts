import { coverageSummary, latest, mergeDataset, type Dataset } from './ledger.js'
export interface SectionLocatorIndex {
  sourceHash: string
  purpose: 'section_locator_index'
  atomicReviewComplete: false
  records: { sourceId: string; document: string; section: number; status: string }[]
}
/** Source locators identify sections, not reviewed atomic requirements. No automatic adoption. */
export function auditSectionCoverage(dataset: Dataset, index: SectionLocatorIndex) {
  if (index.purpose !== 'section_locator_index' || index.atomicReviewComplete !== false
    || !/^[a-f0-9]{64}$/.test(index.sourceHash)) throw new Error('Invalid section locator contract')
  const keys = new Set<string>()
  for (const section of index.records) {
    const key = JSON.stringify([section.document, section.sourceId])
    if (!section.document || !section.sourceId || !Number.isInteger(section.section) || section.section < 0 || keys.has(key)) throw new Error('Invalid/duplicate section locator')
    keys.add(key)
  }
  const checked = mergeDataset({ ...dataset, records: [] }, dataset)
  const coverage = latest(checked).filter(record => record.kind === 'coverage')
  const known = coverage.filter(record => keys.has(JSON.stringify([record.sourceDocumentId, record.sourceSection])))
  const sections = index.records.map(section => {
    const linked = known.filter(record => record.sourceDocumentId === section.document && record.sourceSection === section.sourceId)
    return { sourceId: section.sourceId, document: section.document, mappedRecords: linked.length,
      pendingRecords: linked.filter(record => record.implementationStatus === 'needs_review').length }
  })
  return {
    ...coverageSummary(checked), sourceHash: index.sourceHash, totalSections: sections.length,
    sectionsWithoutMapping: sections.filter(section => !section.mappedRecords).length,
    sectionsWithPendingReview: sections.filter(section => section.pendingRecords > 0).length,
    unknownSectionReferences: coverage.length - known.length,
    atomicReviewComplete: false as const, qualityEligible: false as const,
    // These IDs are public source locators; observation IDs/text are deliberately absent.
    sections,
  }
}
