import type { Response, NextFunction } from 'express'
import type { AuthRequest } from './auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { calcAge } from '../lib/age.js'

export function declaredAdult(birthDate: unknown, now = new Date()): boolean {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false
  const parsed = new Date(birthDate + 'T00:00:00Z')
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) return false
  const age = calcAge(birthDate, now)
  return age !== null && age >= 18
}

// Web routes only. Never trust the request's source (which may describe a partner)
// or a supplied birth date/age flag. This uses the owner's saved self reading.
// This is declared-age gating, not identity-document age verification.
export async function requireWebAiAdult(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { data, error } = await getSupabaseAdmin().from('reading_conversations')
      .select('birth_data').eq('user_id', req.userId!)
      .or('kind.eq.self,kind.eq.personal,kind.is.null')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    const birth = data?.birth_data
    if (!declaredAdult(birth?.birthDate ?? birth?.birth_date)) {
      res.status(403).json({ code: 'WEB_AI_ADULT_ONLY', error: 'AIの相談ブック作成・質問は18歳以上の方が利用できます。本人の生年月日を確認してください。無料の読みもの・年表は15歳以上の方が利用できます。' })
      return
    }
    next()
  } catch {
    res.status(503).json({ code: 'WEB_AI_AGE_UNAVAILABLE', error: '利用年齢を確認できませんでした。時間をおいて再度お試しください。' })
  }
}
