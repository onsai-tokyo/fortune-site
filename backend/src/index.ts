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

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10kb' }))

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

app.get('/health', (_req, res) => {
  const key = process.env.ANTHROPIC_API_KEY ?? ''
  res.json({
    status: 'ok',
    hasApiKey: key.length > 0 && key !== 'your_api_key_here',
  })
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
