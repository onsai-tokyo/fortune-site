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

// ─── ポイントサブスクプラン定義 ─────────────────────────────────────────────
// PAY.JP ダッシュボードで事前にプランを作成し、IDを環境変数に設定してください
// PAYJP_PLAN_LIGHT, PAYJP_PLAN_STANDARD, PAYJP_PLAN_HEAVY
const PLANS = {
  light:    { pts: 30,  amount: 780,  label: 'ライト',       planId: process.env.PAYJP_PLAN_LIGHT    ?? 'fortune_light' },
  standard: { pts: 80,  amount: 1980, label: 'スタンダード', planId: process.env.PAYJP_PLAN_STANDARD ?? 'fortune_standard' },
  heavy:    { pts: 200, amount: 3980, label: 'ヘビー',        planId: process.env.PAYJP_PLAN_HEAVY    ?? 'fortune_heavy' },
} as const
type PlanKey = keyof typeof PLANS

function getUserSupabase(accessToken: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

function getServiceSupabase() {
  // Webhook など認証コンテキストがない処理に使用
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY!
  )
}

// ─── ポイントサブスク登録（ライト ¥780/月 → 30pt/月）────────────────────────
paymentRouter.post('/subscribe-light', requireAuth, async (req: AuthRequest, res) => {
  await handleSubscribe(req, res, 'light')
})

// ─── ポイントサブスク登録（スタンダード ¥1,980/月 → 80pt/月）───────────────
paymentRouter.post('/subscribe-standard', requireAuth, async (req: AuthRequest, res) => {
  await handleSubscribe(req, res, 'standard')
})

// ─── ポイントサブスク登録（ヘビー ¥3,980/月 → 200pt/月）────────────────────
paymentRouter.post('/subscribe-heavy', requireAuth, async (req: AuthRequest, res) => {
  await handleSubscribe(req, res, 'heavy')
})

async function handleSubscribe(req: AuthRequest, res: import('express').Response, tier: PlanKey) {
  try {
    const { payjpToken } = req.body as { payjpToken?: string }
    if (!payjpToken) { res.status(400).json({ error: 'payjpToken が必要です' }); return }

    const plan = PLANS[tier]

    // PAY.JP: カードを持つカスタマーを作成
    const customer = await payjpRequest('/customers', 'POST', {
      card: payjpToken,
      description: `fortune-site user ${req.userId}`,
    })
    if (customer.error) throw new Error(customer.error.message ?? '決済に失敗しました')

    // PAY.JP: サブスクリプション作成（初回は即時課金）
    const subscription = await payjpRequest('/subscriptions', 'POST', {
      customer: customer.id,
      plan: plan.planId,
    })
    if (subscription.error) throw new Error(subscription.error.message ?? '決済に失敗しました')

    // 初回ポイント付与
    const newBalance = await addPoints(req.userId!, req.accessToken!, plan.pts)

    // Supabase にサブスク情報を保存
    const supabase = getUserSupabase(req.accessToken!)
    const expiresAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()
    const { error: dbErr } = await supabase.from('subscriptions').insert({
      user_id: req.userId,
      plan: tier,
      expires_at: expiresAt,
      payjp_charge_id: subscription.id,
    })
    if (dbErr) console.error('Subscription save error:', dbErr)

    res.json({ success: true, pointsAdded: plan.pts, newBalance })
  } catch (err) {
    console.error(`Subscribe ${tier} error:`, err)
    res.status(500).json({ error: '決済に失敗しました' })
  }
}

// ─── PAY.JP Webhook（サブスク月次更新時にポイント付与）──────────────────────
// PAY.JP ダッシュボードで Webhook URL を /api/payment/webhook に設定してください
paymentRouter.post('/webhook', async (req, res) => {
  try {
    const event = req.body as { type?: string; data?: { object?: Record<string, unknown> } }

    // charge.succeeded かつサブスクリプション由来の課金
    if (event.type === 'charge.succeeded' && event.data?.object) {
      const charge = event.data.object
      const subscriptionId = charge.subscription as string | undefined
      if (subscriptionId) {
        // サブスクリプションIDでユーザーを検索
        const supabase = getServiceSupabase()
        const { data: rows } = await supabase
          .from('subscriptions')
          .select('user_id, plan')
          .eq('payjp_charge_id', subscriptionId)
          .limit(1)

        if (rows && rows.length > 0) {
          const { user_id, plan } = rows[0] as { user_id: string; plan: PlanKey }
          const planInfo = PLANS[plan]
          if (planInfo) {
            // ポイント付与（service role で直接 RPC 呼び出し）
            await supabase.rpc('add_points', { target_user_id: user_id, amount: planInfo.pts })
            // expires_at を更新
            await supabase
              .from('subscriptions')
              .update({ expires_at: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString() })
              .eq('payjp_charge_id', subscriptionId)
            console.log(`Webhook: added ${planInfo.pts}pt to user ${user_id} (plan: ${plan})`)
          }
        }
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// ─── サブスク解約 ─────────────────────────────────────────────────────────────
paymentRouter.post('/cancel-subscription', requireAuth, async (req: AuthRequest, res) => {
  try {
    const supabase = getUserSupabase(req.accessToken!)
    // 有効なサブスクを取得して PAY.JP 側も解約
    const { data: rows } = await supabase
      .from('subscriptions')
      .select('payjp_charge_id')
      .eq('user_id', req.userId!)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)

    if (rows && rows.length > 0) {
      const subId = (rows[0] as { payjp_charge_id: string }).payjp_charge_id
      // PAY.JP サブスクリプション解約
      await payjpRequest(`/subscriptions/${subId}/cancel`, 'POST')
    }

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

// ─── 質問詳細回答（¥500 ワンタイム）─────────────────────────────────────────
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
