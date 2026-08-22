import type { ReportInput } from '../deterministicReport.js'
import type { ReportMetadata } from './metadata.js'
import { buildReportFactsV2, factV2Metrics } from './factsV2.js'
import { buildReportFindingsV2, findingV2Metrics } from './findingsV2.js'

export function observeShadowFacts(correlationId: string, input: ReportInput, metadata: ReportMetadata): void {
  if (process.env.SHADOW_METRICS !== '1') return
  try {
    const facts = buildReportFactsV2(input, metadata)
    const findings = buildReportFindingsV2(facts)
    console.info('Shadow report pipeline completed', { correlationId, ...factV2Metrics(facts), ...findingV2Metrics(findings) })
  } catch (error) {
    console.warn('Shadow report pipeline failed', { correlationId, reason: error instanceof Error ? error.message : String(error) })
  }
}
