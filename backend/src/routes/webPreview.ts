import { Router } from 'express'
import { previewRouter } from './preview.js'

// This wrapper is mounted only below /api/web and never changes shared/iOS
// router configuration, process environment, or the incoming request body.
export function createWebPreviewRouter(shared: Router) {
  const router = Router()
  router.all('/question', (_req, res) => {
    res.status(403).json({ code: 'WEB_PREVIEW_QUESTIONS_DISABLED', error: 'この質問機能はWeb版では提供していません。' })
  })
  router.post('/generate', (req, _res, next) => {
    // The shared generator invokes the AI writer only with hasAIConsent(req).
    // Web free readings must stay deterministic even if a caller supplies
    // an otherwise-valid consent header or has previously consented to books.
    delete req.headers['x-fatelab-ai-consent']
    next()
  }, shared)
  router.get('/generations/:opId', shared)
  router.use((_req, res) => { res.status(404).json({ code: 'WEB_PREVIEW_NOT_FOUND', error: 'この機能はWeb版では提供していません。' }) })
  return router
}

export const webPreviewRouter = createWebPreviewRouter(previewRouter)
