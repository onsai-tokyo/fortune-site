export type ReportCardKind = 'essence' | 'timing' | 'chart'
export type ReportPageRole = 'opening' | 'core' | 'scene' | 'shadow' | 'exception' | 'question' | 'action' | 'closing'

export interface ReportCardPage {
  role: ReportPageRole
  label: string
  text: string
  note?: string
}

export interface ReportCardEvidence {
  family: string
  system: string
  detail: string
}

export interface ReportCard {
  id: string
  kind: ReportCardKind
  tab?: 'essence' | 'timing' | 'chart'
  title: string
  summary: string
  tags: string[]
  period: { label: string } | null
  pages: ReportCardPage[]
  evidence: ReportCardEvidence[]
  metadataRefs?: string[]
}

export interface StructuredReport {
  version: 2 | 3
  reportText: string
  cards: ReportCard[]
  generator?: 'ai' | 'deterministic'
}

const markerPattern = /\[\[([A-Z]+):([\s\S]*?)\]\]/g
const pageLabels: Array<{ role: ReportPageRole; label: string }> = [
  { role: 'opening', label: 'はじまり' },
  { role: 'core', label: 'ふだんのあなた' },
  { role: 'scene', label: '人といるとき' },
  { role: 'shadow', label: 'つまずくとき' },
  { role: 'exception', label: '意外な一面' },
  { role: 'action', label: '試すなら' },
]

function slug(value: string, index: number) {
  const normalized = value.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase()
  return normalized ? `${normalized}-${index + 1}` : `card-${index + 1}`
}

function cleanText(value: string) {
  return value
    .replace(markerPattern, (_all, name: string, content: string) => name === 'EVIDENCE' ? '' : content)
    .replace(/^[-▸]\s*/, '')
    .replace(/^〈(.+)〉$/, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleFor(category: string, lines: string[], highlight?: string) {
  const highlighted = highlight ? cleanText(highlight).replace(/^\d+\.\s*/, '') : ''
  if (highlighted) return highlighted
  const candidate = lines.find(line => {
    if (line === category || /^\d{4}年/.test(line)) return false
    return !/^(人生の軸|気をつけたいこと|今日から試すこと|惹かれやすい人|恋の始まり方)：/.test(line)
  }) ?? lines[0]
  const sentence = candidate.split(/(?<=[。！？])/u)[0]
    .replace(/^(結論として、|あなたは)/, '')
    .trim()
  if (sentence.length <= 54) return sentence
  return `${sentence.slice(0, 53)}…`
}

function evidenceFrom(section: string): ReportCardEvidence[] {
  const result: ReportCardEvidence[] = []
  for (const match of section.matchAll(/\[\[EVIDENCE:([\s\S]*?)\]\]/g)) {
    for (const entry of match[1].split('||')) {
      const [family, system, ...detail] = entry.split('｜')
      if (!family || !system || detail.length === 0) continue
      const item = { family, system, detail: detail.join('｜') }
      if (!result.some(value => value.family === item.family && value.system === item.system && value.detail === item.detail)) result.push(item)
    }
  }
  return result
}

function tagsForLegacyCategory(category: string) {
  if (/仕事/.test(category)) return ['仕事']
  if (/恋愛|結婚/.test(category)) return ['恋愛', '結婚']
  if (/人間関係/.test(category)) return ['人間関係']
  if (/時期|年/.test(category)) return ['時期']
  return ['本質']
}

export function buildStructuredReport(reportText: string): StructuredReport {
  const matches = [...reportText.matchAll(/^【(.+?)】\s*$/gm)]
  const cards = matches.flatMap((match, index): ReportCard[] => {
    const category = match[1].trim()
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? reportText.length
    const section = reportText.slice(start, end).trim()
    const lines = section.split(/\n+/).map(cleanText).filter(Boolean)
    if (lines.length === 0) return []
    const highlight = section.match(/\[\[HIGHLIGHT:([\s\S]*?)\]\]/)?.[1]
    const title = titleFor(category, lines, highlight)
    const summary = lines.find(line => line !== title) ?? lines[0]
    const pageTexts = [...new Set(lines.filter(line => line !== title))]
    const pages = pageTexts.map((text, pageIndex): ReportCardPage => {
      const template = pageLabels[pageIndex === 0 ? 0 : 1 + ((pageIndex - 1) % 4)]
      return {
        role: pageIndex === pageTexts.length - 1 && pageTexts.length > 1 ? 'action' : template.role,
        label: pageIndex === pageTexts.length - 1 && pageTexts.length > 1 ? '試すなら' : template.label,
        text,
      }
    })
    const kind: ReportCardKind = /時期|年/.test(category) ? 'timing' : 'essence'
    return [{
      id: slug(category, index), kind, title, summary,
      tags: tagsForLegacyCategory(category), period: null, pages,
      evidence: evidenceFrom(section),
    }]
  })
  return { version: 2, reportText, cards }
}
