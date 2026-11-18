export type ReadingFocus = 'fukuen' | 'kataomoi' | 'aite' | 'konki'
export type CoupleFocus = Exclude<ReadingFocus, 'konki'>
type FocusPage = { path: string; guide: string; title: string; heading: string; description: string; intro: string; mechanism: string; resultHeading: string; chapterHeading: string; button: string; relation: string; guideTitle: string; guideDescription: string; faqs: string[][] }
export const readingFocusPages: Record<ReadingFocus, FocusPage>
export const readingFocusPaths: string[]
export function readingFocusForPath(path: string): ReadingFocus | undefined
export function readingFocusLandingHtml(focus: ReadingFocus): string
