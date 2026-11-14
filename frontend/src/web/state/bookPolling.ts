export interface PollBook { id: string; state: string }
export const isBookPending = (state: string) => ['queued', 'generating', 'review'].includes(state)
export const isBookTerminal = (state: string) => ['delivered', 'failed'].includes(state)

/** GET only. Pending and uncertain states must never release recovery data. */
export async function pollBookOperation<T extends PollBook>(deps: {
  current: () => boolean
  read: () => Promise<T | null>
  observe: (book: T) => Promise<void>
  sleep: () => Promise<void>
  attempts: number
}): Promise<T | null> {
  for (let i = 0; i < deps.attempts && deps.current(); i++) {
    const book = await deps.read()
    if (!deps.current()) return null
    if (book) {
      if (!isBookPending(book.state) && !isBookTerminal(book.state)) throw new Error('BOOK_STATE_UNKNOWN')
      await deps.observe(book)
      if (!deps.current()) return null
      if (isBookTerminal(book.state)) return book
    }
    await deps.sleep()
  }
  return null
}
