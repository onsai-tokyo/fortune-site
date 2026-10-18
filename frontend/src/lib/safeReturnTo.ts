/** Only same-origin app paths. Reject ambiguous encodings rather than repair them. */
export function safeReturnTo(value: string | null | undefined, fallback: string): string
export function safeReturnTo(value: string | null | undefined, fallback: null): string | null
export function safeReturnTo(value: string | null | undefined, fallback: string | null): string | null {
  if (!value || value !== value.trim()) return fallback
  let decoded = value
  try {
    // URLSearchParams already decodes once; also reject nested encoding tricks.
    for (let i = 0; i < 5; i++) {
      if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      if (i === 4) return fallback
      decoded = next
    }
    const origin = 'https://return-path.invalid'
    const parsed = new URL(decoded, origin)
    if (parsed.origin !== origin || parsed.pathname.startsWith('//')) return fallback
    return parsed.pathname + parsed.search + parsed.hash
  } catch { return fallback }
}
