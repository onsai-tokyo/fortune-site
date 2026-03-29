import { Router } from 'express'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { addPoints } from '../middleware/points.js'

export const paymentRouter = Router()

const PAYJP_API = 'https://api.pay.jp/v1'

function getAuthHeader(): string {
  const secretKey = process.env.PAYJP_SECRET_KEY!
  return 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
}

async function payjpRequest(path: string, method: string, body?: Record<string, string>) {
  const headers: Record<string, string> = { Authorization: getAuthHeader() }
  let bodyStr: string | undefined
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    bodyStr = new URLSearchParams(body).toString()
  }
  const res = await fetch(`${PAYJP_API}${path}`, { method, headers, body: bodyStr })
  return res.json()
}

function getTokenSecret(): string {
  return process.env.TOKEN_SECRET ?? 'fortune-dev-secret'
}

export function createPaidToken(id: string): string {
  const hmac = crypto.createHmac('sha256', getTokenSecret()).update(id).digest('hex')
  return `${id}.${hmac}`
}

export function verifyPaidToken(token: string): boolean {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return false
    const id = token.slice(0, dotIdx)
    const hmac = token.slice(dotIdx + 1)
    const expected = crypto.createHmac('sha256', getTokenSecret()).update(id).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

async function saveSubscription(userId: string, accessToken: string, chargeId: string, plan: string) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { error } = await supabase.from('subscriptions').insert({
    user_id: userId,
    plan,
    expires_at: expiresAt,
    payjp_charge_id: chargeId,
  })
  if (error) console.error('Subscription save error:', error)
}

// プレミアム会員サブスク（¥1,980/月）- 要ログイン
paymentRouter.post('/subscribe-monthly', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const charge = await payjpRequest('/charges', 'POST', {
      amount: '1980',
      currency: 'jpy',
      card: payjpToken,
      description: 'プレミアム会員 - 6占術AIチャット相談し放題（月額）',
    })

    if (charge.error) throw new Error(charge.error.message ?? '決済に失敗しました')

    await saveSubscription(req.userId!, req.accessToken!, charge.id, 'monthly')

    res.json({ success: true, type: 'subscription' })
  } catch (err) {
    console.error('Subscribe monthly error:', err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
})

// 質問詳細回答（¥500）- 要ログイン
paymentRouter.post('/charge-question', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const charge = await payjpRequest('/charges', 'POST', {
      amount: '500',
      currency: 'jpy',
      card: payjpToken,
      description: 'ご質問への詳細回答（1回分）',
    })

    if (charge.error) throw new Error(charge.error.message ?? '決済に失敗しました')

    const token = createPaidToken(charge.id)
    res.json({ token, type: 'question' })
  } catch (err) {
    console.error('Charge question error:', err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
})

// サブスク解約（即時）
paymentRouter.post('/cancel-subscription', requireAuth, async (req: AuthRequest, res) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${req.accessToken}` } } }
    )
    const { error } = await supabase
      .from('subscriptions')
      .update({ expires_at: new Date().toISOString() })
      .eq('user_id', req.userId!)
      .gt('expires_at', new Date().toISOString())
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('Cancel subscription error:', err)
    res.status(500).json({ error: '解約処理に失敗しました' })
  }
})

// AIチャット（¥500 旧エンドポイント・互換用）
paymentRouter.post('/subscribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const charge = await payjpRequest('/charges', 'POST', {
      amount: '500',
      currency: 'jpy',
      card: payjpToken,
      description: 'AIチャット無制限プラン',
    })

    if (charge.error) throw new Error(charge.error.message ?? '決済に失敗しました')

    const token = createPaidToken(charge.id)
    res.json({ token, type: 'chat' })
  } catch (err) {
    console.error('Subscribe error:', err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
})

// 詳細レポート（¥2,000）
paymentRouter.post('/charge-report', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const charge = await payjpRequest('/charges', 'POST', {
      amount: '2000',
      currency: 'jpy',
      card: payjpToken,
      description: '宿命構造分析書（詳細版）',
    })

    if (charge.error) throw new Error(charge.error.message ?? '決済に失敗しました')

    const token = createPaidToken(charge.id)
    res.json({ token, type: 'report' })
  } catch (err) {
    console.error('Charge report error:', err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
})

// ポイントパック購入: スモール（¥480 → 30pt）
paymentRouter.post('/buy-points-small', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const charge = await payjpRequest('/charges', 'POST', {
      amount: '480',
      currency: 'jpy',
      card: payjpToken,
      description: 'ポイントパック スモール 30pt',
    })

    if (charge.error) throw new Error(charge.error.message ?? '決済に失敗しました')

    const newBalance = await addPoints(req.userId!, req.accessToken!, 30)
    res.json({ success: true, pointsAdded: 30, newBalance })
  } catch (err) {
    console.error('Buy points small error:', err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
})

// ポイントパック購入: スタンダード（¥980 → 80pt）
paymentRouter.post('/buy-points-standard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const charge = await payjpRequest('/charges', 'POST', {
      amount: '980',
      currency: 'jpy',
      card: payjpToken,
      description: 'ポイントパック スタンダード 80pt',
    })

    if (charge.error) throw new Error(charge.error.message ?? '決済に失敗しました')

    const newBalance = await addPoints(req.userId!, req.accessToken!, 80)
    res.json({ success: true, pointsAdded: 80, newBalance })
  } catch (err) {
    console.error('Buy points standard error:', err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
})

// ポイントパック購入: ラージ（¥1,980 → 200pt）
paymentRouter.post('/buy-points-large', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const charge = await payjpRequest('/charges', 'POST', {
      amount: '1980',
      currency: 'jpy',
      card: payjpToken,
      description: 'ポイントパック ラージ 200pt',
    })

    if (charge.error) throw new Error(charge.error.message ?? '決済に失敗しました')

    const newBalance = await addPoints(req.userId!, req.accessToken!, 200)
    res.json({ success: true, pointsAdded: 200, newBalance })
  } catch (err) {
    console.error('Buy points large error:', err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
})

// 6占術鑑定書ワンタイム購入（¥9,800）
paymentRouter.post('/charge-onetime', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const charge = await payjpRequest('/charges', 'POST', {
      amount: '9800',
      currency: 'jpy',
      card: payjpToken,
      description: '6占術 AI統合命式鑑定書（全30ページ）',
    })

    if (charge.error) throw new Error(charge.error.message ?? '決済に失敗しました')

    const token = createPaidToken(charge.id)
    res.json({ token, type: 'onetime' })
  } catch (err) {
    console.error('Charge onetime error:', err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
})
