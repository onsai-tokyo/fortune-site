/** Only errors known to occur before an order is committed may release its cache. */
export function knownBookRejection(status: number, code?: string): boolean {
  return (status === 402 && code === 'BOOK_NO_CREDITS') ||
    (status === 422 && ['BOOK_INPUT', 'BOOK_SOURCE', 'BOOK_POLICY', 'BOOK_SUPPORT'].includes(code ?? '')) ||
    (status === 403 && code === 'WEB_AI_ADULT_ONLY') ||
    (status === 428 && code === 'AI_CONSENT_REQUIRED')
}

/** Same failed book => same order on every tab/device, without changing server APIs. */
export async function bookRetryOperationId(owner: string, failedBookId: string): Promise<string> {
  const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
  if (!uuid.test(owner) || !uuid.test(failedBookId)) throw new Error('再作成の対象を確認できませんでした。')
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`fatelab:web:book-retry:v1:${owner.toLowerCase()}:${failedBookId.toLowerCase()}`))).slice(0, 16)
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

interface RetryComparable {
  id: string; sourceId?: string; sourceCardId?: string; question: string; theme: string; createdAt: string; state: string
}
/** Older clients used random retry ids. Prefer an already newer identical answer over another charge. */
export function existingBookRetry<T extends RetryComparable>(failed: T, books: T[]): T | undefined {
  const created = Date.parse(failed.createdAt)
  if (!failed.sourceId || !Number.isFinite(created)) return undefined
  return books.filter(b => b.id !== failed.id && b.sourceId === failed.sourceId && b.sourceCardId === failed.sourceCardId &&
    b.theme === failed.theme && b.question.trim() === failed.question.trim() &&
    ['queued', 'generating', 'review', 'delivered', 'failed'].includes(b.state) && Date.parse(b.createdAt) > created)
    .sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
}
