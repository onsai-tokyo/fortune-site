/** Engineering inventory only. Neither this list nor the lineage catalog approves a canon. */
export const TIMING_PRODUCTION_SHARED_MODULES = ['timingCards', 'timingAnnualNarrative', 'timingClaim', 'timingClaimAssets'] as const
export const TIMING_SHADOW_MODULES = [
  'timingCompositionRoot', 'timingEvidencePipeline', 'timingScoreEngine', 'timingClaimSelector',
  'timingRuleReadiness', 'timingKnownEventBenchmark', 'timingAdditionalStemBranchEvidence',
  'timingExactManifest', 'timingLineageContract', 'timingScoreDesignContract',
  'timingStemBranchEvidence', 'timingWesternEvidence', 'timingVedicEvidence', 'timingZiweiEvidence',
  'timingMonthlyStemBranchEvidence', 'timingEvidenceContract', 'timingShadowInventory',
  'timingMonthProjection', 'timingSourceTime',
] as const
