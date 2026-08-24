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
export type NarrativeEngine = 'legacy' | 'blocks'

export interface SelfReportOptions {
  factPipeline: FactPipeline
  narrativeEngine: NarrativeEngine
}

export const DEFAULT_SELF_REPORT_OPTIONS: SelfReportOptions = {
  factPipeline: 'v1',
  narrativeEngine: 'legacy',
}

/**
 * 生成経路の識別子。キャッシュ署名へ必ず含めること。
 * 新旧経路が同じキャッシュキーを共有すると、片方の変更がもう片方の保存済み鑑定書を汚染する。
 */
export function selfReportPipelineTag(options: SelfReportOptions): string {
  return `fact:${options.factPipeline}|narrative:${options.narrativeEngine}`
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
  return value === 'legacy' || value === 'blocks'
}

/**
 * 環境変数から生成経路を決める。未設定・不正値は必ず現行経路へ落とす。
 * 「読めない値なら安全側」を守ることで、設定ミスで本番の鑑定品質が変わらないようにする。
 */
export function resolveSelfReportOptions(env: NodeJS.ProcessEnv = process.env): SelfReportOptions {
  const factPipeline = (env.FACT_PIPELINE ?? '').trim()
  const narrativeEngine = (env.NARRATIVE_ENGINE ?? '').trim()
  return {
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
  const report = replaceTimingCards(options.narrativeEngine === 'blocks'
    ? buildBlockStructuredReport(facts as ReturnType<typeof buildReportFactsV2>, findings as ReturnType<typeof buildReportFindingsV2>, input, metadata)
    : buildEditorialStructuredReport(facts, findings), input)

  return { report, facts, findings, options, pipelineTag: selfReportPipelineTag(options) }
}
