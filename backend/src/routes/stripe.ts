import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'

export const stripeRouter = Router()

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY が未設定です')
  return new Stripe(key)
}

function frontendUrl() {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '')
}

stripeRouter.get('/plan', async (_req, res) => {
  try {
    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) { res.status(503).json({ error: '有料プランは現在準備中です' }); return }
    const price = await getStripe().prices.retrieve(priceId, { expand: ['product'] })
    res.json({ priceId: price.id, unitAmount: price.unit_amount, currency: price.currency, interval: price.recurring?.interval, active: price.active })
  } catch (error) {
    console.error('Stripe plan lookup failed:', error)
    res.status(500).json({ error: '料金を確認できませんでした' })
  }
})

async function findOrCreateCustomer(userId: string, email?: string) {
  const db = getSupabaseAdmin()
  const { data } = await db.from('stripe_subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle()
  if (data?.stripe_customer_id) return data.stripe_customer_id
  const customer = await getStripe().customers.create({ email, metadata: { user_id: userId } })
  await db.from('stripe_subscriptions').upsert({ user_id: userId, stripe_customer_id: customer.id, subscription_status: 'incomplete' })
  return customer.id
}

stripeRouter.post('/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) { res.status(503).json({ error: '有料プランは現在準備中です' }); return }
    const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : ''
    if (conversationId) {
      const { data } = await getSupabaseAdmin().from('reading_conversations').select('id')
        .eq('id', conversationId).eq('user_id', req.userId!).maybeSingle()
      if (!data) { res.status(404).json({ error: '鑑定履歴が見つかりません' }); return }
    }
    const customer = await findOrCreateCustomer(req.userId!, req.userEmail)
    const returnQuery = conversationId ? `&conversation=${encodeURIComponent(conversationId)}` : ''
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription', customer, line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl()}/reading?checkout=success${returnQuery}`,
      cancel_url: `${frontendUrl()}/reading?checkout=cancelled${returnQuery}`,
      client_reference_id: req.userId,
      metadata: { user_id: req.userId!, conversation_id: conversationId },
      subscription_data: { metadata: { user_id: req.userId! } },
      allow_promotion_codes: true,
    })
    res.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout failed:', error)
    res.status(500).json({ error: '決済ページを開けませんでした' })
  }
})

stripeRouter.post('/portal', requireAuth, async (req: AuthRequest, res) => {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db.from('stripe_subscriptions').select('stripe_customer_id').eq('user_id', req.userId!).maybeSingle()
    if (!data?.stripe_customer_id) { res.status(404).json({ error: '契約情報が見つかりません' }); return }
    const session = await getStripe().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${frontendUrl()}/reading` })
    res.json({ url: session.url })
  } catch (error) {
    console.error('Stripe portal failed:', error)
    res.status(500).json({ error: '契約管理画面を開けませんでした' })
  }
})

function unixToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null
}

async function mirrorSubscription(subscription: Stripe.Subscription) {
  const db = getSupabaseAdmin()
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  let userId = subscription.metadata.user_id
  if (!userId) {
    const { data } = await db.from('stripe_subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle()
    userId = data?.user_id
  }
  if (!userId) throw new Error(`Stripe customer ${customerId} にuser_idがありません`)
  const item = subscription.items.data[0]
  await db.from('stripe_subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: item?.price.id ?? null,
    subscription_status: subscription.status,
    current_period_end: unixToIso(item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  })
}

export async function stripeWebhook(req: Request, res: Response) {
  const signature = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) { res.status(400).send('Webhook configuration missing'); return }
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, secret)
  } catch (error) {
    console.error('Stripe webhook signature failed:', error)
    res.status(400).send('Invalid signature'); return
  }
  const db = getSupabaseAdmin()
  const { error: duplicate } = await db.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type })
  if (duplicate?.code === '23505') { res.json({ received: true, duplicate: true }); return }
  if (duplicate) { console.error('Stripe webhook idempotency store failed:', duplicate); res.status(500).json({ error: 'Webhook storage failed' }); return }
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      if (typeof session.subscription === 'string') await mirrorSubscription(await getStripe().subscriptions.retrieve(session.subscription))
    } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      await mirrorSubscription(event.data.object as Stripe.Subscription)
    } else if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = (invoice.parent?.subscription_details?.subscription as string | undefined)
      if (subscriptionId) await mirrorSubscription(await getStripe().subscriptions.retrieve(subscriptionId))
    }
    res.json({ received: true })
  } catch (error) {
    await db.from('stripe_webhook_events').delete().eq('event_id', event.id)
    console.error('Stripe webhook processing failed:', { eventId: event.id, type: event.type, error })
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}
