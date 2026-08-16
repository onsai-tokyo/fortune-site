export type PublicReadingShare = {
  tagline: string
  familyCount: number | null
  elements: Record<string, number>
}

const PRIVATE_PATTERN = /(\d{4}[年\-/]\d{1,2}(?:[月\-/]\d{1,2}日?)?|\d{1,2}時\d{1,2}分?|北海道|東京都|(?:京都|大阪)府|.{2,3}県|女性|男性|female|male)/gi

function safeTagline(value: string) {
  const cleaned = value.replace(PRIVATE_PATTERN, '').replace(/[\r\n]/g, ' ').replace(/\s{2,}/g, ' ').trim()
  return cleaned.length >= 4 ? cleaned.slice(0, 80) : '自分らしさを、4つの系統から読み解く鑑定'
}

/** 出生情報や鑑定全文を含まない、公開専用の要点を作る。 */
export function buildPublicReadingShare(conversation: Record<string, unknown>): PublicReadingShare {
  const calculated = (conversation.calculated_data && typeof conversation.calculated_data === 'object')
    ? conversation.calculated_data as Record<string, unknown> : {}
  const elementSource = (calculated.elementBalance && typeof calculated.elementBalance === 'object')
    ? calculated.elementBalance as Record<string, unknown> : {}
  const elements = ['木', '火', '土', '金', '水'].reduce<Record<string, number>>((result, key) => {
    const value = Number(elementSource[key] ?? 0)
    result[key] = Number.isFinite(value) ? Math.max(0, value) : 0
    return result
  }, {})
  const report = String(conversation.report_text ?? '')
  const highlighted = report.match(/\[\[HIGHLIGHT:([^\]]+)\]\]/)?.[1]
    ?? report.match(/\*\*([^*]{4,48})\*\*/)?.[1]
  const tagline = safeTagline(highlighted ?? String(conversation.title ?? 'あなたらしさを読み解く鑑定'))
  const familyMatches = [...report.matchAll(/(\d)系統/g)].map(match => Number(match[1])).filter(value => value >= 0 && value <= 4)
  return { tagline, familyCount: familyMatches.length ? Math.max(...familyMatches) : null, elements }
}
