import { Request, Response, NextFunction } from 'express'
import { verifySupabaseAccessTokenResult } from '../lib/rateLimitIdentity.js'
import { correlationId, sendApiError } from '../lib/apiError.js'

export interface AuthRequest extends Request {
  userId?: string
  userEmail?: string
  accessToken?: string
  isPremium?: boolean
  pointsAfter?: number
}

// JWT検証ミドルウェア（必須）
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    sendApiError(res, 401, 'AUTH_SESSION_INVALID', 'ログイン状態を更新できませんでした。もう一度ログインしてください。', false, correlationId(req))
    return
  }

  const token = authHeader.slice(7)
  const result = await verifySupabaseAccessTokenResult(token, process.env.SUPABASE_JWT_SECRET, process.env.SUPABASE_URL)
  if (result.status === 'unavailable') {
    sendApiError(res, 503, 'DEPENDENCY_NOT_READY', '認証サービスに接続できません。時間を置いて再試行してください。', true, correlationId(req))
    return
  }
  if (result.status !== 'valid') {
    sendApiError(res, 401, 'AUTH_SESSION_INVALID', 'ログイン状態を更新できませんでした。もう一度ログインしてください。', false, correlationId(req))
    return
  }

  const payload = result.payload
  req.userId = payload.sub
  req.userEmail = typeof payload.email === 'string' ? payload.email : undefined
  req.accessToken = token
  next()
}

// 鑑定APIは登録必須。ローカルでゲスト導線を明示的に確認するときだけ false にする。
export async function requireReadingAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production' && process.env.REQUIRE_READING_AUTH === 'false') { next(); return }
  await requireAuth(req, res, next)
}
