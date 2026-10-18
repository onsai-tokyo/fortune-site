/** Missing/nonfinite values must never pass a low/middle/high narrative gate. */
export function isAvailableScore(
  score: { value: number; confidence: number } | undefined,
  minConfidence = 0,
): score is { value: number; confidence: number } {
  return Boolean(score && typeof score.value === 'number' && Number.isFinite(score.value)
    && score.value >= 0 && score.value <= 1
    && typeof score.confidence === 'number' && Number.isFinite(score.confidence)
    && score.confidence > 0 && score.confidence <= 1 && score.confidence >= minConfidence)
}

export function hasScoreEvidence<T extends { value: number; confidence: number; contributingFacts: string[] }>(
  score: T | undefined,
): score is T {
  return isAvailableScore(score) && Array.isArray(score.contributingFacts)
    && score.contributingFacts.length > 0
    && score.contributingFacts.every(id => typeof id === 'string' && id.trim().length > 0)
}
