import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportCardPage, StructuredReport } from '../reportCards.js'

function meaningfulTitle(themes: string[], fallback: string) {
  const text = themes.join('・')
  if (/仕事|責任|役割|成果|肩書/.test(text)) return '仕事で担う役割が広がる節目です'
  if (/恋愛|結婚|縁|関係|出会/.test(text)) return '人との関わり方が大きく変わる節目です'
  if (/変化|転換|刷新|移動|挑戦/.test(text)) return '環境を変える決断が増える時期です'
  if (/学|探究|資格|知識/.test(text)) return '学び直したことが次の軸になる時期です'
  if (/収入|財|お金|現実/.test(text)) return '現実的な成果を積み上げる節目です'
  if (/休|整理|内省|見直/.test(text)) return '立ち止まって前提を組み替える時期です'
  return fallback
}

function pagesFor(period: string, themes: string[], details: string[]): ReportCardPage[] {
  const theme = themes.join('・') || '役割と環境の切り替え'
  const detail = details.filter(Boolean).join('・') || '複数の計算で変化が重なる'
  return [
    { role: 'opening', label: 'この節目', text: `${period}は、${theme}が前面に出る節目です。` },
    { role: 'core', label: '流れの中心', text: `この期間の中心は、${theme}を現実の選択へ移すことです。` },
    { role: 'scene', label: '起こりやすい場面', text: `役割や人間関係を選び直す場面で、判断の差が表れます。` },
    { role: 'scene', label: '変化の手がかり', text: `${detail}ことが、切り替わりの手がかりになります。` },
    { role: 'shadow', label: '急がないこと', text: `変化を一度に確定すると、生活条件の確認が後回しになります。` },
    { role: 'exception', label: '意外な動き', text: `前へ進むだけでなく、続けないものを決めるほど流れが整います。` },
    { role: 'action', label: '確かめること', text: `続ける役割、手放す役割、守る条件を一つずつ書き出してください。` },
    { role: 'closing', label: '詳しく読む', text: `この時期の選択は、AIチャットで状況を重ねて確認できます。` },
  ]
}

function card(id: string, title: string, period: string, themes: string[], details: string[]): ReportCard {
  const pages = pagesFor(period, themes, details)
  return {
    id, kind: 'timing', title, summary: pages[0].text, tags: ['時期', ...themes.slice(0, 2)],
    period: { label: period }, pages,
    evidence: [{ family: '干支系', system: '四柱推命', detail: details[0] || themes.join('・') }],
    metadataRefs: ['turningPoints'],
  }
}

export function buildTurningPointCards(input: ReportInput, nowYear = new Date().getFullYear()): ReportCard[] {
  const start = nowYear - 15
  const end = nowYear + 20
  const decades = (input.timing?.decades ?? [])
    .filter(item => item.endYear >= start && item.startYear <= end)
    .map(item => card(
      `turning-decade-${item.startYear}`,
      meaningfulTitle(item.themes, '長く続ける役割を選び直す時期です'),
      `${item.startYear} - ${item.endYear}`,
      item.themes,
      [`${item.kanshi}・${item.tenGod}`],
    ))
  const annual = [...(input.timing?.annual ?? [])]
    .filter(item => item.year >= start && item.year <= end)
    .sort((a, b) => b.score - a.score || a.year - b.year)
    .slice(0, 6)
    .sort((a, b) => a.year - b.year)
    .map(item => card(
      `turning-year-${item.year}`,
      meaningfulTitle([...item.themes, ...item.relationshipSignals], '選択の優先順位が入れ替わる節目です'),
      `${item.year}年（${item.ageRange}）`,
      item.themes,
      [item.kanshi, item.tenGod, ...item.relationshipSignals, ...(item.relationshipEvents ?? [])],
    ))
  return [...decades, ...annual].sort((a, b) => (a.period?.label ?? '').localeCompare(b.period?.label ?? ''))
}

export function replaceTimingCards(report: StructuredReport, input: ReportInput): StructuredReport {
  const timing = buildTurningPointCards(input)
  if (timing.length === 0) return report
  const cards = [...report.cards.filter(item => item.kind !== 'timing'), ...timing]
  const reportText = cards.flatMap(item => [`【${item.title}】`, ...item.pages.map(page => page.text)]).join('\n\n')
  return { ...report, reportText, cards }
}
