import { TIMELINE_V3_VERSION } from './timelineV3/index.js'
import { ANNUAL3600_VERSION } from './annual3600/version.js'
import { PERSONALITY_VERSION, PERSONALITY_LAYOUT_VERSION, PERSONALITY_SPOUSE_VERSION } from './personalityReport.js'

/** Fact/Finding の生成系統。'v2' は PR-1 で有効化する。 */
export type FactPipeline = 'v1' | 'v2'

/** 本文の組み立て方式。'blocks' は PR-2 で有効化する。 */
export type NarrativeEngine = 'legacy' | 'blocks' | 'personality'

export interface SelfReportOptions {
  annualEngine?: 'legacy' | 'catalog3600' | 'timeline3'
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
  return `fact:${options.factPipeline}|narrative:${options.narrativeEngine}${options.narrativeEngine === 'personality' ? `|personality:${PERSONALITY_VERSION}|personality-layout:${PERSONALITY_LAYOUT_VERSION}|spouse:${PERSONALITY_SPOUSE_VERSION}` : ''}${options.annualEngine === 'timeline3' ? `|${TIMELINE_V3_VERSION}` : ''}${options.annualEngine === 'catalog3600' ? `|${ANNUAL3600_VERSION}` : ''}`
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
    ...(env.ANNUAL_READING_ENGINE?.trim() === 'timeline3' ? {annualEngine:'timeline3' as const} : {}),
    ...(env.ANNUAL_READING_ENGINE?.trim() === 'catalog3600' ? {annualEngine:'catalog3600' as const} : {}),
    factPipeline: isFactPipeline(factPipeline) ? factPipeline : DEFAULT_SELF_REPORT_OPTIONS.factPipeline,
    narrativeEngine: isNarrativeEngine(narrativeEngine) ? narrativeEngine : DEFAULT_SELF_REPORT_OPTIONS.narrativeEngine,
  }
}

