import { useState, useRef, useEffect } from 'react'
import type { FortuneData } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'
import { saveChatMessages } from '../lib/history'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  fortuneData: FortuneData
  featureLabel: string
  analysisId?: string
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <strong key={i} className="text-white font-semibold">{p}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

export function AnalysisChatPanel({ fortuneData, featureLabel, analysisId }: Props) {
  const { session, points, refreshPoints } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [insufficientPoints, setInsufficientPoints] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `${featureLabel}の結果をもとに、さらに詳しく相談できます。気になることは何でもどうぞ。`,
      }])
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  async function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    setInsufficientPoints(false)

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setIsStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    const { input: fi, shichu, nayin, sanmei, sukuyo, lifePathNumber, honmeiName, archetype, sukuyoDetail } = fortuneData

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          newMessage: text,
          conversationHistory: newMessages.slice(0, -1),
          birthDate: fi.birthDate,
          birthTime: fi.birthTime,
          gender: fi.gender,
          calculatedData: {
            shichuYear: shichu.year.kanshi,
            shichuMonth: shichu.month.kanshi,
            shichuDay: shichu.day.kanshi,
            shichuHour: shichu.hour?.kanshi ?? null,
            nayin,
            sanmeiStar: sanmei.shukumeiStar,
            chusatsu: sanmei.chusatsu,
            sukuyo,
            lifePathNumber,
            honmeiName,
            archetype,
            sukuyoDetail,
          },
          ...(fi.partnerBirthDate ? { partnerBirthDate: fi.partnerBirthDate, partnerGender: fi.partnerGender } : {}),
        }),
      })

      if (res.status === 402) {
        setInsufficientPoints(true)
        setMessages(prev => prev.slice(0, -1))
        setIsStreaming(false)
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'エラーが発生しました')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const d = line.slice(6)
          if (d === '[DONE]') break
          try {
            const parsed = JSON.parse(d) as { delta?: { text?: string } }
            if (parsed.delta?.text) {
              full += parsed.delta.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: full }
                return updated
              })
            }
          } catch { /* ignore */ }
        }
      }

      refreshPoints()
      if (analysisId) {
        const allMessages = [...newMessages, { role: 'assistant' as const, content: full }]
        saveChatMessages(analysisId, allMessages).catch(() => {})
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'エラーが発生しました',
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <div className="glass-card border border-accent/20 overflow-hidden">
      {/* ヘッダー（アコーディオン） */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
        onClick={() => setIsOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-white font-semibold text-sm">この結果についてAIに相談する</span>
          <span className="text-white/30 text-xs">2pt / 回</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-xs font-mono">{points} pt</span>
          <span className={`text-white/40 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-white/8">
          {/* メッセージ */}
          <div className="px-4 py-4 space-y-3 max-h-80 overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent text-xs">✦</span>
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent/20 text-white/90 rounded-tr-sm'
                    : 'bg-white/5 border border-white/8 text-white/80 rounded-tl-sm'
                }`}>
                  {msg.role === 'assistant'
                    ? (msg.content
                        ? renderBold(msg.content)
                        : <span className="inline-flex gap-1">{[0,1,2].map(j => <span key={j} className="w-1 h-1 rounded-full bg-accent/50 animate-pulse inline-block" style={{ animationDelay: `${j * 0.2}s` }} />)}</span>
                      )
                    : msg.content
                  }
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {insufficientPoints && (
            <div className="px-4 pb-3">
              <p className="text-amber-400 text-xs text-center">ポイントが不足しています（2pt必要）</p>
            </div>
          )}

          {/* 入力エリア */}
          <div className="px-4 pb-4 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="この結果についてさらに詳しく聞く…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/40 resize-none transition-all disabled:opacity-50"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="w-9 h-9 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-30 flex items-center justify-center transition-all flex-shrink-0"
            >
              {isStreaming
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              }
            </button>
          </div>
          <p className="text-white/15 text-xs text-center pb-3">Enter で送信 · Shift+Enter で改行</p>
        </div>
      )}
    </div>
  )
}
