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
const REPORT_TOKEN_KEY = 'fortune_report_token'

type Tab = 'chat' | 'report' | 'mypage'

export function ResultPage() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const state     = location.state as LocationState | null

  const searchParams = new URLSearchParams(location.search)
  const paymentStatus = searchParams.get('payment')
  const stripeSessionId = searchParams.get('session_id')
  const paymentType = searchParams.get('type')

  const storedFortuneData = (() => {
    try { return JSON.parse(sessionStorage.getItem('fortune_data') ?? 'null') } catch { return null }
  })()
  const storedSessionData = (() => {
    try { return JSON.parse(sessionStorage.getItem('fortune_session') ?? 'null') } catch { return null }
  })()
  const storedReading = sessionStorage.getItem('fortune_reading') ?? ''

  const fortuneData: FortuneData | null = state?.fortuneData ?? storedFortuneData

  const isStripeReturn = paymentStatus === 'success' || paymentStatus === 'cancel'
  const [reading, setReading]       = useState(isStripeReturn ? storedReading : '')
  const [isStreaming, setIsStreaming] = useState(true)
  const [apiError, setApiError]      = useState(false)
  const [rateLimitError, setRateLimitError] = useState(false)
  const [noApiKey, setNoApiKey]      = useState(false)
  const [sessionData, setSessionData] = useState<Record<string, unknown>>(storedSessionData ?? {})
  const [streamDone, setStreamDone]  = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [reportPaymentSuccess, setReportPaymentSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [isRequestingReport, setIsRequestingReport] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [reportError, setReportError] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const reportAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (paymentStatus === 'success' && stripeSessionId) {
      fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stripeSessionId, type: paymentType }),
      })
        .then(r => r.json())
        .then((body: { token?: string; type?: string }) => {
          if (body.token) {
            if (body.type === 'report') {
              localStorage.setItem(REPORT_TOKEN_KEY, body.token)
              setReportPaymentSuccess(true)
              setActiveTab('report')
            } else {
              localStorage.setItem(TOKEN_KEY, body.token)
              setPaymentSuccess(true)
            }
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
    if (isStripeReturn) {
      setIsStreaming(false)
      setStreamDone(true)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

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
        if (!controller.signal.aborted && fortuneData) {
          streamFortune(fortuneData, controller.signal)
        }
      })

    return () => { controller.abort() }
  }, [])

  async function streamFortune(fortuneData: FortuneData, signal: AbortSignal) {
    setReading('')
    setIsStreaming(true)
    setApiError(false)
    setRateLimitError(false)
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
        if (res.status === 429) {
          setRateLimitError(true)
          setIsStreaming(false)
          setStreamDone(true)
          return
        }
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

  async function generateReport() {
    const token = localStorage.getItem(REPORT_TOKEN_KEY)
    if (!token || !fortuneData) return

    reportAbortRef.current?.abort()
    const controller = new AbortController()
    reportAbortRef.current = controller

    setReportContent('')
    setIsGeneratingReport(true)
    setReportDone(false)
    setReportError(false)

    try {
      const res = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fortuneData, reportToken: token }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No body')

      const reader = res.body.getReader()
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
            setIsGeneratingReport(false)
            setReportDone(true)
            continue
          }
          try {
            const parsed = JSON.parse(raw)
            const delta = parsed.delta?.text ?? ''
            if (delta) {
              accum += delta
              setReportContent(accum)
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Report generate error:', err)
      setReportError(true)
      setIsGeneratingReport(false)
    }
  }

  async function handleReportPayment() {
    setIsRequestingReport(true)
    try {
      sessionStorage.setItem('fortune_data', JSON.stringify(fortuneData))
      sessionStorage.setItem('fortune_session', JSON.stringify(sessionData))

      const res = await fetch('/api/payment/create-report-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error(err)
      alert('決済の開始に失敗しました。しばらく後にお試しください。')
    } finally {
      setIsRequestingReport(false)
    }
  }

  if (!fortuneData) return null

  const hasReportToken = !!localStorage.getItem(REPORT_TOKEN_KEY)
  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'AIチャット' },
    { id: 'report', label: '詳細分析レポート' },
    { id: 'mypage', label: 'マイページ' },
  ]

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-white/40 hover:text-white/70 transition-colors text-sm flex items-center gap-1"
          >
            ← 新規解析
          </button>
          <h1 className="text-white/70 font-garamond italic text-sm tracking-widest">Meishiki Analysis</h1>
        </header>

        {paymentSuccess && (
          <div className="glass-card p-4 border border-accent/30 animate-fade-in text-center">
            <p className="text-accent font-semibold text-sm">決済が完了しました</p>
            <p className="text-white/40 text-xs mt-1">チャット機能が無制限でご利用いただけます</p>
          </div>
        )}
        {reportPaymentSuccess && (
          <div className="glass-card p-4 border border-accent/30 animate-fade-in text-center">
            <p className="text-accent font-semibold text-sm">詳細レポートのご購入が完了しました</p>
            <p className="text-white/40 text-xs mt-1">「詳細分析レポート」タブからご確認ください</p>
          </div>
        )}

        <ResultCard data={fortuneData} />

        {noApiKey && (
          <div className="glass-card p-5 border border-yellow-500/20 animate-fade-in">
            <p className="text-yellow-400 font-semibold mb-2 text-sm">APIキーが未設定です</p>
            <p className="text-white/50 text-sm">バックエンドの ANTHROPIC_API_KEY を設定してください。</p>
          </div>
        )}

        {rateLimitError && (
          <div className="glass-card p-5 border border-accent/20 animate-fade-in text-center space-y-3">
            <p className="text-accent font-semibold text-sm">無料の解析回数の上限に達しました</p>
            <p className="text-white/50 text-sm">1時間あたり3回まで無料でご利用いただけます。<br />時間をおいて再度お試しください。</p>
          </div>
        )}

        {apiError && (
          <div className="glass-card p-5 border border-red-500/20 animate-fade-in">
            <p className="text-red-400 font-semibold mb-2 text-sm">解析エラーが発生しました</p>
            <p className="text-white/50 text-sm">しばらく時間をおいて再度お試しください。</p>
          </div>
        )}

        {!apiError && !rateLimitError && !noApiKey && (
          <FortuneReading reading={reading} isStreaming={isStreaming} />
        )}

        {streamDone && !apiError && !rateLimitError && !noApiKey && reading && (
          <div>
            <div className="flex border-b border-navy-light">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-white/40 hover:text-white/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="pt-4">
              {activeTab === 'chat' && (
                <ChatArea
                  fortuneData={fortuneData}
                  initialReading={reading}
                  sessionData={sessionData}
                />
              )}

              {activeTab === 'report' && (
                <div className="glass-card p-6 space-y-5">
                  <div>
                    <h3 className="text-white font-semibold text-base mb-1">宿命構造分析書（詳細版）</h3>
                    <p className="text-white/30 text-xs">Confidential Document — 個人専用レポート</p>
                  </div>

                  {hasReportToken || reportPaymentSuccess ? (
                    <div className="space-y-4">
                      {!reportContent && !isGeneratingReport && !reportDone && (
                        <div className="space-y-3">
                          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                            <p className="text-accent font-semibold text-sm mb-1">レポート購入済み</p>
                            <p className="text-white/50 text-xs">下のボタンからレポートを生成してください。生成には約10分かかります。</p>
                          </div>
                          <button
                            onClick={generateReport}
                            className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg transition-all text-sm"
                          >
                            レポートを生成する
                          </button>
                        </div>
                      )}

                      {isGeneratingReport && !reportContent && (
                        <div className="flex flex-col items-center justify-center py-10 gap-4">
                          <div className="flex gap-1.5">
                            {[0, 1, 2].map(i => (
                              <div key={i} className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                            ))}
                          </div>
                          <p className="text-white/50 text-sm text-center">
                            宿命構造分析書を生成中です<br />
                            <span className="text-white/30 text-xs">約10分かかります。このページを閉じないでください。</span>
                          </p>
                        </div>
                      )}

                      {reportContent && (
                        <div className="space-y-3">
                          <div className="text-white/80 text-sm leading-loose whitespace-pre-wrap">
                            {reportContent}
                            {isGeneratingReport && <span className="streaming-cursor" />}
                          </div>
                          {reportDone && (
                            <p className="text-white/20 text-xs text-center pt-2">— 生成完了 —</p>
                          )}
                        </div>
                      )}

                      {reportError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                          <p className="text-red-400 text-sm">生成中にエラーが発生しました。</p>
                          <button onClick={generateReport} className="text-accent text-xs mt-2 underline">再試行する</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2 text-sm text-white/60">
                        {[
                          ['I', '命式プロファイル'],
                          ['II', '外面と内面の乖離構造'],
                          ['III', '恋愛・婚姻傾向'],
                          ['IV', '職業・財運の傾向'],
                          ['V', '年単位バイオリズム（直近5年）'],
                          ['VI', '今すぐ実行すべき3つの戦略'],
                        ].map(([num, item]) => (
                          <div key={item} className="flex gap-3 items-baseline">
                            <span className="text-white/20 font-garamond italic text-xs w-6 flex-shrink-0">{num}</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-navy-light pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white/60 text-sm">詳細分析レポート</span>
                          <span className="text-white font-bold text-lg">¥2,000</span>
                        </div>
                        <button
                          onClick={handleReportPayment}
                          disabled={isRequestingReport}
                          className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg transition-all disabled:opacity-50 text-sm"
                        >
                          {isRequestingReport ? '処理中...' : '詳細レポートを購入する'}
                        </button>
                        <p className="text-white/20 text-xs text-center mt-2">Stripe による安全な決済</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'mypage' && (
                <div className="glass-card p-6 space-y-4">
                  <h3 className="text-white font-semibold text-base">マイページ</h3>
                  <div className="space-y-0">
                    <div className="flex items-center justify-between py-3 border-b border-navy-light">
                      <span className="text-white/50 text-sm">チャットプラン</span>
                      <span className={`text-sm font-medium ${localStorage.getItem(TOKEN_KEY) ? 'text-accent' : 'text-white/30'}`}>
                        {localStorage.getItem(TOKEN_KEY) ? '無制限プラン' : '無料（3回まで）'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-navy-light">
                      <span className="text-white/50 text-sm">詳細レポート</span>
                      <span className={`text-sm font-medium ${hasReportToken || reportPaymentSuccess ? 'text-accent' : 'text-white/30'}`}>
                        {hasReportToken || reportPaymentSuccess ? '購入済み' : '未購入'}
                      </span>
                    </div>
                  </div>
                  <p className="text-white/20 text-xs">解析データはブラウザのセッション内のみ保持されます</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
