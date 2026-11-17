import type { Gender } from './types'

export function saveGuideBirthDate(birthDate: string, gender?: Gender): boolean
export function readGuideBirthDate(): { birthDate: string; gender: Gender | null } | null
export function clearGuideBirthDate(): void
