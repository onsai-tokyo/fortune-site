import type { BirthProfile } from './types'

// The Web form offers Japanese prefectures only. Unknown place stays unknown;
// the explicitly disclosed calendar convention is Japan Standard Time.
export function webBirthCalculation(profile: BirthProfile) {
  return { ...profile, birthplace: profile.birthPlace, birthTimeZone: 'Asia/Tokyo' }
}

export function personalReadingReady(years: readonly unknown[], chapters: readonly unknown[]) {
  return years.length > 0 && chapters.length > 0
}
