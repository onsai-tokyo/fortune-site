import { Router, Request, Response } from 'express'
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { correlationId } from '../lib/apiError.js'
import { exchangeAppleAuthorizationCode } from '../lib/appleSignIn.js'
import { normalizeVerifiedTransaction, purchaseEvent, notificationEvent, receiveAndApply, ApplePayloadInvalid } from '../lib/appleEventJournal.js'

import { BOOK_PRODUCT, grantVerifiedBookPurchase } from '../lib/aiBooks.js'

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
      console.error('App Store transaction verification failed', { sandboxError: sandboxError instanceof Error ? sandboxError.name : 'Unknown', productionError: productionError instanceof Error ? productionError.name : 'Unknown' })
      throw productionError
    }
  }
}

async function verifyNotification(signedPayload: string) {
  try { return { payload: await verifier(Environment.PRODUCTION).verifyAndDecodeNotification(signedPayload), environment: 'Production' as const } }
  catch (productionError) {
    try { return { payload: await verifier(Environment.SANDBOX).verifyAndDecodeNotification(signedPayload), environment: 'Sandbox' as const } }
    catch (sandboxError) {
      console.error('App Store notification verification failed', { productionError: productionError instanceof Error ? productionError.name : 'Unknown', sandboxError: sandboxError instanceof Error ? sandboxError.name : 'Unknown' })
      throw sandboxError
    }
  }
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
    const decoded = await verifyTransaction(signedTransaction)
    if (decoded.productId === BOOK_PRODUCT) {
      res.json(await grantVerifiedBookPurchase(decoded, req.userId!)); return
    }
    const transaction = normalizeVerifiedTransaction(decoded, required('APPLE_SUBSCRIPTION_PRODUCT_ID'))
    const event = purchaseEvent(transaction, req.userId!, req.body?.allowOwnerTransfer === true, req.body?.operationId)
    let applied
    try { applied = await receiveAndApply(event.eventId, event.payload) }
    catch { res.status(503).json({ code: 'DEPENDENCY_NOT_READY', retryable: true, error: '購入の反映を確認できませんでした。再購入せず再試行してください。', correlationId: requestId }); return }
    if (applied.delivery === 'owner_mismatch') {
      res.json({ verified: true, skipped: true, delivery: 'owner_mismatch', transactionId: transaction.transactionId, ownerId: null, correlationId: requestId })
      return
    }
    if (applied.delivery !== 'mirrored' || applied.ownerId !== req.userId?.toLowerCase() || applied.transactionId !== transaction.transactionId) {
      res.status(503).json({ code: 'DEPENDENCY_NOT_READY', error: '購入の反映を確認できませんでした', correlationId: requestId }); return
    }
    res.json({ verified: true, ...applied, correlationId: requestId })
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
  let verified
  try {
    const signedPayload = typeof req.body?.signedPayload === 'string' ? req.body.signedPayload : ''
    if (!signedPayload || signedPayload.length > 100000) throw new ApplePayloadInvalid()
    verified = await verifyNotification(signedPayload)
    const raw = verified.payload.data?.signedTransactionInfo
    const decoded = raw ? await verifyTransaction(raw) : null
    if (decoded?.productId === BOOK_PRODUCT) {
      if (decoded.environment !== verified.environment) throw new ApplePayloadInvalid()
      if (['REFUND','REVOKE'].includes(String(verified.payload.notificationType)) && !decoded.revocationDate) throw new ApplePayloadInvalid()
      try { await grantVerifiedBookPurchase(decoded); res.json({ received: true }) }
      catch { res.status(503).json({ error: 'Notification pending' }) }
      return
    }
    const tx = decoded ? normalizeVerifiedTransaction(decoded, required('APPLE_SUBSCRIPTION_PRODUCT_ID')) : null
    const event = notificationEvent(verified.payload, verified.environment, tx)
    try {
      const result = await receiveAndApply(event.eventId, event.payload)
      res.json({ received: true, state: result.state })
    } catch {
      res.status(503).json({ code: 'DEPENDENCY_NOT_READY', retryable: true, error: 'Notification pending' })
    }
  } catch {
    // Never log signed payloads or decoded account details.
    res.status(400).json({ error: 'Invalid App Store notification' })
  }
}
