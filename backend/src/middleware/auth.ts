import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )
}

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
    res.status(401).json({ error: 'ログインが必要です' })
    return
  }

  const token = authHeader.slice(7)
  const supabase = getSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    res.status(401).json({ error: 'セッションが無効です。再度ログインしてください。' })
    return
  }

  req.userId = user.id
  req.userEmail = user.email
  req.accessToken = token
  next()
}

// 鑑定APIは登録必須。ローカルでゲスト導線を明示的に確認するときだけ false にする。
export async function requireReadingAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (process.env.REQUIRE_READING_AUTH === 'false') { next(); return }
  await requireAuth(req, res, next)
}

// サブスク有効確認ミドルウェア
export async function requireSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId || !req.accessToken) {
    res.status(401).json({ error: 'ログインが必要です' })
    return
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${req.accessToken}` } } }
  )

  const { data } = await supabase
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', req.userId)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()

  if (!data) {
    res.status(403).json({ error: 'プレミアム会員のみご利用いただけます' })
    return
  }

  next()
}
