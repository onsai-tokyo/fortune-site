import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Message = { role: 'user' | 'assistant'; content: string; referenced_systems?: string[] }
type PendingReading = { birthData: Record<string, unknown>; calculatedData: Record<string, unknown>; reportText: string; sourceSection?: string; sourceYear?: number; suggestedQuestion?: string }

declare global { interface Window { gtag?: (...args: unknown[]) => void } }
const track = (name: string, params: Record<string, unknown> = {}) => window.gtag?.('event', name, params)

export default function ReadingPage() {
  const { user, session, isLoading } = useAuth()
  const [params, setParams] = useSearchParams()
  const [conversationId, setConversationId] = useState(params.get('conversation') ?? '')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<{ premium: boolean; remaining: number | null; limit: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Array<{ id: string; title: string; updated_at: string }>>([])
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pending = useMemo<PendingReading | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('fate_reading_context') ?? 'null') } catch { return null }
  }, [])

  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    fetch('/api/stripe/plan').then(async response => response.ok ? response.json() : null).then(plan => {
      if (plan?.unitAmount != null) setMonthlyPrice(`${Number(plan.unitAmount).toLocaleString('ja-JP')}円／月`)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!session?.access_token) return
    void (async () => {
      if (params.get('checkout') === 'success') { track('checkout_completed'); track('subscription_started') }
      const statusResponse = await fetch('/api/reading/status', { headers: authHeaders() })
      if (!statusResponse.ok) { setError('利用状況を確認できませんでした'); return }
      let state = await statusResponse.json()
      if (params.get('checkout') === 'success' && !state.premium) {
        for (let attempt = 0; attempt < 5 && !state.premium; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1200))
          state = await fetch('/api/reading/status', { headers: authHeaders() }).then(r => r.json())
        }
      }
      setStatus(state)
      const wasPremium = localStorage.getItem('fate_was_premium') === 'true'
      if (wasPremium && !state.premium) track('subscription_cancelled')
      localStorage.setItem('fate_was_premium', String(Boolean(state.premium)))
      const historyResponse = await fetch('/api/reading/conversations', { headers: authHeaders() })
      const historyBody = await historyResponse.json()
      if (!historyResponse.ok) { setError(historyBody.error ?? '鑑定履歴を取得できませんでした'); return }
      setHistory(historyBody.conversations ?? [])
      if (conversationId) {
        const body = await fetch(`/api/reading/conversations/${conversationId}`, { headers: authHeaders() }).then(r => r.json())
        if (body.messages) setMessages(body.messages)
        return
      }
      if (!pending) return
      const response = await fetch('/api/reading/conversations', { method: 'POST', headers: authHeaders(), body: JSON.stringify({
        title: pending.sourceYear ? `${pending.sourceYear}年について` : `${pending.sourceSection ?? '鑑定結果'}について`, ...pending,
      }) })
      const body = await response.json()
      if (!response.ok) { setError(body.error ?? '鑑定結果を引き継げませんでした'); return }
      setConversationId(body.id); setParams({ conversation: body.id }, { replace: true })
      setInput(pending.suggestedQuestion ?? '')
      sessionStorage.removeItem('fate_reading_context')
    })()
  }, [session?.access_token])

  async function send(question = input) {
    const text = question.trim()
    if (!text || !conversationId || sending || !session?.access_token) return
    setInput(''); setError(''); setSending(true)
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    track('question_sent', { conversation_id: conversationId })
    if (messages.filter(item => item.role === 'user').length === 1) track('second_question_sent', { conversation_id: conversationId })
    try {
      const response = await fetch(`/api/reading/conversations/${conversationId}/questions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ question: text }) })
      if (response.status === 402) {
        setMessages(prev => prev.slice(0, -1)); setStatus(prev => prev ? { ...prev, remaining: 0 } : prev)
        track('free_limit_reached'); track('paywall_viewed'); return
      }
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({}))).error ?? '回答を取得できませんでした')
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let answer = ''; let buffer = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6); if (raw === '[DONE]') continue
          const part = JSON.parse(raw)
          if (part.error) throw new Error(part.error)
          if (part.delta?.text) { answer += part.delta.text; setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: answer }]) }
        }
      }
      if (!answer.trim()) throw new Error('回答を取得できませんでした')
      const state = await fetch('/api/reading/status', { headers: authHeaders() }).then(r => r.json()); setStatus(state)
    } catch (e) {
      setMessages(prev => prev.slice(0, -1)); setError(e instanceof Error ? e.message : '回答を取得できませんでした')
    } finally { setSending(false) }
  }

  async function openConversation(id: string) {
    track('reading_history_opened', { conversation_id: id })
    const body = await fetch(`/api/reading/conversations/${id}`, { headers: authHeaders() }).then(r => r.json())
    if (!body.messages) { setError(body.error ?? '鑑定履歴を開けませんでした'); return }
    setConversationId(id); setParams({ conversation: id }); setMessages(body.messages)
  }

  async function checkout() {
    track('checkout_started', { conversation_id: conversationId })
    const response = await fetch('/api/stripe/checkout', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ conversationId }) })
    const body = await response.json(); if (body.url) location.href = body.url; else setError(body.error ?? '決済ページを開けませんでした')
  }

  async function openPortal() {
    const response = await fetch('/api/stripe/portal', { method: 'POST', headers: authHeaders(), body: '{}' })
    const body = await response.json(); if (body.url) location.href = body.url; else setError(body.error ?? '契約管理画面を開けませんでした')
  }

  const lastMessage = messages[messages.length - 1]
  const suggestions = lastMessage?.role === 'assistant'
    ? [...lastMessage.content.matchAll(/次の質問：(.+)/g)].map(match => match[1].trim()).slice(0, 4)
    : pending?.suggestedQuestion ? [pending.suggestedQuestion] : ['仕事の流れを詳しく見る', '恋愛・結婚の流れを詳しく見る', '次の転換期を詳しく見る']

  if (isLoading) return <main className="min-h-screen bg-[#faf7ef]" />
  if (!user) return <main className="min-h-screen bg-[#faf7ef] text-[#211d18] px-5 py-16"><section className="max-w-xl mx-auto border border-[#d8c79e] bg-[#fffdf8] p-8 rounded-2xl"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><h1 className="font-serif text-2xl mt-4">鑑定結果について質問する</h1><p className="mt-5 leading-8 text-[#62594f]">鑑定結果と質問履歴を安全に保存するため、ログインまたは無料会員登録をお願いします。先ほどの鑑定内容はそのまま引き継がれます。</p><Link onClick={() => track('question_cta_clicked')} to="/auth?returnTo=%2Freading" className="block mt-7 bg-[#9a6d16] text-white text-center rounded-lg py-4">ログインして続ける</Link></section></main>

  return <main className="min-h-screen bg-[#faf7ef] text-[#211d18] px-4 py-10 font-serif"><div className="max-w-3xl mx-auto">
    <Link to="/" className="text-sm text-[#796a56]">← Fate Lab</Link>
    <header className="mt-7 border-b border-[#d8c79e] pb-7"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><h1 className="text-3xl mt-3">鑑定結果について質問する</h1><p className="mt-3 text-[#6d6257] leading-7">あなたの命式と9つの占術の計算結果をもとに、気になることをさらに読み解けます。</p>{status && <p className="mt-3 text-sm text-[#8a7557]">{status.premium ? '継続利用プランをご利用中' : `無料質問 残り${status.remaining}回`}</p>}{status?.premium && <button onClick={openPortal} className="mt-3 text-sm underline text-[#70531e]">契約内容・解約を確認する</button>}</header>
    {history.length > 0 && <details className="mt-6 border border-[#ded2bb] bg-[#fffdf8] rounded-xl p-4"><summary className="cursor-pointer font-semibold">鑑定履歴</summary><div className="grid gap-2 mt-3">{history.map(item => <button key={item.id} onClick={() => openConversation(item.id)} className="text-left border-t border-[#eee5d3] pt-3"><span className="block">{item.title}</span><small className="text-[#887b6b]">{new Date(item.updated_at).toLocaleDateString('ja-JP')}</small></button>)}</div></details>}
    <section className="py-8 space-y-5">{messages.length === 0 && <div className="border-l-2 border-[#bb9345] pl-5 leading-8 text-[#5f554a]">鑑定書で気になった部分を、そのまま質問できます。未来を断定せず、計算済みの結果から読み解きます。</div>}{messages.map((message, index) => <article key={index} className={message.role === 'user' ? 'ml-auto max-w-[85%] bg-[#ede4d2] p-4 rounded-xl' : 'mr-auto max-w-[92%] border border-[#ded2bb] bg-[#fffdf8] p-5 rounded-xl whitespace-pre-wrap leading-8'}>{message.content || '読み解いています…'}</article>)}<div ref={bottomRef} /></section>
    {suggestions.length > 0 && <div className="flex flex-wrap gap-2 mb-5">{suggestions.map(item => <button key={item} onClick={() => send(item)} className="border border-[#cbb88f] rounded-full px-4 py-2 text-sm bg-[#fffdf8]">{item}</button>)}</div>}
    {status?.remaining === 0 && !status.premium ? <section className="border border-[#c8aa6d] bg-[#fffaf0] p-6 rounded-2xl"><h2 className="text-xl">もう少し、深く読み解きますか。</h2><p className="mt-3 leading-7 text-[#685e53]">無料鑑定の続きとして、気になったことを何度でも質問できます。月額料金・自動更新・解約方法は決済画面と特定商取引法の表記で確認できます。</p>{monthlyPrice && <p className="mt-3 font-semibold text-[#70531e]">{monthlyPrice}（税込・自動更新）</p>}<button onClick={checkout} className="w-full mt-5 py-4 bg-[#9a6d16] text-white rounded-lg">鑑定を続ける</button></section> : <div className="sticky bottom-3 bg-[#fffdf8] border border-[#d8c79e] shadow-xl rounded-2xl p-3 flex gap-2"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} placeholder="鑑定結果について質問する…" className="flex-1 bg-transparent px-3 py-2 resize-none outline-none" rows={2} /><button onClick={() => send()} disabled={!input.trim() || sending} className="px-5 rounded-xl bg-[#9a6d16] text-white disabled:opacity-40">送信</button></div>}
    {error && <p className="text-red-700 mt-4">{error}</p>}<p className="text-xs text-[#827668] leading-6 mt-8">結果は将来を保証するものではありません。重要な意思決定はご自身で判断し、必要に応じて適切な専門家へご相談ください。</p>
  </div></main>
}
