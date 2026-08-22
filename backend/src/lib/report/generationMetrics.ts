export type ReportGenerationKind = 'self' | 'compatibility'
export type ObservedGenerator = 'ai' | 'deterministic'
export type FallbackReason =
  | 'card_timeout'
  | 'overall_timeout'
  | 'invalid_pages'
  | 'invalid_title'
  | 'forbidden_domain'
  | 'no_metadata_refs'
  | 'api_error'

export interface GenerationContext {
  correlationId: string
  kind: ReportGenerationKind
}

export interface CardGenerationMetric extends GenerationContext {
  cardId: string
  generator: ObservedGenerator
  source: 'cache_hit' | 'generated' | 'fallback' | 'deterministic'
  fallbackReason: FallbackReason | null
  durationMs: number
  outputTokens?: number | null
  stopReason?: string | null
}

export interface ReportGenerationMetric extends GenerationContext {
  totalCardCount: number
  aiCardCount: number
  deterministicCardCount: number
  savedGenerator: 'ai' | 'deterministic' | 'mixed'
  durationMs: number
}

export function classifyFallbackReason(error: unknown, overallTimeout = false): FallbackReason {
  if (overallTimeout) return 'overall_timeout'
  const message = error instanceof Error ? error.message : String(error)
  if (/timed out|timeout/i.test(message)) return 'card_timeout'
  if (/pages|ページ/u.test(message)) return 'invalid_pages'
  if (/title|summary|タイトル|要約/u.test(message)) return 'invalid_title'
  if (/unrelated domain|占術用語|他領域/u.test(message)) return 'forbidden_domain'
  if (/metadata|根拠/u.test(message)) return 'no_metadata_refs'
  return 'api_error'
}

export function logCardGeneration(metric: CardGenerationMetric): void {
  console.info('Report card generation completed', metric)
}

export function logReportGeneration(metric: ReportGenerationMetric): void {
  console.info('Report generation completed', metric)
}

export function aggregateGenerator(aiCardCount: number, deterministicCardCount: number): 'ai' | 'deterministic' | 'mixed' {
  if (aiCardCount > 0 && deterministicCardCount > 0) return 'mixed'
  return aiCardCount > 0 ? 'ai' : 'deterministic'
}
