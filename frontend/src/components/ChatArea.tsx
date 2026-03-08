import { useState, useRef, useEffect } from 'react'
import type { ChatMessage, FortuneData } from '../lib/types'

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
  const isPaid = !!localStorage.getItem(TOKEN_KEY)
  const [isCheckingPayment, setIsCheckingPayment] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  async function handlePayment() {
    setIsCheckingPayment(true)
    try {
      // fortuneDataをsessionStorageに退避（Stripe後に戻ったとき用）
      sessionStorage.setItem('fortune_data', JSON.stringify(fortuneData))
      sessionStorage.setItem('fortune_session', JSON.stringify(sessionData))

      const res = await fetch('/api/payment/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error(err)
      alert('決済の開始に失敗しました。しばらく後にお試しください。')
    } finally {
      setIsCheckingPayment(false)
    }
  }

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2 p-6 pb-4 border-b border-white/10">
        <div className="w-1 h-6 bg-gold rounded-full" />
        <h2 className="text-gold font-serif text-lg font-bold">追加相談</h2>
        {!isPaid && (
          <span className="ml-auto text-white/40 text-xs font-sans">
            残り {Math.max(0, FREE_LIMIT - userMsgCount)} 回無料
          </span>
        )}
        {isPaid && (
          <span className="ml-auto text-gold/60 text-xs font-sans">✦ 無制限プラン</span>
        )}
      </div>

      {/* メッセージ一覧 */}
      <div className="p-6 space-y-4 max-h-[480px] overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold text-sm mr-3 flex-shrink-0 mt-1">
                ✦
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed font-sans ${
                msg.role === 'user'
                  ? 'bg-gold/20 border border-gold/30 text-white/90 rounded-tr-sm'
                  : 'bg-white/5 border border-white/10 text-white/85 rounded-tl-sm'
              }`}
            >
              {msg.content
                ? <span className="whitespace-pre-wrap">{msg.content}</span>
                : <span className="streaming-cursor" />
              }
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 text-sm ml-3 flex-shrink-0 mt-1">
                人
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 決済ウォール */}
      {isLimitReached ? (
        <div className="p-6 border-t border-white/10 text-center space-y-4">
          <p className="text-white/70 font-serif text-sm">
            無料の3回相談をご利用いただきました
          </p>
          <p className="text-white/50 text-xs">
            引き続きご相談いただくには、追加プランをご利用ください
          </p>
          <button
            onClick={handlePayment}
            disabled={isCheckingPayment}
            className="w-full py-3 bg-gold hover:bg-gold/90 text-deep-navy font-bold rounded-xl transition-all disabled:opacity-50 font-serif text-sm"
          >
            {isCheckingPayment ? '準備中...' : '続けて相談する（500円）'}
          </button>
          <p className="text-white/25 text-xs">Stripe による安全な決済</p>
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
            className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-all resize-none text-sm font-sans disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="px-5 py-3 bg-gold/80 hover:bg-gold text-deep-navy font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed self-end"
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
  )
}
