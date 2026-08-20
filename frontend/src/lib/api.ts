import { supabase } from './supabase'
import type { FortuneData, FortuneInput, PartnerData, Pillar, SanmeiResult } from './types'
import { getAnimalFortune, getArchetype, getSukuyoDetail } from './archetype'

// 認証ヘッダー付きfetch（analyze API用）
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return fetch(url, { ...options, headers })
}

interface DivinationResponse {
  shichu: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
  nayin: string
  sanmei: SanmeiResult
  sukuyo: string
  lifePathNumber: number
  honmeiName: string
  numerologyProfile: { birthDayNumber: number; attitudeNumber: number; personalYearNumber: number; personalYear: number }
  kyuseiProfile: { yearStar: string; monthStar: string; dayStar: string; timeStar: string | null }
  timing: {
    decades: Array<{ kanshi: string; startAge: number; endAge: number }>
    annual: Array<{ year: number; kanshi: string }>
  }
}

export async function calculatePerson(birthDate: string, gender: 'male' | 'female', birthTime = ''): Promise<PartnerData> {
  const response = await apiFetch('/api/calc/divination', {
    method: 'POST',
    body: JSON.stringify({ birthDate, birthTime: birthTime || undefined, gender }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? '命式を計算できませんでした')
  }
  const data = await response.json() as DivinationResponse
  return { shichu: data.shichu, nayin: data.nayin, sanmei: data.sanmei, sukuyo: data.sukuyo }
}

export async function calculateFortuneData(input: FortuneInput): Promise<FortuneData> {
  const response = await apiFetch('/api/calc/divination', {
    method: 'POST',
    body: JSON.stringify({ birthDate: input.birthDate, birthTime: input.birthTime || undefined, gender: input.gender }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? '命式を計算できませんでした')
  }
  const data = await response.json() as DivinationResponse
  const currentYear = new Date().getFullYear()
  const birthYear = Number(input.birthDate.slice(0, 4))
  const age = currentYear - birthYear
  const decade = data.timing.decades.find(item => age >= item.startAge && age <= item.endAge) ?? data.timing.decades[0]
  const annual = data.timing.annual.find(item => item.year === currentYear)
  return {
    input,
    shichu: data.shichu,
    nayin: data.nayin,
    sanmei: data.sanmei,
    sukuyo: data.sukuyo,
    lifePathNumber: data.lifePathNumber,
    honmeiName: data.honmeiName,
    numerologyProfile: data.numerologyProfile,
    kyuseiProfile: data.kyuseiProfile,
    archetype: getArchetype(data.shichu.day.kanshi),
    animalFortune: getAnimalFortune(data.shichu.day.kanshi),
    sukuyoDetail: getSukuyoDetail(data.sukuyo),
    daiyun: decade?.kanshi,
    daiyunAge: decade ? `${decade.startAge}〜${decade.endAge}歳` : undefined,
    ryunen: annual?.kanshi,
  }
}
