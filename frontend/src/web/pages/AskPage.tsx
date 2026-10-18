import { useEffect, useRef, useState, type FormEvent } from 'react'
import { demoAnswer } from '../data/demoData'
import { Link, Navigate, useParams } from 'react-router-dom'
import { IconChevron, IconSend } from '../components/icons'
import { BackHeader, Page } from '../components/ui'
import { AiConsentNotice } from '../components/AiConsent'
import type { ChatMessage } from '../data/types'
import { useApp } from '../state/AppState'
import { apiFetch, newOperationId } from '../data/api'

/**
 * 相談のブックへの質問（1冊につき2回。無料の質問はなし）。
 * 本番：既存の POST /api/reading/conversations/:id/questions を土台に、
 * 「ブックごとの残りの冊数」をサーバー側で数える仕組みの追加が必要（operationId・AI同意ヘッダー付き、SSEで回答）
 */
export function AskPage() {
  const { bookId } = useParams()
  const { books, consumeBookQuestion, aiConsented, acceptAiConsent } = useApp()
  const book = books.find(b => b.id === bookId)
  const [agreed, setAgreed] = useState(false)
  const consentOk = aiConsented || agreed
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [waiting, setWaiting] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()
  const remaining = book?.questionsLeft ?? 0

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, waiting])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!book || book.state !== 'delivered') return <Navigate to="/books" replace />
  const currentBook = book

  async function send(e: FormEvent) {
    e.preventDefault()
    const q = text.trim()
    if (!q || waiting || remaining <= 0 || !consentOk) return
    if (!aiConsented) acceptAiConsent()
    setMessages(m => [...m, { id: `u-${Date.now()}`, role: 'user', text: q }])
    setText('')
    setWaiting(true)
    try {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
        const { supabase } = await import('../../lib/supabase')
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (!token) throw new Error('ログイン状態を確認できませんでした')
        const result = await apiFetch<{ answer: string }>(`/api/books/${currentBook.id}/questions`, { method: 'POST', accessToken: token, aiConsent: true, body: JSON.stringify({ operationId: newOperationId(), question: q }) })
        consumeBookQuestion(currentBook.id)
        setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: result.answer }])
      } else {
        timer.current = window.setTimeout(() => setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: demoAnswer }]), 1500)
        consumeBookQuestion(currentBook.id)
      }
    } catch (error) {
      setMessages(m => [...m, { id: `e-${Date.now()}`, role: 'assistant', text: error instanceof Error ? error.message : '質問を送信できませんでした。' }])
    } finally { setWaiting(false) }
  }

  return (
    <Page>
      <div className="flex min-h-screen flex-col">
        <BackHeader to={`/books/${book.id}`} sticky title={<span className="flex flex-col"><span>ブックへの質問</span><span className="line-clamp-1 text-xs font-normal text-fl-muted">{book.title}</span></span>}
          right={<span className="shrink-0 pr-2 text-xs text-fl-muted">あと{remaining}回</span>} />

        <h1 className="sr-only">「{book.title}」への質問</h1>
        <section className="flex flex-1 flex-col gap-4 px-4 py-5" aria-live="polite">
          <div className="self-center rounded-xl bg-fl-surface px-3 py-1.5 text-center text-xs leading-[1.7] text-fl-body">このブックで気になったところを、2回まで質問できます</div>
          {messages.length === 0 && remaining > 0 && (
            <div className="flex flex-col gap-2" aria-label="質問の例">
              <span className="text-xs text-fl-muted">たとえば</span>
              {['いちばん大事なところを、もう少し具体的に教えてください', 'この過ごし方は、いつ頃から意識するとよいですか'].map(q => (
                <button key={q} type="button" onClick={() => setText(q)} className="min-h-[44px] self-start rounded-2xl border border-fl-line bg-white px-4 py-2.5 text-left text-sm text-fl-body hover:bg-fl-surface">{q}</button>
              ))}
            </div>
          )}
          {messages.map(m => m.role === 'user' ? (
            <div key={m.id} className="max-w-[82%] self-end rounded-[18px] rounded-br-[4px] bg-fl-ink px-4 py-3 text-[15px] leading-[1.75] text-white">{m.text}</div>
          ) : (
            <div key={m.id} className="flex max-w-[88%] flex-col gap-1.5 self-start">
              <span className="text-[11px] font-medium tracking-[0.2em] text-fl-muted">FATE LAB</span>
              <div className="rounded-[18px] rounded-bl-[4px] border border-fl-line bg-white px-4 py-3.5 text-[15px] leading-[1.85]">{m.text}</div>
            </div>
          ))}
          {waiting && (
            <div className="flex items-center gap-2 self-start rounded-[18px] border border-fl-line bg-white px-4 py-3 text-[13px] text-fl-muted">
              <span className="flex gap-1" aria-hidden="true"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fl-muted" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fl-muted [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fl-muted [animation-delay:300ms]" /></span>
              答えを書いています
            </div>
          )}
          {remaining <= 0 && !waiting && (
            <Link to="/compose" className="mt-2 flex items-center gap-3 rounded-2xl bg-fl-cream px-4 py-3.5">
              <span className="flex flex-1 flex-col gap-0.5"><span className="text-sm font-medium">このブックへの質問は使い切りました</span><span className="text-xs text-fl-body">続きは、新しい相談のブックで（質問2回つき）</span></span>
              <IconChevron size={16} />
            </Link>
          )}
          <div ref={endRef} />
        </section>

        {!aiConsented && remaining > 0 && <div className="px-3 pb-2"><AiConsentNotice agreed={agreed} onChange={setAgreed} accepted={false} /></div>}

        <form onSubmit={send} className="sticky bottom-0 flex flex-col gap-1.5 border-t border-fl-line bg-fl-canvas px-3 pb-3.5 pt-2.5">
          <div className="flex items-end gap-2">
            <label htmlFor="ask" className="sr-only">質問を入力</label>
            <textarea id="ask" rows={1} value={text} onChange={e => setText(e.target.value)} maxLength={1200} disabled={remaining <= 0}
              placeholder={remaining > 0 ? 'このブックについて質問する' : '質問は使い切りました'}
              className="min-h-[48px] flex-1 resize-none rounded-2xl border border-fl-line bg-white px-3.5 py-3 text-base leading-normal placeholder:text-fl-muted disabled:bg-fl-surface" />
            <button type="submit" aria-label="送信" disabled={!text.trim() || waiting || remaining <= 0 || !consentOk}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fl-ink text-white disabled:bg-fl-line disabled:text-fl-muted"><IconSend /></button>
          </div>
          <span className="pl-1 text-[11px] text-fl-muted">{remaining > 0 ? `このブックへの質問 あと${remaining}回` : 'このブックへの質問は使い切りました'}</span>
        </form>
      </div>
    </Page>
  )
}
