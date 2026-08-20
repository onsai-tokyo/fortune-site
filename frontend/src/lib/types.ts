export interface Pillar {
  stemIdx: number
  branchIdx: number
  stem: string
  branch: string
  element: string
  yinYang: string
  kanshi: string
}

export interface SanmeiResult {
  shukumeiStar: string
  chusatsu: string
}

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
  numerologyProfile?: { birthDayNumber: number; attitudeNumber: number; personalYearNumber: number; personalYear: number }
  kyuseiProfile?: { yearStar: string; monthStar: string; dayStar: string; timeStar: string | null }
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

export interface BossAnalysis {
  bossType: string
  leadershipStyle: string
  values: string[]
  preferredWords: string[]
  ngWords: string[]
  communicationTips: Array<{ situation: string; advice: string }>
  chemistryWithYou: { score: number; description: string }
  monthlyStrategy: string
}

export interface SubordinateAnalysis {
  subordinateType: string
  workStyle: string
  motivators: string[]
  strengths: Array<{ name: string; description: string }>
  growthAreas: Array<{ area: string; approach: string }>
  managementTips: Array<{ situation: string; advice: string }>
  chemistryWithYou: { score: number; description: string }
  caution: string
}

export interface ClientAnalysis {
  clientType: string
  decisionStyle: string
  trustFactors: string[]
  communicationPreferences: Array<{ channel: string; style: string }>
  approachStrategies: Array<{ phase: string; strategy: string }>
  taboos: string[]
  chemistryWithYou: { score: number; description: string }
  nextAction: string
}

export interface DirectionAnalysis {
  luckyDirections: Array<{ direction: string; effect: string; usage: string }>
  unluckyDirections: Array<{ direction: string; reason: string; mitigation: string }>
  monthlyBest: string
  relocationAdvice: string
  travelTips: string
  officeLayout: string
}
