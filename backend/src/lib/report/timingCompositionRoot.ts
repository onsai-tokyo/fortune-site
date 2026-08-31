import type { TimingScoreQuality } from './timingScoreEngine.js'
import { buildTimingScoreTimeline, type TimingEvidenceBirthInput, type TimingScoreTimeline } from './timingEvidencePipeline.js'
import { assertCanonicalTimingManifestReadyForProduction, assertTimingEvidenceMatchesManifest, assertTimingManifestHash } from './timingExactManifest.js'

export type TimingEngineMode = 'legacy' | 'shadow' | 'v2'

export function resolveTimingEngineMode(value: string | undefined = process.env.TIMING_ENGINE_MODE): TimingEngineMode {
  if (value === undefined || value === '' || value === 'legacy') return 'legacy'
  if (value === 'shadow' || value === 'v2') return value
  throw new Error(`Unknown TIMING_ENGINE_MODE: ${value}`)
}

/** 時期18スコアを本番へ接続するときに通す唯一のcomposition root。 */
export function buildProductionTimingScoreTimeline(
  input: TimingEvidenceBirthInput,
  quality: TimingScoreQuality = {},
): TimingScoreTimeline {
  const mode = resolveTimingEngineMode()
  if (mode !== 'v2') throw new Error(`Timing v2 production root requires explicit v2 mode; current=${mode}`)
  const audit = assertCanonicalTimingManifestReadyForProduction()
  assertTimingManifestHash(audit.manifestHash, process.env.TIMING_V2_MANIFEST_HASH)
  const timeline = buildTimingScoreTimeline(input, quality)
  for (const definitions of timeline.byYear.values()) assertTimingEvidenceMatchesManifest(definitions)
  return timeline
}
