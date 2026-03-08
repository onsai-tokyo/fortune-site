import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ResultCard } from '../components/ResultCard'
import { FortuneReading } from '../components/FortuneReading'
import { ChatArea } from '../components/ChatArea'
import type { FortuneData } from '../lib/types'

interface LocationState {
  fortuneData: FortuneData
}

const TOKEN_KEY = 'fortune_paid_token'

export function ResultPage() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const state     = location.state as LocationState | null

  // Stripe リダイレクト後: sessionStorage から fortuneData を復元
  const searchParams = new URLSearchParams(location.search)
  const paymentStatus = searchParams.get('payment')
  const stripeSessionId = searchParams.get('session_id')

  const storedFortuneData = (() => {
    try { return JSON.parse(sessionStorage.getItem('fortune_data') ?? 'null') } catch { return null }
  })()
  const storedSessionData = (() => {
    try { return JSON.parse(sessionStorage.getItem('fortune_session') ?? 'null') } catch { return null }
  })()
  const storedReading = sessionStorage.getItem('fortune_reading') ?? ''

  const fortuneData: FortuneData | null = state?.fortuneData ?? storedFortuneData

  // Stripe キャンセル・成功リターン時は保存済みの鑑定文を復元
  const isStripeReturn = paymentStatus === 'success' || paymentStatus === 'cancel'
  const [reading, setReading]       = useState(isStripeReturn ? storedReading : '')
  const [isStreaming, setIsStreaming] = useState(true)
  const [apiError, setApiError]      = useState(false)
  const [noApiKey, setNoApiKey]      = useState(false)
  const [sessionData, setSessionData] = useState<Record<string, unknown>>(storedSessionData ?? {})
  const [streamDone, setStreamDone]  = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // AbortController で StrictMode の二重呼び出しを防ぐ
  const abortRef = useRef<AbortController | null>(null)

  // Stripe 決済後の処理
  useEffect(() => {
    if (paymentStatus === 'success' && stripeSessionId) {
      fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stripeSessionId }),
      })
        .then(r => r.json())
        .then((body: { token?: string }) => {
          if (body.token) {
            localStorage.setItem(TOKEN_KEY, body.token)
            setPaymentSuccess(true)
          }
        })
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!fortuneData) {
      navigate('/')
      return
    }
    // 決済リターン時（成功・キャンセル問わず）はストリーミングしない
    if (isStripeReturn) {
      setIsStreaming(false)
      setStreamDone(true)
      return
    }

    // 前回のリクエストをキャンセル（StrictMode 対策）
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // APIキー確認してからストリーミング開始
    fetch('/health')
      .then(r => r.json())
      .then((body: { hasApiKey?: boolean }) => {
        if (controller.signal.aborted) return
        if (!body.hasApiKey) {
          setNoApiKey(true)
          setIsStreaming(false)
          return
        }
        if (fortuneData) streamFortune(fortuneData, controller.signal)
      })
      .catch(() => {
        // ヘルスチェック失敗時はそのままストリーミング試行
        if (!controller.signal.aborted && fortuneData) {
          streamFortune(fortuneData, controller.signal)
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

  async function streamFortune(fortuneData: FortuneData, signal: AbortSignal) {
    setReading('')
    setIsStreaming(true)
    setApiError(false)
    setStreamDone(false)

    try {
      const { input, shichu, nayin, sanmei, sukuyo } = fortuneData
      const res = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthDate: input.birthDate,
          birthTime: input.birthTime,
          gender: input.gender,
          mbti: input.mbti,
          question: input.question,
          fortuneData: { input, shichu, nayin, sanmei, sukuyo, partner: fortuneData.partner },
        }),
        signal,
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `HTTP ${res.status}`)
      }
      if (!res.body) throw new Error('No body')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accum = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') {
            setIsStreaming(false)
            setStreamDone(true)
            sessionStorage.setItem('fortune_reading', accum)
            continue
          }
          try {
            const parsed = JSON.parse(raw)
            if (parsed.sessionData) {
              setSessionData(parsed.sessionData)
              continue
            }
            const delta = parsed.delta?.text ?? ''
            if (delta) {
              accum += delta
              setReading(accum)
            }
          } catch {
            // ignore JSON parse errors in stream
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Stream error:', err)
      setApiError(true)
    } finally {
      setIsStreaming(false)
      setStreamDone(true)
    }
  }

  if (!fortuneData) return null

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ヘッダー */}
        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-white/50 hover:text-white/80 transition-colors text-sm flex items-center gap-1 font-sans"
          >
            ← トップへ戻る
          </button>
          <h1 className="text-gold font-serif text-xl font-bold">星読み鑑定</h1>
        </header>

        {/* 決済完了バナー */}
        {paymentSuccess && (
          <div className="glass-card p-4 border border-gold/40 animate-fade-in text-center">
            <p className="text-gold font-serif font-bold text-sm">✦ 決済が完了しました</p>
            <p className="text-white/50 text-xs mt-1">引き続き無制限でご相談いただけます</p>
          </div>
        )}

        {/* サマリーカード（常に表示） */}
        <ResultCard data={fortuneData} />

        {/* APIキー未設定ガイド */}
        {noApiKey && (
          <div className="glass-card p-5 border-yellow-400/30 border animate-fade-in">
            <p className="text-yellow-300 font-serif font-bold mb-2">⚙ APIキーが設定されていません</p>
            <p className="text-white/60 text-sm leading-relaxed mb-3">
              AI鑑定を使用するには、Anthropic APIキーをバックエンドに設定してください。
            </p>
            <div className="bg-white/5 rounded-lg p-3 font-mono text-xs text-white/50 space-y-1">
              <p className="text-white/30"># fortune-site/backend/.env</p>
              <p>ANTHROPIC_API_KEY=<span className="text-gold">sk-ant-xxxxxxxx</span></p>
            </div>
            <p className="text-white/40 text-xs mt-3">
              設定後、バックエンドを再起動してください（<code className="text-white/60">npm run dev</code>）
            </p>
            <p className="text-white/30 text-xs mt-1">
              APIキーは <a className="text-gold/70 underline" href="https://console.anthropic.com/" target="_blank" rel="noreferrer">console.anthropic.com</a> で取得できます
            </p>
          </div>
        )}

        {/* API エラー時のガイド */}
        {apiError && (
          <div className="glass-card p-5 border-red-400/30 border animate-fade-in">
            <p className="text-red-300 font-serif font-bold mb-2">⚠ 鑑定文を取得できませんでした</p>
            <p className="text-white/60 text-sm leading-relaxed">
              バックエンドの <code className="text-gold text-xs bg-white/10 px-1 rounded">ANTHROPIC_API_KEY</code> を設定してください。
            </p>
            <div className="mt-3 bg-white/5 rounded-lg p-3 font-mono text-xs text-white/50 space-y-1">
              <p># fortune-site/backend/.env</p>
              <p>ANTHROPIC_API_KEY=<span className="text-gold">sk-ant-...</span></p>
            </div>
            <p className="text-white/40 text-xs mt-2">設定後、バックエンドを再起動してください（npm run dev）</p>
          </div>
        )}

        {/* 鑑定文（ストリーミング表示） */}
        {!apiError && !noApiKey && (
          <FortuneReading reading={reading} isStreaming={isStreaming} />
        )}

        {/* チャット（ストリーミング完了・鑑定文あり・エラーなし の場合に表示） */}
        {streamDone && !apiError && !noApiKey && reading && (
          <ChatArea
            fortuneData={fortuneData}
            initialReading={reading}
            sessionData={sessionData}
          />
        )}
      </div>
    </div>
  )
}
