import type { CoupleFocus } from './readingFocus.js'
import type { Chapter, CoupleYear, YearReading } from './types'

export function focusChapters(chapters: Chapter[], focus: CoupleFocus, relation?: string) {
  const romantic = !relation || ['片思い','お付き合い中','婚約中','夫婦','復縁希望','元恋人'].includes(relation)
  const ids = focus === 'aite' ? ['personality-04', 'personality-07', romantic ? 'personality-09' : 'personality-02']
    : focus === 'kataomoi' ? ['personality-08', 'personality-07', 'personality-09']
      : ['personality-09', 'personality-07', 'personality-04']
  return ids.flatMap(id => chapters.filter(chapter => chapter.id === id))
}

export function focusCoupleYears(years: CoupleYear[], focus: CoupleFocus, referenceYear: number, breakupYear?: number) {
  const from = focus === 'fukuen' && breakupYear !== undefined ? breakupYear : referenceYear
  return [...years.filter(row => row.year >= from).sort((a,b) => a.year-b.year),
    ...years.filter(row => row.year < from).sort((a,b) => b.year-a.year)]
}

type Annual = { year: number; kanshi: string; tenGod: string; relationshipSignals: string[]; relationshipEvents: string[]; themes: string[] }
export type MarriageTiming = { annual: Annual[]; marriageCandidates: Annual[] }
export function marriageYears(timing: MarriageTiming, from: number): YearReading[] {
  const years = timing.annual.filter(year => year.year >= from && year.year < from + 10).sort((a,b) => a.year-b.year)
  if (years.length !== 10 || years.some((year,i) => year.year !== from+i)) throw new Error('TEN_YEARS_UNAVAILABLE')
  const candidates = new Set(timing.marriageCandidates.map(year => year.year))
  return years.map(year => {
    const events = year.relationshipEvents.join('。')
    return {
      year: year.year, label: year.year === from ? '今年' : '', title: `${year.kanshi}・${year.tenGod}の年`,
      tags: candidates.has(year.year) ? ['婚期の候補'] : [],
      summary: events || year.themes.join('。'),
      sections: [
        { heading: '関係のテーマ', body: events || 'この年は、関係の節目を示す目印が計算結果に出ていません。結婚できない年という意味ではありません。' },
        { heading: '計算の根拠', body: year.relationshipSignals.join('。') || '配偶者星や日支との関係を示す目印は、この年の計算結果にはありません。' },
        { heading: '一年のテーマ', body: year.themes.join('。') },
      ],
    }
  })
}
