import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createWebPreviewRouter } from './webPreview.js'
import { hasAIConsent, AI_CONSENT_VERSION, AI_INLINE_CONSENT_VERSION, AI_TERMS_CONSENT_VERSION } from '../middleware/aiConsent.js'
import { readFileSync } from 'node:fs'

test('Web preview blocks legacy questions and forces no AI consent without changing shared/iOS requests', async () => {
  const shared = express.Router()
  let questions = 0
  shared.post('/question', (_req, res) => { questions++; res.json({ answer: 'synthetic' }) })
  shared.post('/generate', (req, res) => {
    res.json({ wouldCallAI: hasAIConsent(req), operation: req.header('Idempotency-Key'), body: req.body, format: req.query.format })
  })
  shared.get('/generations/:opId', (req, res) => { res.json({ operation: req.params.opId }) })
  shared.post('/future-ai-route', (_req, res) => { res.json({ unexpected: true }) })
  const app = express()
  app.use(express.json())
  app.use('/api/web/preview', createWebPreviewRouter(shared))
  app.use('/api/preview', shared)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const payload = { birthDate: '2010-05-12', gender: 'female', aiConsent: true, forceAI: true }
  const call = (path: string, version: string, method = 'POST') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-FateLab-AI-Consent': version, 'Idempotency-Key': 'synthetic-operation' },
    ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}),
  })
  try {
    for (const version of [AI_CONSENT_VERSION, AI_INLINE_CONSENT_VERSION, AI_TERMS_CONSENT_VERSION]) {
      const web = await call('/api/web/preview/generate?format=sse', version)
      assert.equal(web.status, 200)
      assert.deepEqual(await web.json(), { wouldCallAI: false, operation: 'synthetic-operation', body: payload, format: 'sse' })
      const native = await call('/api/preview/generate', version)
      assert.equal((await native.json()).wouldCallAI, true, 'existing iOS consent semantics must remain unchanged')
      for (const method of ['POST', 'GET']) {
        const blocked = await call('/api/web/preview/question', version, method)
        assert.equal(blocked.status, 403)
        assert.equal((await blocked.json()).code, 'WEB_PREVIEW_QUESTIONS_DISABLED')
      }
    }
    assert.equal(questions, 0, 'Web must never reach the shared question handler')
    assert.equal((await call('/api/preview/question', AI_INLINE_CONSENT_VERSION)).status, 200)
    assert.equal(questions, 1, 'shared/iOS legacy route remains unchanged')
    const status = await call('/api/web/preview/generations/synthetic-operation', '', 'GET')
    assert.deepEqual(await status.json(), { operation: 'synthetic-operation' })
    assert.equal((await call('/api/web/preview/future-ai-route', AI_INLINE_CONSENT_VERSION)).status, 404)
    assert.equal((await call('/api/preview/future-ai-route', AI_INLINE_CONSENT_VERSION)).status, 200)
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('shared preview AI writer remains guarded by absent consent and Web wrapper is mounted only on Web', () => {
  const preview = readFileSync(new URL('./preview.ts', import.meta.url), 'utf8')
  assert.match(preview, /\|\| !hasAIConsent\(req\)\s*\? finalizeReportProvenance/)
  const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8')
  assert.match(index, /app\.use\('\/api\/preview', previewRouter\)/)
  const web = readFileSync(new URL('./web.ts', import.meta.url), 'utf8')
  assert.match(web, /webRouter\.use\('\/preview', webPreviewRouter\)/)
})
