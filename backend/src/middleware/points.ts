import { Response, NextFunction } from 'express'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { AuthRequest } from './auth.js'
import { hasPremiumAccess } from '../lib/premium.js'
import { correlationId } from '../lib/apiError.js'

// ポイントデクリメントミドルウェア（requireAuth の後に使う）
export function requirePoints(cost: number, premiumAccess = hasPremiumAccess) {
  if (!Number.isInteger(cost) || cost <= 0 || cost > 2147483647) throw new Error('Invalid point cost')
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId || !req.accessToken) {
      res.status(401).json({ error: 'ログインが必要です' })
      return
    }

    // プレミアム会員はポイント不要
    let premium: boolean
    try { premium = await premiumAccess(req.userId) }
    catch {
      res.status(503).json({ code: 'DEPENDENCY_NOT_READY', retryable: true, error: '購入状況を確認できませんでした。時間をおいて再試行してください。' })
      return
    }
    if (premium) {
      req.isPremium = true
      next()
      return
    }

    // Service-only RPC; the target owner comes from verified requireAuth, never the request body.
    let newBalance: unknown
    try {
      const { data, error } = await getSupabaseAdmin().rpc('deduct_points', { target_user_id: req.userId, cost })
      if (error || typeof data !== 'number' || !Number.isInteger(data) || data < -1 || data > 2147483647) throw new Error('Invalid point acknowledgement')
      newBalance = data
    } catch {
      res.status(503).json({ code: 'DEPENDENCY_NOT_READY', retryable: true, error: '利用状況を確認できませんでした。時間をおいて再試行してください。' })
      return
    }
    if (newBalance === -1) {
      const requestId = correlationId(req)
      console.warn('Point requirement blocked request', {
        correlationId: requestId,
        route: req.originalUrl,
        cost,
        premium: false,
        rpcErrorCode: null,
      })
      res.status(402).json({
        error: '無料利用枠を使い切りました。継続鑑定を始めるか、購入を復元してください。',
        code: 'INSUFFICIENT_POINTS',
        required: cost,
        correlationId: requestId,
      })
      return
    }

    req.isPremium = false
    req.pointsAfter = newBalance as number
    next()
  }
}

// ポイント加算（決済完了後に呼び出す）
export async function addPoints(userId: string, amount: number): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 2147483647) throw new Error('Invalid point amount')
  const { data, error } = await getSupabaseAdmin().rpc('add_points', { target_user_id: userId, amount })
  if (error || typeof data !== 'number' || !Number.isInteger(data) || data < 0 || data > 2147483647) throw new Error('Point credit acknowledgement unavailable')
  return data
}
