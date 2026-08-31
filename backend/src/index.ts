import { config } from 'dotenv'
config({ override: true })
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { fortuneRouter } from './routes/fortune.js'
import { chatRouter } from './routes/chat.js'
import { paymentRouter } from './routes/payment.js'
import { reportRouter } from './routes/report.js'
import { analyzeRouter } from './routes/analyze.js'
import { previewRouter } from './routes/preview.js'
import { calcRouter } from './routes/calc.js'
import { readingRouter } from './routes/reading.js'
import { stripeRouter, stripeWebhook } from './routes/stripe.js'
import { appleRouter, appStoreNotification } from './routes/apple.js'
import { verifiedUserIdFromAuthorization } from './lib/rateLimitIdentity.js'
import { partnersRouter } from './routes/partners.js'
import { runtimeIdentity } from './lib/runtimeDiagnostics.js'

const dependencyStatus = {
  supabaseUrl: Boolean(process.env.SUPABASE_URL),
  supabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
  supabaseServiceKey: Boolean(process.env.SUPABASE_SERVICE_KEY),
  anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
  jwtVerification: process.env.SUPABASE_JWT_SECRET ? 'HS256+ES256' : 'ES256_JWKS',
}
console.info('Dependency readiness configuration', dependencyStatus)
if (process.env.SUPABASE_URL && !process.env.SUPABASE_JWT_SECRET) {
  const jwksUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`
  void fetch(jwksUrl, { signal: AbortSignal.timeout(5_000) })
    .then(response => console.info('Supabase JWKS readiness', { reachable: response.ok, status: response.status }))
    .catch(() => console.error('Supabase JWKS readiness', { reachable: false }))
}

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
app.post('/api/apple/notifications', express.json({ limit: '256kb' }), appStoreNotification)
// 命式・9占術の計算結果と鑑定本文を、質問履歴へ一度だけ保存する。
// 128kbでは正常な鑑定書も413になるため、対象を検証するAPI側の上限と合わせて余裕を持たせる。
app.use(express.json({ limit: '5mb' }))

interface RateLimitRequest extends Request {
  rateLimitUserId?: string
}

async function tokenUserId(req: Request): Promise<string | undefined> {
  return verifiedUserIdFromAuthorization(
    req.headers.authorization,
    process.env.SUPABASE_JWT_SECRET,
    process.env.SUPABASE_URL,
  )
}

// 通常APIは認証ユーザー単位。未認証リクエストだけIP単位で制限する。
// JWTのsubはレート制限キーにだけ使い、認可は各ルートのrequireAuthで別途検証する。
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: req => (req as RateLimitRequest).rateLimitUserId ? 120 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    const userId = (req as RateLimitRequest).rateLimitUserId
    return userId
      ? `user:${userId}`
      : `ip:${ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown', 56)}`
  },
  message: { error: 'リクエストが多すぎます。しばらくお待ちください。' },
})
app.use('/api', async (req: RateLimitRequest, _res, next) => {
  // 署名検証は1リクエストにつき一度だけ行い、limitとkeyGeneratorで結果を共有する。
  req.rateLimitUserId = await tokenUserId(req)
  next()
}, generalLimiter)

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
app.use('/api/apple', appleRouter)
app.use('/api/partners', partnersRouter)

app.get('/health', (_req, res) => {
  const key = process.env.ANTHROPIC_API_KEY ?? ''
  res.json({
    status: 'ok',
    version: '1.1.1',
    hasApiKey: key.length > 0 && key !== 'your_api_key_here',
    runtime: runtimeIdentity(),
  })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'エンドポイントが見つかりません' })
})

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled request error:', err instanceof Error
    ? { name: err.name, message: err.message, stack: err.stack }
    : { message: String(err) })
  if (res.headersSent) { _next(err); return }
  res.status(500).json({ error: 'サーバーで問題が発生しました' })
})

process.on('unhandledRejection', reason => {
  console.error('Unhandled rejection:', reason instanceof Error
    ? { name: reason.name, message: reason.message, stack: reason.stack }
    : { message: String(reason) })
})

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', { name: error.name, message: error.message, stack: error.stack })
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
