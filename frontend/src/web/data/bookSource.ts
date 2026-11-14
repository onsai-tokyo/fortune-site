import type { Book, Chapter, CoupleYear, Partner, YearReading } from './types'

export interface BookSourceContext {
  selfSourceId?: string
  years: YearReading[]
  chapters: Chapter[]
  partners: Partner[]
  coupleYears: Record<string, CoupleYear[]>
  bookSourcePartners?: Record<string, string>
}

/** Match owner-loaded source/card IDs, never infer a route from prose or a year alone. */
export function resolveBookSource(book: Book, context: BookSourceContext): Book {
  const unavailable = { ...book, sourceHref: '', sourceSub: '' }
  if (!book.sourceId || !book.sourceCardId) return unavailable
  if (book.sourceId === context.selfSourceId) {
    const year = context.years.find(y => y.sourceId === book.sourceId && y.sourceCardId === book.sourceCardId)
    if (year) return { ...book, sourceTitle: `あなたの${year.year}年`, sourceSub: year.title, sourceHref: `/you/years/${year.year}` }
    const chapter = context.chapters.find(c => c.sourceId === book.sourceId && c.sourceCardId === book.sourceCardId)
    if (chapter) return { ...book, sourceTitle: chapter.title, sourceSub: '性格の章', sourceHref: `/you/chapters/${encodeURIComponent(chapter.id)}` }
    return unavailable
  }
  const partnerId = context.bookSourcePartners?.[book.sourceId]
  const partner = context.partners.find(p => p.id === partnerId)
  const year = partner && (context.coupleYears[partner.id] ?? []).find(y => y.sourceCardId === book.sourceCardId)
  return partner && year ? { ...book, sourceTitle: `${partner.name}との${year.year}年`, sourceSub: year.title, sourceHref: `/couple/${encodeURIComponent(partner.id)}?year=${year.year}` } : unavailable
}
