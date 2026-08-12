import { config } from 'dotenv'
config({ override: true })
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { fortuneRouter } from './routes/fortune.js'
import { chatRouter } from './routes/chat.js'
import { paymentRouter } from './routes/payment.js'
import { reportRouter } from './routes/report.js'
import { analyzeRouter } from './routes/analyze.js'
import { previewRouter } from './routes/preview.js'
import { calcRouter } from './routes/calc.js'
import { readingRouter } from './routes/reading.js'
import { stripeRouter, stripeWebhook } from './routes/stripe.js'

const app = express()
const PORT = process.env.PORT ?? 3001

// Renderなどのリバースプロキシの背後で動作する場合に必要
app.set('trust proxy', 1)

const configuredFrontendOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
const allowedFrontendOrigins = new Set([
  ...configuredFrontendOrigins,
  'https://fate-lab.com',
  'https://www.fate-lab.com',
  'https://fortune-site-theta.vercel.app',
])
const localPreviewOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/

app.use(cors({
  origin(origin, callback) {
    // Originが無いサーバー間通信と、公開サイト・ローカル確認画面だけを許可する。
    if (!origin || allowedFrontendOrigins.has(origin) || localPreviewOrigin.test(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('CORS origin not allowed'))
  },
  credentials: true,
}))
// Stripe署名検証では加工前のbodyが必要。express.jsonより先に登録する。
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook)
// 命式・9占術の計算結果と鑑定本文を、質問履歴へ一度だけ保存する。
// 128kbでは正常な鑑定書も413になるため、対象を検証するAPI側の上限と合わせて余裕を持たせる。
app.use(express.json({ limit: '5mb' }))

// レート制限: 全API IPごと10req/分
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストが多すぎます。しばらくお待ちください。' },
})
app.use('/api', limiter)

// 鑑定エンドポイント: IPごと3req/時（コスト保護）※本番は3に戻す
const fortuneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 3 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '無料の解析回数の上限に達しました。1時間後に再度お試しください。' },
})
app.use('/api/fortune', fortuneLimiter)

app.use('/api/fortune', fortuneRouter)
app.use('/api/chat', chatRouter)
app.use('/api/payment', paymentRouter)
app.use('/api/report', reportRouter)
app.use('/api/analyze', analyzeRouter)
app.use('/api/preview', previewRouter)
app.use('/api/calc', calcRouter)
app.use('/api/reading', readingRouter)
app.use('/api/stripe', stripeRouter)

app.get('/health', (_req, res) => {
  const key = process.env.ANTHROPIC_API_KEY ?? ''
  res.json({
    status: 'ok',
    version: '1.1.1',
    hasApiKey: key.length > 0 && key !== 'your_api_key_here',
  })
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
