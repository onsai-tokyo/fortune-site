import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type Message = { role: 'user' | 'assistant'; content: string; referenced_systems?: string[] }
type PendingReading = { birthData: Record<string, unknown>; calculatedData: Record<string, unknown>; reportText: string; sourceSection?: string; sourceYear?: number; suggestedQuestion?: string; savedAt?: number }
type HistoryItem = { id: string; title: string; source_section?: string; source_year?: number; updated_at: string }

declare global { interface Window { gtag?: (...args: unknown[]) => void } }
const track = (name: string, params: Record<string, unknown> = {}) => window.gtag?.('event', name, params)
const READING_API_FALLBACK = 'https://fortune-site-iuzo.onrender.com'

async function fetchReadingApi(path: string, init?: RequestInit) {
  let primary: Response | null = null
  try {
    primary = await fetch(path, init)
    if (primary.status < 500) return primary
  } catch { /* API中継に失敗した場合は直接接続へ切り替える */ }
  try { return await fetch(`${READING_API_FALLBACK}${path}`, init) }
  catch { if (primary) return primary; throw new Error('鑑定サーバーへ接続できませんでした') }
}

async function readingIdempotencyKey(pending: PendingReading) {
  const value = JSON.stringify({
    birthData: pending.birthData,
    sourceSection: pending.sourceSection ?? null,
    sourceYear: pending.sourceYear ?? null,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function contextualSuggestions(section?: string, year?: number) {
  if (year) return [`${year}年に仕事で起こりやすい変化は？`, `${year}年の恋愛・結婚の流れは？`, `${year - 1}年との違いは？`]
  if (section?.includes('恋愛') || section?.includes('結婚')) return ['惹かれやすい相手を詳しく見る', '関係が安定する条件は？', '結婚につながりやすい時期は？']
  if (section?.includes('仕事')) return ['向いている働き方を詳しく見る', '転職や独立に向く時期は？', '仕事で注意する癖は？']
  if (section?.includes('人間関係')) return ['長く付き合いやすい友人は？', '人間関係で疲れやすい場面は？', '距離の取り方を詳しく見る']
  return ['仕事の流れを詳しく見る', '恋愛・結婚の流れを詳しく見る', '次の転換期を詳しく見る']
}

function answerWithoutSuggestions(content: string) {
  return content
    .split('\n')
    .filter(line => !/^次の質問：/.test(line.trim()))
    .map(line => line
      .replace(/\*\*/g, '')
      .replace(/^#{1,6}\s*/, '')
      .replace(/^---+\s*$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type ReadingMode = 'start' | 'history' | 'chat'

export default function ReadingPage({ mode = 'start' }: { mode?: ReadingMode }) {
  const { user, session, isLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const routeParams = useParams<{ conversationId: string }>()
  const [params] = useSearchParams()
  const pending = useMemo<PendingReading | null>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('fate_reading_context') ?? 'null') as PendingReading | null
      if (!parsed) return null
      if (!parsed.savedAt || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('fate_reading_context')
        return null
      }
      return parsed
    } catch { return null }
  }, [])
  const conversationId = mode === 'chat' ? routeParams.conversationId ?? '' : ''
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<{ premium: boolean; remaining: number | null; limit: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [monthlyPrice, setMonthlyPrice] = useState('2,980円／月')
  const [activeContext, setActiveContext] = useState<{ sourceSection?: string; sourceYear?: number }>({ sourceSection: pending?.sourceSection, sourceYear: pending?.sourceYear })
  const [dataLoading, setDataLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const creatingRef = useRef(false)
  const createdRef = useRef(false)

  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    fetch('/api/stripe/plan').then(async response => response.ok ? response.json() : null).then(plan => {
      if (plan?.unitAmount != null) setMonthlyPrice(`${Number(plan.unitAmount).toLocaleString('ja-JP')}円／月`)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!session?.access_token || !user?.id) { setDataLoading(false); return }
    const userId = user.id
    void (async () => {
      try {
        if (mode === 'start') {
          if (!pending) { navigate('/reading/history', { replace: true }); return }
          if (creatingRef.current || createdRef.current) return
          creatingRef.current = true
          setDataLoading(true)
          localStorage.removeItem('fate_reading_context')
          const title = pending.sourceYear ? `${pending.sourceYear}年について` : `${pending.sourceSection ?? '鑑定結果'}について`
          const key = await readingIdempotencyKey(pending)
          let savedId = ''
          let apiFailure = ''
          try {
            const response = await fetchReadingApi('/api/reading/conversations', {
              method: 'POST',
              headers: { ...authHeaders(), 'Idempotency-Key': key },
              body: JSON.stringify({ title, ...pending }),
            })
            const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
            if (response.ok && typeof body.id === 'string') savedId = body.id
            else apiFailure = body.error ?? `HTTP ${response.status}`
          } catch (cause) {
            apiFailure = cause instanceof Error ? cause.message : '保存APIへ接続できませんでした'
          }

          // API設定が未完了のローカル環境でも、本人のRLS範囲内で同じキーを再利用して1件だけ保存する。
          if (!savedId) {
            const { data: existing, error: lookupError } = await supabase.from('reading_conversations')
              .select('id').contains('birth_data', { _fateReadingKey: key }).maybeSingle()
            if (lookupError) throw new Error(`保存先の確認に失敗しました: ${lookupError.message}`)
            if (existing?.id) savedId = existing.id
            else {
              const { data, error: directError } = await supabase.from('reading_conversations').insert({
                user_id: userId,
                title,
                birth_data: { ...pending.birthData, _fateReadingKey: key },
                calculated_data: pending.calculatedData,
                report_text: pending.reportText,
                source_section: pending.sourceSection?.slice(0, 80) ?? null,
                source_year: pending.sourceYear ?? null,
              }).select('id').single()
              if (directError || !data?.id) throw new Error(`保存API: ${apiFailure || '応答なし'}／保存先: ${directError?.message ?? '保存できませんでした'}`)
              savedId = data.id
            }
          }
          createdRef.current = true
          navigate(`/reading/${savedId}`, { replace: true })
          return
        }

        if (params.get('checkout') === 'success') { track('checkout_completed'); track('subscription_started') }
        try {
          const statusResponse = await fetchReadingApi('/api/reading/status', { headers: authHeaders() })
          if (statusResponse.ok) {
            let state = await statusResponse.json()
            if (params.get('checkout') === 'success' && !state.premium) {
              for (let attempt = 0; attempt < 5 && !state.premium; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 1200))
                const retry = await fetchReadingApi('/api/reading/status', { headers: authHeaders() })
                if (retry.ok) state = await retry.json()
              }
            }
            setStatus(state)
            const wasPremium = localStorage.getItem('fate_was_premium') === 'true'
            if (wasPremium && !state.premium) track('subscription_cancelled')
            localStorage.setItem('fate_was_premium', String(Boolean(state.premium)))
          }
        } catch { /* 履歴一覧は利用状況APIと独立して表示する */ }

        let historyBody: { conversations?: HistoryItem[] } = {}
        try {
          const historyResponse = await fetchReadingApi('/api/reading/conversations', { headers: authHeaders() })
          if (historyResponse.ok) {
            historyBody = await historyResponse.json()
          } else if (historyResponse.status >= 500) {
            const { data } = await supabase.from('reading_conversations')
              .select('id,title,source_section,source_year,created_at,updated_at')
              .eq('user_id', userId).order('updated_at', { ascending: false }).limit(100)
            historyBody = { conversations: data ?? [] }
          }
        } catch { /* ローカルプレビューでは空の一覧を表示する */ }
        setHistory(historyBody.conversations ?? [])

        if (mode === 'chat' && conversationId) {
          let body: { conversation?: Record<string, unknown>; messages?: Message[]; error?: string } | null = null
          try {
            const response = await fetchReadingApi(`/api/reading/conversations/${conversationId}`, { headers: authHeaders() })
            if (response.ok) body = await response.json()
          } catch { /* 本人のRLS範囲内で直接読み直す */ }

          if (!body?.messages) {
            const [{ data: conversation, error: conversationError }, { data: directMessages, error: messagesError }] = await Promise.all([
              supabase.from('reading_conversations').select('id,source_section,source_year').eq('id', conversationId).eq('user_id', userId).maybeSingle(),
              supabase.from('reading_messages').select('role,content,referenced_systems,created_at').eq('conversation_id', conversationId).eq('user_id', userId).order('created_at'),
            ])
            if (conversationError || messagesError || !conversation) {
              setError(conversationError?.message ?? messagesError?.message ?? '鑑定履歴を開けませんでした')
              return
            }
            body = { conversation, messages: (directMessages ?? []) as Message[] }
          }

          setMessages(body.messages ?? [])
          setActiveContext({
            sourceSection: typeof body.conversation?.source_section === 'string' ? body.conversation.source_section : undefined,
            sourceYear: typeof body.conversation?.source_year === 'number' ? body.conversation.source_year : undefined,
          })
          return
        }
      } catch (cause) {
        if (mode === 'start') {
          creatingRef.current = false
          if (pending) localStorage.setItem('fate_reading_context', JSON.stringify(pending))
          setError(cause instanceof Error ? cause.message : '鑑定結果を保存できませんでした')
        } else if (conversationId) setError('鑑定結果を読み込めませんでした。時間をおいて再度お試しください。')
      } finally {
        setDataLoading(false)
      }
    })()
  }, [session?.access_token, user?.id, retryCount, mode, conversationId, pending, navigate])

  async function send(question = input) {
    const text = question.trim()
    if (!text || !conversationId || sending || !session?.access_token) return
    setInput(''); setError(''); setSending(true)
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    track('question_sent', { conversation_id: conversationId })
    if (messages.filter(item => item.role === 'user').length === 1) track('second_question_sent', { conversation_id: conversationId })
    try {
      const response = await fetchReadingApi(`/api/reading/conversations/${conversationId}/questions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ question: text }) })
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
      const state = await fetchReadingApi('/api/reading/status', { headers: authHeaders() }).then(r => r.json()); setStatus(state)
    } catch (e) {
      setMessages(prev => prev.slice(0, -1)); setError(e instanceof Error ? e.message : '回答を取得できませんでした')
    } finally { setSending(false) }
  }

  async function openConversation(id: string) {
    track('reading_history_opened', { conversation_id: id })
    navigate(`/reading/${id}`)
  }

  async function renameConversation(item: HistoryItem) {
    const title = window.prompt('鑑定履歴の名前', item.title)?.trim()
    if (!title || title === item.title) return
    const response = await fetch(`/api/reading/conversations/${item.id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ title }) })
    const body = await response.json()
    if (!response.ok) { setError(body.error ?? '名前を変更できませんでした'); return }
    setHistory(prev => prev.map(entry => entry.id === item.id ? { ...entry, title: body.conversation.title, updated_at: body.conversation.updated_at } : entry))
  }

  async function deleteConversation(item: HistoryItem) {
    if (!window.confirm(`「${item.title}」を削除しますか？質問と回答も削除され、元に戻せません。`)) return
    const response = await fetch(`/api/reading/conversations/${item.id}`, { method: 'DELETE', headers: authHeaders() })
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error ?? '削除できませんでした'); return }
    setHistory(prev => prev.filter(entry => entry.id !== item.id))
    if (conversationId === item.id) navigate('/reading/history', { replace: true })
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
    : pending?.suggestedQuestion ? [pending.suggestedQuestion, ...contextualSuggestions(activeContext.sourceSection, activeContext.sourceYear)].slice(0, 4) : contextualSuggestions(activeContext.sourceSection, activeContext.sourceYear)

  if (isLoading) return <main className="min-h-screen bg-[#faf7ef]" />
  if (!user) {
    const returnTo = mode === 'start' ? '/reading/new' : mode === 'history' ? '/reading/history' : `/reading/${conversationId}`
    return <main className="min-h-screen bg-[#faf7ef] text-[#211d18] px-5 py-16 font-serif"><section className="max-w-xl mx-auto border border-[#d8c79e] bg-[#fffdf8] p-8 rounded-2xl shadow-[0_18px_50px_rgba(83,61,25,.08)]"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><h1 className="text-2xl mt-4">鑑定結果について質問する</h1><p className="mt-5 leading-8 text-[#62594f]">鑑定結果と質問履歴を安全に保存するため、無料登録またはログインをお願いします。先ほどの鑑定内容はそのまま引き継がれます。</p><div className="grid gap-3 mt-7"><Link onClick={() => track('question_cta_clicked', { action: 'register' })} to={`/auth?mode=register&returnTo=${encodeURIComponent(returnTo)}`} className="block bg-[#9a6d16] text-white text-center rounded-lg py-4">新規登録（無料）</Link><Link onClick={() => track('question_cta_clicked', { action: 'login' })} to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} className="block border border-[#bfa66e] bg-[#fffdf8] text-[#5f471c] text-center rounded-lg py-4">ログイン</Link></div></section></main>
  }

  if (mode === 'start' && pending && dataLoading) return <main className="min-h-screen bg-[#faf7ef] text-[#211d18] px-5 py-16 font-serif"><section className="max-w-xl mx-auto border border-[#d8c79e] bg-[#fffdf8] p-8 rounded-2xl shadow-[0_18px_50px_rgba(83,61,25,.08)]"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><h1 className="text-2xl mt-4">質問画面を準備しています</h1><p className="mt-5 leading-8 text-[#62594f]">先ほど選んだ「{pending.sourceSection ?? '鑑定結果'}」を引き継いでいます。完了すると、その内容についてすぐ質問できます。</p><div className="mt-7 h-px overflow-hidden bg-[#eadfc7]"><span className="block h-full w-1/2 animate-pulse bg-[#a77a22]" /></div></section></main>

  const historyList = history.length > 0 ? <div className="grid gap-3">{history.map(item => <div key={item.id} className={`border rounded-xl p-4 flex items-start gap-3 ${conversationId === item.id ? 'border-[#a77a22] bg-[#f5ead1]' : 'border-[#ded2bb] bg-[#fffdf8]'}`}><button onClick={() => openConversation(item.id)} className="text-left flex-1"><span className="block text-base leading-6">{item.title}</span><small className="text-[#887b6b]">{new Date(item.updated_at).toLocaleDateString('ja-JP')}・続きを見る</small></button><button onClick={() => renameConversation(item)} className="text-xs underline text-[#70531e] py-1">名前変更</button><button onClick={() => deleteConversation(item)} className="text-xs underline text-[#8b453b] py-1">削除</button></div>)}</div> : null

  if (mode === 'start' && pending && error) return <main className="min-h-screen bg-[#faf7ef] text-[#211d18] px-5 py-16 font-serif"><section className="max-w-xl mx-auto border border-[#d8c79e] bg-[#fffdf8] p-8 rounded-2xl shadow-[0_18px_50px_rgba(83,61,25,.08)]"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><h1 className="text-2xl mt-4">鑑定結果について質問する</h1><p className="mt-5 leading-8 text-[#62594f]">先ほどの鑑定結果を質問画面へ保存できませんでした。鑑定内容はブラウザに残っているため、下のボタンから保存を再実行できます。</p><p className="mt-4 text-sm text-[#8b453b] break-words">{error}</p><button onClick={() => { creatingRef.current = false; setError(''); setDataLoading(true); setRetryCount(value => value + 1) }} className="w-full mt-7 bg-[#9a6d16] text-white text-center rounded-lg py-4">保存を再実行する</button><a href="/lp.html#form" className="block mt-4 text-center underline text-[#70531e]">鑑定書へ戻る</a></section></main>

  if (mode === 'history') return <main className="min-h-screen bg-[#faf7ef] text-[#211d18] px-4 py-10 font-serif"><div className="max-w-3xl mx-auto"><a href="/lp.html" className="text-sm text-[#796a56]">← Fate Lab</a><header className="mt-7 border-b border-[#d8c79e] pb-7"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · READING LIBRARY</p><h1 className="text-3xl mt-3">鑑定履歴</h1><p className="mt-3 text-[#6d6257] leading-7">保存した鑑定を選ぶと、その結果について個別に質問できます。</p></header><section className="py-7">{error && <div className="mb-5 border border-[#c98775] bg-[#fff6f2] rounded-xl p-4 text-[#7f3427]">{error}<a href="/lp.html#form" className="block mt-3 underline">鑑定書へ戻ってもう一度試す</a></div>}{dataLoading ? <p className="text-[#827668]">鑑定履歴を確認しています…</p> : historyList ?? <div className="border border-[#ded2bb] bg-[#fffdf8] rounded-2xl p-7 text-center"><h2 className="text-xl">保存された鑑定はまだありません</h2><p className="mt-3 text-[#6d6257] leading-7">最初に無料鑑定を行うと、鑑定書がここへ保存され、結果について質問できるようになります。</p></div>}<a href="/lp.html#form" className="block mt-6 bg-[#9a6d16] text-white text-center rounded-lg py-4">新しく無料鑑定する</a></section><p className="text-xs text-[#827668] leading-6">結果は将来を保証するものではありません。重要な意思決定はご自身で判断してください。</p></div></main>

  if (mode === 'start') return <main className="min-h-screen bg-[#faf7ef]" />
  if (!conversationId) return <Navigate to="/reading/history" replace />

  return <main className="min-h-screen bg-[#faf7ef] text-[#211d18] px-4 py-8 font-serif"><div className="max-w-6xl mx-auto">
    <a href="/lp.html" className="text-sm text-[#796a56]">← Fate Lab</a>
    <div className="mt-6 grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
    <aside className="hidden lg:block lg:sticky lg:top-6 border-y border-[#cdbb91] bg-[#faf7ef] py-5"><p className="text-xs tracking-[.18em] text-[#9a762b]">READING RECORDS</p><h2 className="text-xl mt-2 mb-4">鑑定記録</h2>{dataLoading ? <p className="text-sm text-[#827668]">記録を確認しています…</p> : historyList ?? <p className="text-sm leading-6 text-[#827668]">続きを読み解くと、ここに記録されます。</p>}<a href="/lp.html#fortune-form" className="block mt-6 border-t border-[#d8c79e] pt-4 text-sm text-[#70531e]">＋ 新しく無料鑑定する</a></aside>
    <div className="min-w-0">
    <header className="mt-7 border-b border-[#bfa66e] pb-7"><div className="flex items-center justify-between gap-4"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><button onClick={() => void signOut()} className="text-xs underline text-[#796a56]">ログアウト</button></div><h1 className="text-3xl mt-3">鑑定書の続きを読む</h1><p className="mt-3 text-[#6d6257] leading-7">鑑定書で気になったことをお聞かせください。計算済みの結果に沿って、必要な部分を詳しく読み解きます。</p>{status && <p className="mt-4 text-sm text-[#8a7557]">{status.premium ? '継続鑑定をご利用中' : `無料であと${status.remaining}回、続きを読めます`}</p>}{status?.premium && <button onClick={openPortal} className="mt-3 text-sm underline text-[#70531e]">契約内容・解約を確認する</button>}</header>
    <section className="py-8">{messages.length === 0 && <div className="border-l-2 border-[#bb9345] pl-5 leading-8 text-[#5f554a]">仕事、恋愛、転換期など、鑑定書の中で特に知りたいことを一つ選んでください。</div>}{messages.map((message, index) => message.role === 'user' ? <article key={index} className="my-9 border-l border-[#a77a22] pl-5"><p className="text-[11px] tracking-[.18em] text-[#9a762b] mb-2">ご質問</p><p className="text-lg leading-8">{message.content}</p></article> : <article key={index} className="my-9 border-y border-[#ded2bb] py-6 whitespace-pre-wrap leading-8 text-[#4f473e]"><p className="text-[11px] tracking-[.18em] text-[#9a762b] mb-4">鑑定書からの読み解き</p>{message.content ? answerWithoutSuggestions(message.content) : 'ただいま読み解いています。少しお待ちください。'}</article>)}<div ref={bottomRef} /></section>
    {suggestions.length > 0 && <section className="mb-8 border-t border-[#d8c79e] pt-5"><p className="text-sm text-[#796a56] mb-3">続けて読み解けること</p><div className="grid sm:grid-cols-2 gap-x-8">{suggestions.map(item => <button key={item} onClick={() => send(item)} className="border-b border-[#e2d8c3] py-3 text-left text-sm text-[#5f471c] hover:text-[#9a6d16]">→ {item}</button>)}</div></section>}
    {status?.remaining === 0 && !status.premium ? <section className="border-y border-[#b9944c] bg-[#f8f0dc] px-5 py-7"><p className="text-xs tracking-[.18em] text-[#8c681e]">鑑定書の続き</p><h2 className="text-xl mt-2">この先も、必要なときに読み解けます。</h2><p className="mt-3 leading-7 text-[#685e53]">無料分の続きを読み終えました。継続鑑定では、保存した鑑定書について回数を気にせず質問できます。</p><p className="mt-4 font-semibold text-lg text-[#70531e]">月額 {monthlyPrice.replace('／月', '')}（税込・自動更新）</p><button onClick={checkout} className="w-full mt-5 py-4 bg-[#8b641a] text-white">継続鑑定を申し込む</button></section> : <section className="sticky bottom-0 border-t border-[#bfa66e] bg-[#faf7ef]/95 py-4 backdrop-blur-sm"><label className="block text-xs tracking-[.14em] text-[#8c681e] mb-2" htmlFor="reading-question">鑑定書で、もう少し知りたいこと</label><div className="flex gap-3"><textarea id="reading-question" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} placeholder="例：仕事が動きやすい時期を詳しく知りたい" className="flex-1 border border-[#cdbb91] bg-[#fffdf8] px-4 py-3 resize-none outline-none focus:border-[#9a762b]" rows={2} /><button onClick={() => send()} disabled={!input.trim() || sending} className="self-stretch px-6 bg-[#8b641a] text-white disabled:opacity-40">読み解く</button></div></section>}
    {error && <p className="text-red-700 mt-4">{error}</p>}<p className="text-xs text-[#827668] leading-6 mt-8">結果は将来を保証するものではありません。重要な意思決定はご自身で判断し、必要に応じて適切な専門家へご相談ください。</p>
    </div></div>
  </div></main>
}
