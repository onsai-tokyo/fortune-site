import type { StructuredReport } from './reportCards.js'
import { resolveSelfReportOptions, selfReportPipelineTag } from './report/buildSelfReport.js'

const serviceStartedAt = new Date().toISOString()

function cleanCommit(value: string | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return /^[a-f0-9]{7,64}$/i.test(normalized) ? normalized.toLowerCase() : null
}

function normalizedList(value: string | undefined): string[] {
  return [...new Set((value ?? '').split(',').map(item => item.trim()).filter(Boolean))].sort()
}

function timingMode(value: string | undefined): 'legacy' | 'shadow' | 'v2' | 'invalid' {
  const normalized = value?.trim() || 'legacy'
  return normalized === 'legacy' || normalized === 'shadow' || normalized === 'v2'
    ? normalized
    : 'invalid'
}

export function runtimeIdentity(env: NodeJS.ProcessEnv = process.env) {
  const selfReport = resolveSelfReportOptions(env)
  return {
    commitSha: cleanCommit(env.RENDER_GIT_COMMIT)
      ?? cleanCommit(env.GIT_COMMIT)
      ?? cleanCommit(env.SOURCE_VERSION)
      ?? cleanCommit(env.COMMIT_SHA)
      ?? 'unknown',
    serviceStartedAt,
    nodeEnv: env.NODE_ENV ?? 'unknown',
    selfReport: {
      ...selfReport,
      pipelineTag: selfReportPipelineTag(selfReport),
    },
    aiReportEnabled: env.AI_REPORT_ENABLED !== 'false',
    deterministicScope: normalizedList(env.DETERMINISTIC_SCOPE),
    timingEngineMode: timingMode(env.TIMING_ENGINE_MODE),
    timingManifestHash: cleanCommit(env.TIMING_V2_MANIFEST_HASH) ?? 'unconfigured',
  }
}

export function reportDiagnostics(report: StructuredReport) {
  return {
    reportVersion: report.version,
    generator: report.generator ?? 'unknown',
    generatorVersion: report.generatorVersion ?? 'unknown',
    aiCardCount: report.aiCardCount ?? report.cards.filter(card => card.generator === 'ai').length,
    deterministicCardCount: report.deterministicCardCount
      ?? report.cards.filter(card => card.generator === 'deterministic').length,
    cardCount: report.cards.length,
    cards: report.cards.map(card => ({
      id: card.id,
      kind: card.kind,
      tab: card.tab ?? null,
      generator: card.generator ?? 'unknown',
      compositionMode: card.compositionMode ?? 'unknown',
      sectionsLength: card.sections?.length ?? 0,
      pagesLength: card.pages.length,
      metadataRefsCount: card.metadataRefs?.length ?? 0,
      evidenceCount: card.evidence.length,
    })),
  }
}

