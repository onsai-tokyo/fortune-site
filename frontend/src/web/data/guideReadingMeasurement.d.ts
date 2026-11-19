export function pendingGuideReading(): number | undefined
export function clearCompletedGuideReading(): void
export function recordGuideReadingResult(startedAt: unknown): void
export function recordGuideReadingBanner(path: string): void

export function articleOrigin(kind?: 'self' | 'couple'): Record<string, unknown>
