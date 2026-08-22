import type { ReportInput } from '../deterministicReport.js'
import type { ReportMetadata } from './metadata.js'
import { buildReportFacts } from './facts.js'
import { buildReportFactsV2, factV2Metrics } from './factsV2.js'
import { buildReportFindings } from './findings.js'
import { buildReportFindingsV2, findingV2Metrics } from './findingsV2.js'
import { assignableChapterCount, median } from './shadowEvaluation.js'

export function observeShadowFacts(correlationId: string, input: ReportInput, metadata: ReportMetadata): void {
  if (process.env.SHADOW_METRICS !== '1') return
  try {
    const facts = buildReportFactsV2(input, metadata)
    const findings = buildReportFindingsV2(facts)
    const legacyFacts = buildReportFacts(input, metadata)
    const legacyFindings = buildReportFindings(legacyFacts)
    const consensus = findings.filter(finding => finding.kind === 'consensus')
    console.info('Shadow report pipeline completed', {
      correlationId,
      legacyFactCount: legacyFacts.length,
      legacyFindingCount: legacyFindings.length,
      ...factV2Metrics(facts),
      ...findingV2Metrics(findings),
      mergedFactCount: consensus.reduce((sum, finding) => sum + finding.supportingFacts.length, 0),
      independenceMedian: median(consensus.map(finding => finding.independence)),
      assignableChapters: assignableChapterCount(findings),
    })
  } catch (error) {
    console.warn('Shadow report pipeline failed', { correlationId, reason: error instanceof Error ? error.message : String(error) })
  }
}
