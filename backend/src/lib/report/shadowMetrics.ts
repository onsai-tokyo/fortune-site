import type { ReportInput } from '../deterministicReport.js'
import type { ReportMetadata } from './metadata.js'
import { buildReportFactsV2, factV2Metrics } from './factsV2.js'

export function observeShadowFacts(correlationId: string, input: ReportInput, metadata: ReportMetadata): void {
  if (process.env.SHADOW_METRICS !== '1') return
  try {
    console.info('Shadow report facts completed', { correlationId, ...factV2Metrics(buildReportFactsV2(input, metadata)) })
  } catch (error) {
    console.warn('Shadow report facts failed', { correlationId, reason: error instanceof Error ? error.message : String(error) })
  }
}
