import { Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { AuthRequest } from './auth.js'

function getSupabaseWithToken(token: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function checkPremium(userId: string, accessToken: string): Promise<boolean> {
  const supabase = getSupabaseWithToken(accessToken)
  const { data } = await supabase
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  return !!data
}

// ポイントデクリメントミドルウェア（requireAuth の後に使う）
export function requirePoints(cost: number) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId || !req.accessToken) {
      res.status(401).json({ error: 'ログインが必要です' })
      return
    }

    // プレミアム会員はポイント不要
    const premium = await checkPremium(req.userId, req.accessToken)
    if (premium) {
      req.isPremium = true
      next()
      return
    }

    // ポイントをアトミックに deduct
    const supabase = getSupabaseWithToken(req.accessToken)
    const { data: newBalance, error } = await supabase
      .rpc('deduct_points', { target_user_id: req.userId, cost })

    if (error || newBalance === null || newBalance === -1) {
      res.status(402).json({
        error: 'ポイントが不足しています',
        code: 'INSUFFICIENT_POINTS',
        required: cost,
      })
      return
    }

    req.isPremium = false
    req.pointsAfter = newBalance as number
    next()
  }
}

// ポイント加算（決済完了後に呼び出す）
export async function addPoints(userId: string, accessToken: string, amount: number): Promise<number> {
  const supabase = getSupabaseWithToken(accessToken)
  const { data, error } = await supabase
    .rpc('add_points', { target_user_id: userId, amount })
  if (error) throw new Error(error.message)
  return data as number
}
