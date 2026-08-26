import { Router, Request, Response } from 'express'
import { Environment, JWSTransactionDecodedPayload, SignedDataVerifier } from '@apple/app-store-server-library'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { correlationId } from '../lib/apiError.js'
import { exchangeAppleAuthorizationCode } from '../lib/appleSignIn.js'

export const appleRouter = Router()

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} が未設定です`)
  return value
}
function rootCertificates() {
  return required('APPLE_ROOT_CA_BASE64').split(',').map(value => Buffer.from(value.trim(), 'base64'))
}

function verifier(environment: Environment) {
  const appAppleId = environment === Environment.PRODUCTION ? Number(required('APPLE_APP_ID')) : undefined
  return new SignedDataVerifier(rootCertificates(), true, environment, required('APPLE_BUNDLE_ID'), appAppleId)
}

async function verifyTransaction(signedTransaction: string) {
  try { return await verifier(Environment.SANDBOX).verifyAndDecodeTransaction(signedTransaction) }
  catch (sandboxError) {
    try { return await verifier(Environment.PRODUCTION).verifyAndDecodeTransaction(signedTransaction) }
    catch (productionError) {
      console.error('App Store transaction verification failed', { sandboxError, productionError })
      throw productionError
    }
  }
}

async function verifyNotification(signedPayload: string) {
  try { return await verifier(Environment.PRODUCTION).verifyAndDecodeNotification(signedPayload) }
  catch (productionError) {
    try { return await verifier(Environment.SANDBOX).verifyAndDecodeNotification(signedPayload) }
    catch (sandboxError) {
      console.error('App Store notification verification failed', { productionError, sandboxError })
      throw sandboxError
    }
  }
}

const toIso = (milliseconds?: number) => milliseconds ? new Date(milliseconds).toISOString() : null
const normalizedUuid = (value?: string) => value?.toLowerCase() ?? ''
const transactionStatus = (transaction: JWSTransactionDecodedPayload) => {
  if (transaction.revocationDate) return 'revoked'
  if (transaction.expiresDate && transaction.expiresDate <= Date.now()) return 'expired'
  return 'active'
}

type MirroredSubscription = { status: string; expiresAt: string | null; skipped?: false } | { skipped: true }

async function mirrorTransaction(
  transaction: JWSTransactionDecodedPayload,
  expectedUserId?: string,
  allowOwnerTransfer = false,
): Promise<MirroredSubscription> {
  if (transaction.productId !== required('APPLE_SUBSCRIPTION_PRODUCT_ID')) throw new Error('App Store product ID が一致しません')
  if (!transaction.originalTransactionId || !transaction.transactionId) throw new Error('App Store transaction ID が不足しています')
  const tokenUserId = normalizedUuid(transaction.appAccountToken)
  const requestUserId = normalizedUuid(expectedUserId)
  const isSandbox = transaction.environment === 'Sandbox'
  if (requestUserId && tokenUserId && tokenUserId !== requestUserId && !(isSandbox && allowOwnerTransfer)) return { skipped: true }
  const userId = requestUserId || tokenUserId
  if (!userId) throw new Error('appAccountToken がありません')
  const db = getSupabaseAdmin()
  const { data: existing, error: lookupError } = await db.from('app_store_subscriptions')
    .select('user_id')
    .eq('original_transaction_id', transaction.originalTransactionId)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing?.user_id && normalizedUuid(existing.user_id) !== userId) {
    if (!isSandbox || !allowOwnerTransfer) {
      throw new Error('この購入は別のアカウントに登録済みです')
    }
    // One sandbox entitlement must have exactly one current app owner. Remove a
    // stale mirror for the target test user, then transfer the original row.
    const { error: staleError } = await db.from('app_store_subscriptions')
      .delete().eq('user_id', userId).neq('original_transaction_id', transaction.originalTransactionId)
    if (staleError) throw staleError
    const { error: transferError } = await db.from('app_store_subscriptions')
      .update({ user_id: userId, app_account_token: userId, updated_at: new Date().toISOString() })
      .eq('original_transaction_id', transaction.originalTransactionId)
    if (transferError) throw transferError
  }
  const { error } = await db.from('app_store_subscriptions').upsert({
    user_id: userId,
    original_transaction_id: transaction.originalTransactionId,
    latest_transaction_id: transaction.transactionId,
    product_id: transaction.productId,
    environment: transaction.environment ?? 'Unknown',
    subscription_status: transactionStatus(transaction),
    expires_at: toIso(transaction.expiresDate),
    revoked_at: toIso(transaction.revocationDate),
    app_account_token: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
  return { status: transactionStatus(transaction), expiresAt: toIso(transaction.expiresDate), skipped: false }
}

appleRouter.get('/plan', (_req, res) => {
  const productId = process.env.APPLE_SUBSCRIPTION_PRODUCT_ID
  if (!productId) { res.status(503).json({ error: 'App Storeプランは現在準備中です' }); return }
  res.json({ productId })
})

// Apple authorization codes are short-lived and returned only during sign-in.
// Exchange immediately and keep the refresh token server-side for account deletion.
appleRouter.post('/sign-in-token', requireAuth, async (req: AuthRequest, res) => {
  const authorizationCode = typeof req.body?.authorizationCode === 'string'
    ? req.body.authorizationCode.trim()
    : ''
  if (!authorizationCode || authorizationCode.length > 4096) {
    res.status(400).json({ error: 'Apple認証情報が不足しています' })
    return
  }
  try {
    const refreshToken = await exchangeAppleAuthorizationCode(authorizationCode)
    const { error } = await getSupabaseAdmin().from('apple_sign_in_tokens').upsert({
      user_id: req.userId!,
      refresh_token: refreshToken,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error
    res.status(204).end()
  } catch (error) {
    console.error('Apple sign-in token retention failed', {
      correlationId: correlationId(req),
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    res.status(503).json({ error: 'Apple連携情報を保存できませんでした' })
  }
})

appleRouter.post('/transactions/verify', requireAuth, async (req: AuthRequest, res) => {
  const requestId = correlationId(req)
  try {
    const signedTransaction = typeof req.body?.signedTransaction === 'string' ? req.body.signedTransaction : ''
    if (!signedTransaction || signedTransaction.length > 20000) { res.status(400).json({ error: '購入情報が不足しています' }); return }
    const transaction = await verifyTransaction(signedTransaction)
    const subscription = await mirrorTransaction(transaction, req.userId, req.body?.allowOwnerTransfer === true)
    if (subscription.skipped) {
      console.info('App Store transaction belongs to another account', { correlationId: requestId })
      res.json({ verified: true, skipped: true, correlationId: requestId })
      return
    }
    console.info('App Store purchase synchronized', {
      correlationId: requestId,
      environment: transaction.environment ?? 'Unknown',
      status: subscription.status,
    })
    res.json({ verified: true, subscription, correlationId: requestId })
  } catch (error) {
    console.error('App Store purchase verification failed', {
      correlationId: requestId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      configPresent: {
        rootCertificates: Boolean(process.env.APPLE_ROOT_CA_BASE64?.trim()),
        bundleId: Boolean(process.env.APPLE_BUNDLE_ID?.trim()),
        appId: Boolean(process.env.APPLE_APP_ID?.trim()),
        productId: Boolean(process.env.APPLE_SUBSCRIPTION_PRODUCT_ID?.trim()),
      },
    })
    res.status(400).json({ error: '購入情報を確認できませんでした', correlationId: requestId })
  }
})

export async function appStoreNotification(req: Request, res: Response) {
  try {
    const signedPayload = typeof req.body?.signedPayload === 'string' ? req.body.signedPayload : ''
    if (!signedPayload || signedPayload.length > 100000) { res.status(400).json({ error: 'signedPayload is required' }); return }
    const notification = await verifyNotification(signedPayload)
    if (!notification.notificationUUID || !notification.notificationType) throw new Error('通知IDまたは通知種別がありません')
    const db = getSupabaseAdmin()
    const { error: eventError } = await db.from('app_store_notification_events').insert({
      notification_uuid: notification.notificationUUID,
      notification_type: notification.notificationType,
      subtype: notification.subtype ?? null,
      environment: notification.data?.environment ?? null,
    })
    if (eventError?.code === '23505') { res.json({ received: true, duplicate: true }); return }
    if (eventError) throw eventError
    try {
      if (notification.data?.signedTransactionInfo) {
        await mirrorTransaction(await verifyTransaction(notification.data.signedTransactionInfo))
      }
      res.json({ received: true })
    } catch (error) {
      await db.from('app_store_notification_events').delete().eq('notification_uuid', notification.notificationUUID)
      throw error
    }
  } catch (error) {
    console.error('App Store notification failed:', error)
    res.status(400).json({ error: 'Invalid App Store notification' })
  }
}
