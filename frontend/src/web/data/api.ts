/**
 * サーバーAPIとの対応表。
 *
 * いまは画面確認用に state/AppState.tsx の仮データで動いている。
 * 本番接続では、各操作をここの関数に置き換える。
 * パスはすべて既存バックエンド（backend/src/index.ts でマウント済み）のもの。
 * 詳細は FATELAB_Web移行計画_20261016.md を参照。
 */
import { webApiPath } from './webApiPath'
export { webApiPath } from './webApiPath'
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

/** AI送信の同意ヘッダー（backend/src/middleware/aiConsent.ts） */
export const AI_CONSENT_HEADER = 'X-FateLab-AI-Consent'
export const AI_CONSENT_VERSION = 'anthropic-inline-2026-10-11-v3'

export const endpoints = {
  // 出生情報・命式
  calcDivination: { method: 'POST', path: '/api/calc/divination' },
  profileTraits: { method: 'GET', path: '/api/reading/profile/traits' },
  // 本人鑑定（SSE＋操作IDで復帰）
  selfGenerate: { method: 'POST', path: '/api/preview/generate?format=sse' },
  selfGeneration: { method: 'GET', path: '/api/preview/generations/:operationId' },
  conversations: { method: 'GET', path: '/api/reading/conversations' },
  saveConversation: { method: 'POST', path: '/api/reading/conversations' },
  // 年ごとの流れ
  timeline: { method: 'GET', path: '/api/timeline' },
  timingHistory: { method: 'GET', path: '/api/reading/:conversationId/timing-history' },
  // ふたり
  partners: { method: 'GET', path: '/api/partners' },
  registerPartner: { method: 'POST', path: '/api/partners' },
  partnerRegistration: { method: 'GET', path: '/api/partners/registration/operations/:operationId' },
  compatibility: { method: 'POST', path: '/api/partners/:partnerId/compatibility?format=sse' },
  coupleTimeline: { method: 'GET', path: '/api/reading/:conversationId/couple-timeline' },
  coupleTimelineSettings: { method: 'GET', path: '/api/reading/couple-timeline-settings/:partnerId' },
  deletePartner: { method: 'DELETE', path: '/api/partners/:partnerId' },
  // 相談のブック（operationId 必須・AI同意ヘッダー必須）
  bookStatus: { method: 'GET', path: '/api/books/status' },
  bookValidate: { method: 'POST', path: '/api/books/validate' },
  bookCreate: { method: 'POST', path: '/api/books' },
  bookOperation: { method: 'GET', path: '/api/books/operations/:operationId' },
  books: { method: 'GET', path: '/api/books' },
  book: { method: 'GET', path: '/api/books/:bookId' },
  // 読みものへの質問
  askQuestion: { method: 'POST', path: '/api/reading/conversations/:conversationId/questions' },
  // 退会
  deleteAccount: { method: 'DELETE', path: '/api/reading/account' },
  // 決済（未実装：決済会社の確定後にバックエンドへ追加する）
  createCheckout: { method: 'POST', path: '/api/web-payments/checkout' },
} as const

export async function apiFetch<T>(path: string, init: RequestInit & { accessToken?: string; aiConsent?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (init.accessToken) headers.set('Authorization', `Bearer ${init.accessToken}`)
  if (init.aiConsent) headers.set(AI_CONSENT_HEADER, AI_CONSENT_VERSION)
  const response = await fetch(`${API_BASE}${webApiPath(path)}`, { ...init, headers })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string }
    throw new ApiError(body.error ?? '通信に失敗しました。時間をおいてお試しください。', response.status, body.code)
  }
  // DELETE endpoints deliberately return 204 with no JSON body.
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
  }
}

/** 二重送信を防ぐための操作ID（バックエンドはUUID v4を要求する） */
export function newOperationId(): string {
  return crypto.randomUUID()
}
