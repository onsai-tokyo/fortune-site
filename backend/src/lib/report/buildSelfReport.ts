import { replaceAnnual3600 } from './annual3600/cards.js'
import { ANNUAL3600_VERSION } from './annual3600/version.js'
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
import { buildPersonalityStructuredReport, PERSONALITY_VERSION, PERSONALITY_LAYOUT_VERSION, PERSONALITY_SPOUSE_VERSION } from './personalityReport.js'
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

/** Fact/Finding の生成系統。'v2' は PR-1 で有効化する。 */
export type FactPipeline = 'v1' | 'v2'

/** 本文の組み立て方式。'blocks' は PR-2 で有効化する。 */
export type NarrativeEngine = 'legacy' | 'blocks' | 'personality'

export interface SelfReportOptions {
  annualEngine?: 'legacy' | 'catalog3600'
  factPipeline: FactPipeline
  narrativeEngine: NarrativeEngine
}

export const DEFAULT_SELF_REPORT_OPTIONS: SelfReportOptions = {
  factPipeline: 'v2',
  narrativeEngine: 'blocks',
}

/**
 * 生成経路の識別子。キャッシュ署名へ必ず含めること。
 * 新旧経路が同じキャッシュキーを共有すると、片方の変更がもう片方の保存済み鑑定書を汚染する。
 */
export function selfReportPipelineTag(options: SelfReportOptions): string {
  return `fact:${options.factPipeline}|narrative:${options.narrativeEngine}${options.narrativeEngine === 'personality' ? `|personality:${PERSONALITY_VERSION}|personality-layout:${PERSONALITY_LAYOUT_VERSION}|spouse:${PERSONALITY_SPOUSE_VERSION}` : ''}${options.annualEngine === 'catalog3600' ? `|${ANNUAL3600_VERSION}` : ''}`
}

export interface SelfReportResult {
  report: StructuredReport
  facts: ReportFact[]
  findings: ReportFinding[]
  options: SelfReportOptions
  pipelineTag: string
}

function isFactPipeline(value: string): value is FactPipeline {
  return value === 'v1' || value === 'v2'
}

function isNarrativeEngine(value: string): value is NarrativeEngine {
  return value === 'legacy' || value === 'blocks' || value === 'personality'
}

/**
 * 環境変数から生成経路を決める。未設定・不正値は必ず現行経路へ落とす。
 * 「読めない値なら安全側」を守ることで、設定ミスで本番の鑑定品質が変わらないようにする。
 */
export function resolveSelfReportOptions(env: NodeJS.ProcessEnv = process.env): SelfReportOptions {
  const factPipeline = (env.FACT_PIPELINE ?? '').trim()
  const narrativeEngine = (env.NARRATIVE_ENGINE ?? '').trim()
  return {
    ...(env.ANNUAL_READING_ENGINE?.trim() === 'catalog3600' ? {annualEngine:'catalog3600' as const} : {}),
    factPipeline: isFactPipeline(factPipeline) ? factPipeline : DEFAULT_SELF_REPORT_OPTIONS.factPipeline,
    narrativeEngine: isNarrativeEngine(narrativeEngine) ? narrativeEngine : DEFAULT_SELF_REPORT_OPTIONS.narrativeEngine,
  }
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
