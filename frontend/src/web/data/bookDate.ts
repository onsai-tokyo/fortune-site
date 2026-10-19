/** Date-only demo values and API instants have different timezone semantics. */
export function formatBookDate(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    const [, y, m, d] = dateOnly.map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? `${m}月${d}日` : '日付不明'
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '日付不明'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '日付不明'
  const parts = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }).formatToParts(date)
  return `${parts.find(p => p.type === 'month')!.value}月${parts.find(p => p.type === 'day')!.value}日`
}
