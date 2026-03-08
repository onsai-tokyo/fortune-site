import type { Pillar } from './shichu'
import type { SanmeiResult } from './sanmei'

export interface FortuneInput {
  birthDate: string      // YYYY-MM-DD
  birthTime: string      // HH:MM or ""
  gender: 'male' | 'female'
  mbti: string           // e.g. "INFJ" or ""
  question: string
  partnerBirthDate: string  // YYYY-MM-DD or ""
  partnerBirthTime: string  // HH:MM or ""
  partnerGender: 'male' | 'female'
  partnerMbti: string
}

export interface PartnerData {
  shichu: {
    year: Pillar
    month: Pillar
    day: Pillar
    hour: Pillar | null
  }
  nayin: string
  sanmei: SanmeiResult
  sukuyo: string
}

export interface FortuneData {
  input: FortuneInput
  shichu: {
    year: Pillar
    month: Pillar
    day: Pillar
    hour: Pillar | null
  }
  nayin: string
  sanmei: SanmeiResult
  sukuyo: string
  partner?: PartnerData
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
