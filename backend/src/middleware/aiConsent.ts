import type { Request, Response, NextFunction } from 'express'

export const AI_CONSENT_VERSION = 'anthropic-2026-10-07-v1'
export function hasAIConsent(req: Request): boolean {
  return req.header('X-FateLab-AI-Consent') === AI_CONSENT_VERSION
}
// Per-request permission: never infer permission from membership or Terms acceptance.
export function requireAIConsent(req: Request, res: Response, next: NextFunction) {
  if (!hasAIConsent(req)) {
    res.status(428).json({code:'AI_CONSENT_REQUIRED',error:'AIへの情報送信について確認し、同意してからお試しください。古いアプリでは最新版への更新が必要です。'})
    return
  }
  next()
}
