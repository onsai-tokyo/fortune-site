import { replaceAnnual3600 } from './annual3600/cards.js'
import { japanDateParts } from '../japanDate.js'
import type { ReportInput } from '../deterministicReport.js'
import type { StructuredReport } from '../reportCards.js'
import type { ReportMetadata } from './metadata.js'
import { buildReportFacts, type ReportFact } from './facts.js'
import { buildReportFindings, type ReportFinding } from './findings.js'
import { buildReportFactsV2 } from './factsV2.js'
import { buildReportFindingsV2 } from './findingsV2.js'
import { buildEditorialStructuredReport } from './editorial.js'
import { replaceTimingCards } from './timingCards.js'
import { buildBlockStructuredReport } from './narrativeComposerV2.js'
import { augmentFindingsWithScoresV2 } from './scoreFindingsV2.js'
import { buildClaimStructuredReport } from './claimComposer.js'
import { buildPersonalityStructuredReport } from './personalityReport.js'
import { finalizeReportProvenance } from './provenance.js'

/**
 * PR-0a: 自己鑑定の生成経路をHTTPから切り離す。
 *
 * この時点では挙動を一切変えない。routes/preview.ts が行っていた
 *   buildReportFacts → buildReportFindings → buildEditorialStructuredReport → replaceTimingCards
 * をそのまま関数へ移しただけである。
 *
 * 以降のPRは、この関数の options 分岐としてのみ新経路を足す。
 * 既存の呼び出し（既定オプション）は常に現行と同一の出力を返さなければならない。
 * それを検証するのが buildSelfReport.test.ts と selfReportSnapshot.test.ts である。
 */

export { resolveSelfReportOptions, selfReportPipelineTag, DEFAULT_SELF_REPORT_OPTIONS } from './selfReportOptions.js'
export type { FactPipeline, NarrativeEngine, SelfReportOptions } from './selfReportOptions.js'
import { selfReportPipelineTag, DEFAULT_SELF_REPORT_OPTIONS, type SelfReportOptions } from './selfReportOptions.js'

export interface SelfReportResult {
  report: StructuredReport
  facts: ReportFact[]
  findings: ReportFinding[]
  options: SelfReportOptions
  pipelineTag: string
}

export function buildSelfReport(
  input: ReportInput,
  metadata: ReportMetadata,
  options: SelfReportOptions = DEFAULT_SELF_REPORT_OPTIONS,
): SelfReportResult {
  if (options.narrativeEngine === 'blocks' && options.factPipeline !== 'v2') throw new Error("narrativeEngine='blocks' には factPipeline='v2' が必要です")

  const generated = options.factPipeline === 'v2'
    ? (() => {
        const facts = buildReportFactsV2(input, metadata)
        return { facts, findings: buildReportFindingsV2(facts) }
      })()
    : (() => {
        const facts = buildReportFacts(input, metadata)
        return { facts, findings: buildReportFindings(facts) }
      })()
  const facts = generated.facts
  const findings = options.factPipeline === 'v2' && options.narrativeEngine === 'blocks'
    ? augmentFindingsWithScoresV2(facts as ReturnType<typeof buildReportFactsV2>, generated.findings as ReturnType<typeof buildReportFindingsV2>)
    : generated.findings
  const generatedReport = options.narrativeEngine === 'personality'
    ? buildPersonalityStructuredReport(input)
    : options.narrativeEngine === 'blocks'
      ? buildClaimStructuredReport(facts as ReturnType<typeof buildReportFactsV2>, findings as ReturnType<typeof buildReportFindingsV2>, input)
      : buildEditorialStructuredReport(facts, findings)
  const withTiming = options.annualEngine === 'catalog3600'
    ? replaceAnnual3600(generatedReport, input, japanDateParts().year)
    : replaceTimingCards(generatedReport, input)
  const pipelineTag = selfReportPipelineTag(options)
  const report = options.narrativeEngine === 'personality'
    ? finalizeReportProvenance(withTiming, `self-report-v3|${pipelineTag}`)
    : withTiming

  return { report, facts, findings, options, pipelineTag }
}
