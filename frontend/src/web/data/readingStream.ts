/** Read progress as it arrives, rather than waiting for the SSE connection to close. */
export async function readReadingStream(response: Response, onProgress: (percent: number) => void): Promise<Record<string, unknown>> {
  if (!response.ok || !response.body) throw new Error('READING_REQUEST_FAILED')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  function event(block: string): Record<string, unknown> | undefined {
    const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data || data === '[DONE]') return
    const item = JSON.parse(data)
    if (item.type === 'error') throw new Error('READING_GENERATION_FAILED')
    if (item.type === 'progress' && typeof item.percent === 'number') onProgress(Math.max(0, Math.min(95, item.percent)))
    if (item.type === 'complete' && item.report && typeof item.report === 'object' && !Array.isArray(item.report)) return item.report
  }
  try {
    while (true) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      let match: RegExpExecArray | null
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        const report = event(block)
        if (report) return report
      }
      if (chunk.done) {
        const report = event(buffer)
        if (report) return report
        throw new Error('READING_INCOMPLETE')
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
