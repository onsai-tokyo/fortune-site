import type { BookTheme, Chapter, CoupleYear, Partner, ReadingSection, SavedReading, YearReading } from './types'
export type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'needs_meeting_year'
export const savedKey = { year: (y: number) => `you-${y}`, chapter: (id: string) => `chapter-${id}`, couple: (id: string, y: number) => `couple-${id}-${y}`, couplePrefix: (id: string) => `couple-${id}-` }
export function realText(value: unknown): string {
  const text = typeof value === 'string' ? value : ''
  if (new RegExp('\\uFF3Bサンプル\\uFF3D').test(text)) throw new Error('DEMO_CONTENT_REJECTED')
  return text
}
type RawCard = { id?: string; title?: string; summary?: string; kind?: string; tab?: string; scope?: string; access?: { locked?: boolean }; tags?: string[]; sections?: { heading?: string; body?: string }[]; pages?: { label?: string; text?: string }[] }
export function readingSections(card: RawCard): ReadingSection[] {
  if (card.access?.locked) return []
  return (card.sections?.length ? card.sections.map(s => ({ heading: realText(s.heading), body: realText(s.body) })) : (card.pages ?? []).map(p => ({ heading: realText(p.label), body: realText(p.text) }))).filter(s => s.body)
}
export function personalReadings(timing: RawCard[], cards: RawCard[], sourceId: string, image: string) {
  const usable = cards.filter(c => c.kind !== 'timing' && c.tab !== 'timing' && c.kind !== 'chart' && c.tab !== 'chart' && (!c.scope || c.scope === 'self') && !c.access?.locked)
  const chapters: Chapter[] = usable.map(c => ({ id: String(c.id), title: realText(c.title), sub: realText(c.summary), image, sections: readingSections(c), sourceId, sourceCardId: c.id }))
  const years: YearReading[] = timing.filter(c => !c.access?.locked).map(c => {
    const year = Number(c.id?.match(/(?:^|[-_])(\d{4})(?:$|[-_])/)?.[1])
    return { year, label: year === new Date().getFullYear() ? '今年' : '', title: realText(c.title), tags: (c.tags ?? []).map(realText), summary: realText(c.summary), sections: readingSections(c), sourceId, sourceCardId: c.id }
  }).filter(y => Number.isInteger(y.year) && y.year > 0)
  return { chapters, years, personaTitle: chapters[0]?.title ?? '' }
}
export function coupleReadings(raw: { entries?: { year: number; label?: string | null; contentStatus: string; card?: RawCard | null }[] }): CoupleYear[] {
  return (raw.entries ?? []).filter(e => e.contentStatus === 'ready' && e.card && !e.card.access?.locked).map(e => ({ year: e.year, label: realText(e.label), title: realText(e.card!.title), you: '', partner: '', body: readingSections(e.card!).map(s => s.body), sourceCardId: e.card!.id }))
}
export type SourceItem = { href: string; title: string; sub: string; theme: BookTheme; sourceId?: string; sourceCardId?: string }
export function sourceCatalog(partners: Partner[], years: YearReading[], chapters: Chapter[], couples: Record<string, CoupleYear[]>): { label: string; items: SourceItem[] }[] {
  return [
    { label: 'あなたの年ごとの流れ', items: years.map(y => ({ href: `/you/years/${y.year}`, title: `あなたの${y.year}年`, sub: y.title, theme: '時期の判断' as BookTheme, sourceId: y.sourceId, sourceCardId: y.sourceCardId })) },
    { label: 'あなたの性格の章', items: chapters.map(c => ({ href: `/you/chapters/${c.id}`, title: c.title, sub: '性格の章', theme: 'その他' as BookTheme, sourceId: c.sourceId, sourceCardId: c.sourceCardId })) },
    ...partners.map(p => ({ label: `${p.name}との年表`, items: (couples[p.id] ?? []).map(y => ({ href: `/couple/${p.id}?year=${y.year}`, title: `${p.name}との${y.year}年`, sub: y.title, theme: (/^(片思い|お付き合い中|婚約中|夫婦|復縁希望|元恋人)$/.test(p.relation) ? '恋愛・関係' : '人間関係') as BookTheme, sourceCardId: y.sourceCardId })) })),
  ]
}
export function savedCatalog(partners: Partner[], years: YearReading[] = [], chapters: Chapter[] = [], couples: Record<string, CoupleYear[]> = {}): SavedReading[] {
  return [ ...years.map(y => ({ id: savedKey.year(y.year), kind: 'you' as const, label: 'あなた ・ 年ごとの流れ', title: `${y.year}年 ${y.title}`, href: `/you/years/${y.year}` })), ...chapters.map(c => ({ id: savedKey.chapter(c.id), kind: 'you' as const, label: 'あなた ・ 性格の章', title: c.title, href: `/you/chapters/${c.id}` })), ...partners.flatMap(p => (couples[p.id] ?? []).map(y => ({ id: savedKey.couple(p.id, y.year), kind: 'couple' as const, label: `ふたり ・ ${p.name}`, title: `${y.year}年 ${y.title}`, href: `/couple/${p.id}?year=${y.year}` }))) ]
}
