/** Only the latest, still-visible standalone calculation may publish a result. */
export function createCoupleCalculation() {
  let active: AbortController | null = null
  return async function calculate<T>(read: (signal: AbortSignal) => Promise<T>, publish: (result: T) => void, signal?: AbortSignal): Promise<T> {
    active?.abort()
    const controller = new AbortController()
    active = controller
    const abort = () => controller.abort()
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 60_000)
    try {
      if (controller.signal.aborted) throw new DOMException('Calculation cancelled', 'AbortError')
      const result = await read(controller.signal)
      // A transport may finish even after abort; never publish that response.
      if (controller.signal.aborted || active !== controller) throw new DOMException('Calculation cancelled', 'AbortError')
      publish(result)
      return result
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      if (active === controller) active = null
    }
  }
}
