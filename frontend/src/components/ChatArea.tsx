import { useState, useRef, useEffect } from 'react'
import type { ChatMessage, FortuneData } from '../lib/types'
import { PayjpModal } from './PayjpModal'

const FREE_LIMIT = 3
const TOKEN_KEY = 'fortune_paid_token'

interface Props {
  fortuneData: FortuneData
  initialReading: string
  sessionData: Record<string, unknown>
}

export function ChatArea({ fortuneData, initialReading, sessionData }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: initialReading }
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [userMsgCount, setUserMsgCount] = useState(0)
  const [isPaid, setIsPaid] = useState(!!localStorage.getItem(TOKEN_KEY))
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const isLimitReached = !isPaid && userMsgCount >= FREE_LIMIT

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming || isLimitReached) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = messages.filter(m => m.role === 'user' || messages.indexOf(m) > 0)

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    setUserMsgCount(c => c + 1)

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    const paidToken = localStorage.getItem(TOKEN_KEY) ?? undefined

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(paidToken ? { Authorization: `Bearer ${paidToken}` } : {}),
        },
        body: JSON.stringify({
          sessionData,
          conversationHistory: [...history, userMsg],
          newMessage: text,
        }),
      })

      if (!res.ok) throw new Error('Chat API error')
      if (!res.body) throw new Error('No response body')

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
          if (raw === '[DONE]') continue
          try {
            const parsed = JSON.parse(raw)
            const delta = parsed.delta?.text ?? ''
            if (delta) {
              accum += delta
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: 'assistant', content: accum }
                return next
              })
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: '申し訳ございません。エラーが発生しました。再度お試しください。'
        }
        return next
      })
    } finally {
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function handlePayjpToken(payjpToken: string) {
    setIsProcessingPayment(true)
    setPaymentError('')
    try {
      // 3DS後に戻った時のためにデータを退避
      sessionStorage.setItem('fortune_data', JSON.stringify(fortuneData))
      sessionStorage.setItem('fortune_session', JSON.stringify(sessionData))
      sessionStorage.setItem('fortune_reading', initialReading)

      const res = await fetch('/api/payment/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payjpToken }),
      })
      const body = await res.json() as { tdsUrl?: string; chargeId?: string; token?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? '決済に失敗しました')

      if (body.tdsUrl && body.chargeId) {
        // 3DS認証へリダイレクト
        sessionStorage.setItem('fortune_tds_charge_id', body.chargeId)
        window.location.href = body.tdsUrl
        return
      }

      // 3DS不要の場合
      if (!body.token) throw new Error('決済に失敗しました')
      localStorage.setItem(TOKEN_KEY, body.token)
      setIsPaid(true)
      setShowPaymentModal(false)
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : '決済に失敗しました')
      setIsProcessingPayment(false)
    }
  }

  return (
    <>
      {showPaymentModal && (
        <PayjpModal
          mode="subscription"
          title="月額プランで続ける"
          amount={500}
          isProcessing={isProcessingPayment}
          error={paymentError}
          onToken={handlePayjpToken}
          onClose={() => { setShowPaymentModal(false); setPaymentError('') }}
        />
      )}

      <div className="glass-card overflow-hidden animate-fade-in">
        <div className="flex items-center gap-2 p-6 pb-4 border-b border-white/10">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h2 className="text-white font-semibold text-base">追加相談</h2>
          {!isPaid && (
            <span className="ml-auto text-white/40 text-xs">
              残り {Math.max(0, FREE_LIMIT - userMsgCount)} 回無料
            </span>
          )}
          {isPaid && (
            <span className="ml-auto text-accent text-xs">無制限プラン</span>
          )}
        </div>

        {/* メッセージ一覧 */}
        <div ref={messagesRef} className="p-6 space-y-4 max-h-[480px] overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs mr-3 flex-shrink-0 mt-1">
                  読
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed font-sans ${
                  msg.role === 'user'
                    ? 'bg-accent/15 border border-accent/20 text-white/90 rounded-tr-sm'
                    : 'bg-white/5 border border-white/10 text-white/85 rounded-tl-sm'
                }`}
              >
                {msg.content
                  ? <span className="whitespace-pre-wrap">{msg.content}</span>
                  : <span className="streaming-cursor" />
                }
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 text-xs ml-3 flex-shrink-0 mt-1">
                  You
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 決済ウォール */}
        {isLimitReached ? (
          <div className="p-6 border-t border-white/10 text-center space-y-4">
            <p className="text-white/70 text-sm">
              無料の3回相談をご利用いただきました
            </p>
            <p className="text-white/50 text-xs">
              引き続きご相談いただくには、追加プランをご利用ください
            </p>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full py-3 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20"
              style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
            >
              月額プランで続ける（¥500 / 月）
            </button>
            <p className="text-white/25 text-xs">PAY.JP による安全な決済</p>
          </div>
        ) : (
          /* 入力エリア */
          <div className="p-4 border-t border-white/10 flex gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="さらに詳しく聞く…（Enterで送信、Shift+Enterで改行）"
              rows={2}
              disabled={isStreaming}
              className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all resize-none text-sm font-sans disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
              className="px-5 py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed self-end"
            >
              {isStreaming ? (
                <span className="inline-block w-5 h-5 border-2 border-deep-navy/30 border-t-deep-navy rounded-full animate-spin" />
              ) : (
                '送信'
              )}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
