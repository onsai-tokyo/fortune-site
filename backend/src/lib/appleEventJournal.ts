import type { JWSTransactionDecodedPayload, ResponseBodyV2DecodedPayload } from '@apple/app-store-server-library'
import { digest } from './artifactIdentity.js'
import { getSupabaseAdmin } from './supabaseAdmin.js'

type AppleEnvironment = 'Production' | 'Sandbox'
export interface VerifiedAppleTransaction {
  environment: AppleEnvironment; originalTransactionId: string; transactionId: string; productId: string
  appAccountToken: string | null; purchaseMs: number; signedMs: number; expiresMs: number; revokedMs: number | null; isUpgraded: boolean
}
export interface AppleJournalEvent {
  environment: AppleEnvironment; action: 'transaction' | 'ignore' | 'unsupported'
  transaction: VerifiedAppleTransaction | null; requestUserId: string | null; allowOwnerTransfer: boolean
  notificationType: string | null
}
export class AppleJournalUnavailable extends Error { constructor() { super('Apple journal unavailable'); this.name = 'AppleJournalUnavailable' } }
export class ApplePayloadInvalid extends Error { constructor() { super('Invalid verified Apple payload'); this.name = 'ApplePayloadInvalid' } }
function environment(value: unknown): AppleEnvironment {
  if (value !== 'Production' && value !== 'Sandbox') throw new ApplePayloadInvalid()
  return value
}
function text(value: unknown) { if (typeof value !== 'string' || !value || value.length>200) throw new ApplePayloadInvalid(); return value }
function time(value: unknown) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value<=0 || value>253402300799999) throw new ApplePayloadInvalid(); return value }
function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) throw new ApplePayloadInvalid()
  return value.toLowerCase()
}
// Call only AFTER SignedDataVerifier succeeds. This is normalization, not JWS verification.
export function normalizeVerifiedTransaction(tx: JWSTransactionDecodedPayload, product: string): VerifiedAppleTransaction {
  if (!product || tx.productId !== product || tx.type !== 'Auto-Renewable Subscription') throw new ApplePayloadInvalid()
  if (tx.isUpgraded !== undefined && typeof tx.isUpgraded !== 'boolean') throw new ApplePayloadInvalid()
  return { environment: environment(tx.environment), originalTransactionId: text(tx.originalTransactionId),
    transactionId: text(tx.transactionId), productId: text(tx.productId), appAccountToken: tx.appAccountToken ? uuid(tx.appAccountToken) : null,
    purchaseMs: time(tx.purchaseDate), signedMs: time(tx.signedDate), expiresMs: time(tx.expiresDate),
    revokedMs: tx.revocationDate === undefined ? null : time(tx.revocationDate), isUpgraded: tx.isUpgraded ?? false }
}
export function purchaseEvent(tx: VerifiedAppleTransaction, userId: string, allowOwnerTransfer: boolean, operationId?: string) {
  const payload: AppleJournalEvent = { environment: tx.environment, action: 'transaction', transaction: tx,
    requestUserId: uuid(userId), allowOwnerTransfer: tx.environment === 'Sandbox' && allowOwnerTransfer, notificationType: null }
  return { eventId: operationId ? 'verify-op:' + uuid(operationId) : 'verify:' + digest(payload), payload }
}
export function notificationEvent(notification: ResponseBodyV2DecodedPayload, verifiedEnvironment: AppleEnvironment, tx: VerifiedAppleTransaction | null) {
  const eventId = 'notification:' + text(notification.notificationUUID)
  const notificationType = text(notification.notificationType)
  if (notification.data?.environment && environment(notification.data.environment) !== verifiedEnvironment) throw new ApplePayloadInvalid()
  if (tx && tx.environment !== verifiedEnvironment) throw new ApplePayloadInvalid()
  if (['REFUND','REVOKE'].includes(notificationType) && (!tx || tx.revokedMs === null)) throw new ApplePayloadInvalid()
  const payload: AppleJournalEvent = { environment: verifiedEnvironment, action: tx ? 'transaction' : notificationType === 'TEST' ? 'ignore' : 'unsupported',
    transaction: tx, requestUserId: null, allowOwnerTransfer: false, notificationType }
  return { eventId, payload }
}
export interface AppleApplyResult { state: 'applied' | 'ignored'; delivery: 'mirrored' | 'owner_mismatch' | 'no_entitlement_change'; ownerId?: string; transactionId?: string }
export interface JournalRPC { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
export async function applyJournalEvent(env: AppleEnvironment, eventId: string, db: JournalRPC = getSupabaseAdmin()): Promise<AppleApplyResult> {
  const result = await db.rpc('app_store_apply_event', { p_environment: env, p_event_id: eventId })
  const value = result.data as Partial<AppleApplyResult> | null
  if (result.error || !value || !['applied','ignored'].includes(value.state ?? '') || !['mirrored','owner_mismatch','no_entitlement_change'].includes(value.delivery ?? '')) throw new AppleJournalUnavailable()
  if (value.delivery === 'mirrored' && (typeof value.transactionId !== 'string' || typeof value.ownerId !== 'string')) throw new AppleJournalUnavailable()
  return value as AppleApplyResult
}
export async function receiveAndApply(eventId: string, payload: AppleJournalEvent, db: JournalRPC = getSupabaseAdmin()) {
  const received = await db.rpc('app_store_receive_event', { p_environment: payload.environment, p_event_id: eventId, p_payload: payload })
  if (received.error || !received.data) throw new AppleJournalUnavailable()
  // A received/duplicate event is not evidence that its side effects succeeded.
  return applyJournalEvent(payload.environment, eventId, db)
}
