import { createHash } from 'crypto'
import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard } from '../reportCards.js'

export type CurrentRole = 'student' | 'employee' | 'owner' | 'caregiver' | 'job-seeking' | 'other'
export type CurrentConcern = 'work' | 'love' | 'marriage' | 'relationships' | 'money' | 'direction'

export interface OptionalProfile {
  nickname?: string
  currentRole?: CurrentRole
  currentConcern?: CurrentConcern
}

export interface ReportMetadata {
  dominantElements: Array<{ element: string; score: number }>
  missingElements: Array<{ element: string; score: number; severity: 'missing' | 'low' }>
  contradictions: Array<{ source: string; detail: string }>
  relationshipDistortions: Array<{ relation: string; pillars: string; meaning: string }>
  domainHighlights: Array<{ palace: string; star: string; mutagen: string }>
  turningPoints: {
    decades: NonNullable<ReportInput['timing']>['decades']
    annual: NonNullable<ReportInput['timing']>['annual']
  }
  age: number | null
  lifeStage: 'teen' | 'early-20s' | 'late-20s' | '30s' | '40s' | '50s' | '60-plus' | 'unknown'
  profile: OptionalProfile
  combinationSignature: string
  contentCacheSignature: string
}

const concernTag: Record<CurrentConcern, string> = {
  work: '仕事', love: '恋愛', marriage: '結婚', relationships: '人間関係', money: 'お金', direction: '本質',
}

export function prioritizeCardsForConcern(cards: ReportCard[], concern?: CurrentConcern): ReportCard[] {
  if (!concern) return cards
  const tag = concernTag[concern]
  return cards
    .map((card, index) => ({ card, index, preferred: card.tags.includes(tag) || card.title.includes(tag) || card.summary.includes(tag) }))
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.index - b.index)
    .map(item => item.card)
}

function lifeStage(age?: number): ReportMetadata['lifeStage'] {
  if (age === undefined || !Number.isFinite(age)) return 'unknown'
  if (age < 20) return 'teen'
  if (age < 25) return 'early-20s'
  if (age < 30) return 'late-20s'
  if (age < 40) return '30s'
  if (age < 50) return '40s'
  if (age < 60) return '50s'
  return '60-plus'
}

function cleanProfile(profile: OptionalProfile): OptionalProfile {
  const nickname = profile.nickname?.trim().slice(0, 40)
  return {
    ...(nickname ? { nickname } : {}),
    ...(profile.currentRole ? { currentRole: profile.currentRole } : {}),
    ...(profile.currentConcern ? { currentConcern: profile.currentConcern } : {}),
  }
}

export function normalizeBirthTime(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function extractReportMetadata(input: ReportInput, optionalProfile: OptionalProfile = {}): ReportMetadata {
  const entries = Object.entries(input.elementBalance?.scores ?? {})
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const maxScore = entries[0]?.[1] ?? 0
  const dominantElements = entries.filter(([, score]) => score === maxScore && maxScore > 0)
    .map(([element, score]) => ({ element, score }))
  const missingElements = entries
    .filter(([, score]) => score === 0 || (maxScore > 0 && score / maxScore <= 0.15))
    .map(([element, score]) => ({ element, score, severity: score === 0 ? 'missing' as const : 'low' as const }))

  const contradictions: ReportMetadata['contradictions'] = []
  if (input.strength) {
    const balance = input.strength.supportRatio >= 0.5 ? '身強側' : '身弱側'
    contradictions.push({
      source: 'strength',
      detail: `${input.strength.label}（${balance}）で、補う要素は${input.strength.favorableElements.join('・') || '算出なし'}`,
    })
  }
  for (const aspect of input.astrology?.western?.aspects ?? []) {
    if (/スクエア|オポジション|square|opposition|90°|180°/i.test(aspect)) {
      contradictions.push({ source: 'astrology', detail: aspect })
    }
  }

  const relationshipDistortions = (input.sanmeiRelations?.relations ?? [])
    .filter(item => /冲|刑|害|破/.test(item.relation))
    .map(item => ({ relation: item.relation, pillars: item.pillars, meaning: item.meaning }))
  const domainHighlights = (input.ziwei?.palaces ?? []).flatMap(palace =>
    palace.majorStars
      .filter(star => star.mutagen && !/なし|算出なし/.test(star.mutagen))
      .map(star => ({ palace: palace.name, star: star.name, mutagen: star.mutagen })),
  )
  const profile = cleanProfile(optionalProfile)
  const signatureSource = JSON.stringify({
    birthDate: input.birthDate,
    shichuDay: input.shichuDay,
    elements: entries,
    strength: input.strength?.label,
    relations: relationshipDistortions.map(item => item.relation),
    mutagens: domainHighlights.map(item => `${item.palace}:${item.star}:${item.mutagen}`),
    lifePathNumber: input.lifePathNumber,
    sukuyo: input.sukuyo,
  })

  const combinationSignature = createHash('sha256').update(signatureSource).digest('hex').slice(0, 16)
  const profileDigest = createHash('sha256').update(JSON.stringify({
    nickname: profile.nickname ?? null,
    currentRole: profile.currentRole ?? null,
    currentConcern: profile.currentConcern ?? null,
  })).digest('hex').slice(0, 16)
  const contentCacheSignature = createHash('sha256').update(JSON.stringify({
    birthDate: input.birthDate ?? null,
    birthTime: normalizeBirthTime(input.birthTime),
    birthplace: input.birthplace ?? null,
    gender: input.gender ?? null,
    profileDigest,
    combinationSignature,
  })).digest('hex').slice(0, 32)

  return {
    dominantElements,
    missingElements,
    contradictions,
    relationshipDistortions,
    domainHighlights,
    turningPoints: {
      decades: input.timing?.decades ?? [],
      annual: input.timing?.annual ?? [],
    },
    age: input.age ?? null,
    lifeStage: lifeStage(input.age),
    profile,
    combinationSignature,
    contentCacheSignature,
  }
}
