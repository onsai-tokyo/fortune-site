import type { Request, Response, NextFunction } from 'express'

export const AI_CONSENT_VERSION = 'anthropic-2026-10-07-v1'
export const AI_TERMS_CONSENT_VERSION = 'terms-ai-2026-10-07-v2'
export function hasAIConsent(req: Request): boolean {
  const version = req.header('X-FateLab-AI-Consent')
  return version === AI_CONSENT_VERSION || version === AI_TERMS_CONSENT_VERSION
}
// Require the request-specific client acknowledgement. Never infer it from membership or prior signup terms.
// v2 identifies the linked-AI-terms presentation separately from the explicit v1 notice.
export function requireAIConsent(req: Request, res: Response, next: NextFunction) {
  if (!hasAIConsent(req)) {
    res.status(428).json({code:'AI_CONSENT_REQUIRED',error:'AIへの情報送信について確認し、同意してからお試しください。古いアプリでは最新版への更新が必要です。'})
    return
  }
  next()
}
