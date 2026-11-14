import type { BirthProfile, Book, Chapter, CoupleYear, Partner, YearReading } from './types'
export const demoDeliverySections: { heading: string; body: string }[] = []
export const demoAnswer = ''
// Replaces demoData at REMOTE build time. No personal fixture prose is shipped.
export const mockProfile: BirthProfile = { nickname: '', birthDate: '', birthTime: null, birthPlace: '', gender: 'female' }
export const mockPersonaTitle = ''
export const mockChapters: Chapter[] = []
export const mockYears: YearReading[] = []
export const mockPartners: Partner[] = []
export const mockCoupleYears: CoupleYear[] = []
export const mockBooks: Book[] = []
export const mockFailedBook = {} as Book
export const initialSavedIds: string[] = []
export const chapterSections: Record<string, { heading: string; body: string }[]> = {}
