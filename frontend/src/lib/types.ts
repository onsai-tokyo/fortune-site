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
  // 拡張占術データ（プレビューと同レベルの精度を実現）
  lifePathNumber?: number
  honmeiName?: string
  archetype?: string
  animalFortune?: string
  sukuyoDetail?: string
  daiyun?: string
  daiyunAge?: string
  ryunen?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SelfAnalysis {
  corePersonality: string
  lifeTheme: string
  strengths: Array<{ name: string; score: number; description: string }>
  weaknesses: Array<{ name: string; description: string; advice: string }>
  careers: Array<{ title: string; match: number; reason: string }>
  turningPoints: Array<{ year: number; age: number; theme: string; description: string; type: 'opportunity' | 'challenge' | 'transformation' }>
}

export interface CompatibilityAnalysis {
  overall: number
  work: { score: number; summary: string; strengths: string[]; challenges: string[]; advice: string }
  romantic: { score: number; summary: string; strengths: string[]; challenges: string[]; advice: string }
  dynamic: string
}

export interface OrgMember {
  name: string
  birthDate: string
  gender: 'male' | 'female'
}

export interface OrganizationAnalysis {
  teamScore: number
  teamType: string
  keyPerson: { name: string; reason: string }
  battleStrategy: string
  strengths: string[]
  challenges: string[]
  relationships: Array<{ members: string[]; dynamic: string; description: string }>
  roles: Array<{ name: string; suggestedRole: string; strength: string }>
  strategy: string
  advice: string
}

export interface MarriageAnalysis {
  overallScore: number
  marriageType: string
  lifeDescription: string
  powerDynamic: { leader: string; description: string; balance: string }
  successKeys: Array<{ key: string; description: string }>
  challenges: Array<{ issue: string; description: string; solution: string }>
  compatibility: { daily: number; crisis: number; growth: number; passion: number }
  advice: string
}

export interface NumerologyResult {
  lifePathNumber: number
  birthdayNumber: number
  meaning: {
    title: string
    summary: string
    talent: string
    mission: string
  }
}

export interface KyuseiResult {
  honmeiStar: number
  honmeiName: string
  tsukimeiStar: number
  tsukimeiName: string
  element: string
  personality: string
  luckyDirection: string
  luckyColor: string
  yearFortune: string
}

export interface RecruitAnalysis {
  candidateType: string
  fitScore: number
  strengths: Array<{ name: string; score: number; description: string }>
  weaknesses: Array<{ name: string; description: string; mitigation: string }>
  workStyle: string
  chemistryWithYou: { score: number; dynamic: string; description: string }
  interviewQuestions: string[]
  hiringAdvice: string
}
