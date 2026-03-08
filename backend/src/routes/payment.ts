import { Router } from 'express'
import Stripe from 'stripe'
import crypto from 'crypto'

export const paymentRouter = Router()

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getTokenSecret(): string {
  return process.env.TOKEN_SECRET ?? 'fortune-dev-secret'
}

export function createPaidToken(sessionId: string): string {
  const hmac = crypto.createHmac('sha256', getTokenSecret()).update(sessionId).digest('hex')
  return `${sessionId}.${hmac}`
}

export function verifyPaidToken(token: string): boolean {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return false
    const sessionId = token.slice(0, dotIdx)
    const hmac = token.slice(dotIdx + 1)
    const expected = crypto.createHmac('sha256', getTokenSecret()).update(sessionId).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

// Stripe Checkout セッション作成
paymentRouter.post('/create-session', async (req, res) => {
  try {
    const stripe = getStripe()
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: { name: '追加鑑定チャット（無制限）' },
          unit_amount: 500,
        },
        quantity: 1,
      }],
      success_url: `${frontendUrl}/result?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/result?payment=cancel`,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('Payment session error:', err)
    res.status(500).json({ error: '決済セッションの作成に失敗しました' })
  }
})

// 決済確認 → 署名トークン発行
paymentRouter.post('/verify', async (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string }
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId が必要です' })
      return
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      res.status(400).json({ error: '決済が完了していません' })
      return
    }

    const token = createPaidToken(sessionId)
    res.json({ token })
  } catch (err) {
    console.error('Payment verify error:', err)
    res.status(500).json({ error: '決済確認に失敗しました' })
  }
})
