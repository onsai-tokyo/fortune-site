const MARKER = '---NEXT---'

export class StreamingAnswerParser {
  private bodyMode = true
  private pending = ''
  private answer = ''
  private suggestionsText = ''

  push(chunk: string): string {
    if (!this.bodyMode) { this.suggestionsText += chunk; return '' }
    this.pending += chunk
    const markerIndex = this.pending.indexOf(MARKER)
    if (markerIndex >= 0) {
      const safe = this.pending.slice(0, markerIndex)
      this.answer += safe
      this.suggestionsText += this.pending.slice(markerIndex + MARKER.length)
      this.pending = ''
      this.bodyMode = false
      return safe
    }
    let retained = 0
    const maximum = Math.min(MARKER.length - 1, this.pending.length)
    for (let size = maximum; size > 0; size--) {
      if (MARKER.startsWith(this.pending.slice(-size))) { retained = size; break }
    }
    const safe = retained ? this.pending.slice(0, -retained) : this.pending
    this.pending = retained ? this.pending.slice(-retained) : ''
    this.answer += safe
    return safe
  }

  finish() {
    const finalDelta = this.bodyMode ? this.pending : ''
    if (finalDelta) { this.answer += finalDelta; this.pending = '' }
    const answer = this.answer.replace(/^次の質問[：:].*$/gm, '').trim()
    const suggestions = this.suggestionsText.split('\n')
      .map(line => line.replace(/^[-・*\d.\s]+/, '').replace(/^次の質問[：:]\s*/, '').trim())
      .filter(Boolean).slice(0, 3)
    return { answer, suggestions, finalDelta }
  }
}
