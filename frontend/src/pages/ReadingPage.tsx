import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type ProfileTrait = { id: string; source_message_id?: string; category: string; text: string; status: 'pending' | 'approved' | 'rejected' }
type Message = { id?: string; role: 'user' | 'assistant'; content: string; referenced_systems?: string[]; traits?: ProfileTrait[] }
type PendingReading = { birthData: Record<string, unknown>; calculatedData: Record<string, unknown>; reportText: string; sourceSection?: string; sourceYear?: number; suggestedQuestion?: string; savedAt?: number }
type HistoryItem = { id: string; secret_token?: string; title: string; source_section?: string; source_year?: number; updated_at: string }

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

const kanjiNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const readingSections = ['要約', '共通して現れた本質', '仕事', '恋愛・結婚', '人間関係', '時期', '命式・計算データ']

function formatAnswer(content: string) {
  const cleaned = answerWithoutSuggestions(content)
  const lines = cleaned.split('\n')
  const nodes: ReactNode[] = []
  let list: string[] = []
  const flushList = () => {
    if (!list.length) return
    nodes.push(<ul key={`list-${nodes.length}`} className="reading-answer-list">{list.map((item, index) => <li key={index}>{item}</li>)}</ul>)
    list = []
  }
  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line) { flushList(); return }
    if (/^[-・]\s*/.test(line)) { list.push(line.replace(/^[-・]\s*/, '')); return }
    flushList()
    const bracketHeading = line.match(/^【(.+)】$/)
    const plainHeading = /^(結論|読み解き|気をつけたいこと)[：:]?$/.test(line)
    if (bracketHeading || plainHeading) {
      nodes.push(<h3 key={index} className="reading-answer-heading">{bracketHeading?.[1] ?? line.replace(/[：:]$/, '')}</h3>)
    } else {
      nodes.push(<p key={index} className="reading-answer-paragraph">{line}</p>)
    }
  })
  flushList()
  return nodes
}

type ReadingMode = 'start' | 'history' | 'chat'

export default function ReadingPage({ mode = 'start', identifier = 'token' }: { mode?: ReadingMode; identifier?: 'token' | 'id' }) {
  const { user, session, isLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const routeParams = useParams<{ secretToken?: string; conversationId?: string }>()
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
  const routeIdentifier = mode === 'chat' ? (routeParams.secretToken ?? routeParams.conversationId ?? '') : ''
  const [conversationId, setConversationId] = useState(identifier === 'id' ? routeIdentifier : '')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<{ premium: boolean; remaining: number | null; limit: number; approvedCount?: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [monthlyPrice, setMonthlyPrice] = useState('2,980円／月')
  const [showPaywall, setShowPaywall] = useState(false)
  const [checkoutComplete, setCheckoutComplete] = useState(params.get('checkout') === 'success')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [shareNotice, setShareNotice] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [activeContext, setActiveContext] = useState<{ sourceSection?: string; sourceYear?: number }>({ sourceSection: pending?.sourceSection, sourceYear: pending?.sourceYear })
  const [dataLoading, setDataLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const creatingRef = useRef(false)
  const createdRef = useRef(false)

  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (mode !== 'chat') return
    const existing = document.querySelector('meta[name="robots"]')
    const previous = existing?.getAttribute('content')
    const meta = existing ?? document.head.appendChild(document.createElement('meta'))
    meta.setAttribute('name', 'robots')
    meta.setAttribute('content', 'noindex, nofollow')
    return () => {
      if (previous) meta.setAttribute('content', previous)
      else if (!existing) meta.remove()
    }
  }, [mode])
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileNavOpen])
  useEffect(() => {
    fetch('/api/stripe/plan').then(async response => response.ok ? response.json() : null).then(plan => {
      if (plan?.unitAmount != null) setMonthlyPrice(`${Number(plan.unitAmount).toLocaleString('ja-JP')}円／月`)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!session?.access_token || !user?.id) { setDataLoading(false); return }
    // StrictMode で同じ effect が続けて実行された場合、2回目の async 処理を
    // 起動すると finally だけが先に走り、保存中の画面を解除してしまう。
    // 非同期処理へ入る前に終了させ、最初の保存処理だけに画面状態を管理させる。
    if (mode === 'start' && (creatingRef.current || createdRef.current)) return
    const userId = user.id
    void (async () => {
      try {
        if (mode === 'start') {
          if (!pending) { navigate('/reading/history', { replace: true }); return }
          creatingRef.current = true
          setDataLoading(true)
          const title = pending.sourceYear ? `${pending.sourceYear}年について` : `${pending.sourceSection ?? '鑑定結果'}について`
          const key = await readingIdempotencyKey(pending)
          let savedId = ''
          let savedToken = ''
          let apiFailure = ''
          try {
            const response = await fetchReadingApi('/api/reading/conversations', {
              method: 'POST',
              headers: { ...authHeaders(), 'Idempotency-Key': key },
              body: JSON.stringify({ title, ...pending }),
            })
            const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
            if (response.ok && typeof body.id === 'string') {
              savedId = body.id
              savedToken = typeof body.token === 'string' ? body.token : ''
            }
            else apiFailure = body.error ?? `HTTP ${response.status}`
          } catch (cause) {
            apiFailure = cause instanceof Error ? cause.message : '保存APIへ接続できませんでした'
          }

          // API設定が未完了のローカル環境でも、本人のRLS範囲内で同じキーを再利用して1件だけ保存する。
          if (!savedId) {
            const { data: existing, error: lookupError } = await supabase.from('reading_conversations')
              .select('id,secret_token').contains('birth_data', { _fateReadingKey: key }).maybeSingle()
            if (lookupError) throw new Error(`保存先の確認に失敗しました: ${lookupError.message}`)
            if (existing?.id) { savedId = existing.id; savedToken = existing.secret_token ?? '' }
            else {
              const { data, error: directError } = await supabase.from('reading_conversations').insert({
                user_id: userId,
                title,
                birth_data: { ...pending.birthData, _fateReadingKey: key },
                calculated_data: pending.calculatedData,
                report_text: pending.reportText,
                source_section: pending.sourceSection?.slice(0, 80) ?? null,
                source_year: pending.sourceYear ?? null,
              }).select('id,secret_token').single()
              if (directError || !data?.id) throw new Error(`保存API: ${apiFailure || '応答なし'}／保存先: ${directError?.message ?? '保存できませんでした'}`)
              savedId = data.id
              savedToken = data.secret_token ?? ''
            }
          }
          createdRef.current = true
          // 認証状態の再描画や StrictMode の再実行が起きても鑑定内容を失わないよう、
          // 保存が完了するまでは引き継ぎデータを残しておく。
          localStorage.removeItem('fate_reading_context')
          navigate(savedToken ? `/r/${savedToken}` : `/reading/${savedId}`, { replace: true })
          return
        }

        if (params.get('checkout') === 'success') {
          track('checkout_completed'); track('subscription_started')
          const savedQuestion = localStorage.getItem('fate_pending_question')
          if (savedQuestion) setInput(savedQuestion)
          setCheckoutComplete(true)
          window.history.replaceState({}, '', window.location.pathname)
        }
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
              .select('id,secret_token,title,source_section,source_year,created_at,updated_at')
              .eq('user_id', userId).order('updated_at', { ascending: false }).limit(100)
            historyBody = { conversations: data ?? [] }
          }
        } catch { /* ローカルプレビューでは空の一覧を表示する */ }
        setHistory(historyBody.conversations ?? [])

        if (mode === 'chat' && routeIdentifier) {
          let body: { conversation?: Record<string, unknown>; messages?: Message[]; traits?: ProfileTrait[]; error?: string } | null = null
          try {
            const endpoint = identifier === 'token'
              ? `/api/reading/reports/${encodeURIComponent(routeIdentifier)}`
              : `/api/reading/conversations/${encodeURIComponent(routeIdentifier)}`
            const response = await fetchReadingApi(endpoint, { headers: authHeaders() })
            if (response.ok) body = await response.json()
          } catch { /* 本人のRLS範囲内で直接読み直す */ }

          if (!body?.messages) {
            const conversationFilter = identifier === 'token' ? 'secret_token' : 'id'
            const { data: conversation, error: conversationError } = await supabase.from('reading_conversations')
              .select('id,secret_token,source_section,source_year').eq(conversationFilter, routeIdentifier).eq('user_id', userId).maybeSingle()
            if (conversationError || !conversation) {
              setError(conversationError?.message ?? '鑑定履歴を開けませんでした')
              return
            }
            const { data: directMessages, error: directMessagesError } = await supabase.from('reading_messages')
              .select('id,role,content,referenced_systems,created_at').eq('conversation_id', conversation.id).eq('user_id', userId).order('created_at')
            if (directMessagesError) { setError(directMessagesError.message); return }
            const { data: directTraits } = await supabase.from('profile_traits')
              .select('id,source_message_id,category,text,status').eq('conversation_id', conversation.id).eq('user_id', userId).order('created_at')
            body = { conversation, messages: (directMessages ?? []) as Message[], traits: (directTraits ?? []) as ProfileTrait[] }
          }

          if (typeof body.conversation?.id === 'string') setConversationId(body.conversation.id)
          setMessages((body.messages ?? []).map(message => ({
            ...message, traits: (body?.traits ?? []).filter(trait => trait.source_message_id === message.id),
          })))
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
  }, [session?.access_token, user?.id, retryCount, mode, routeIdentifier, identifier, pending, navigate])

  async function send(question = input) {
    const text = question.trim()
    if (!text || !conversationId || sending || !session?.access_token) return
    if (status?.remaining === 0 && !status.premium) {
      localStorage.setItem('fate_pending_question', text)
      setShowPaywall(true)
      track('free_limit_reached'); track('paywall_viewed')
      return
    }
    setInput(''); setError(''); setSending(true)
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    track('question_sent', { conversation_id: conversationId })
    if (messages.filter(item => item.role === 'user').length === 1) track('second_question_sent', { conversation_id: conversationId })
    try {
      const response = await fetchReadingApi(`/api/reading/conversations/${conversationId}/questions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ question: text }) })
      if (response.status === 402) {
        setMessages(prev => prev.slice(0, -2)); setInput(text); localStorage.setItem('fate_pending_question', text); setShowPaywall(true); setStatus(prev => prev ? { ...prev, remaining: 0 } : prev)
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
          if (Array.isArray(part.meta?.traits) && part.meta.traits.length) {
            setMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], traits: part.meta.traits }])
          }
          if (part.delta?.text) { answer += part.delta.text; setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: answer }]) }
        }
      }
      if (!answer.trim()) throw new Error('回答を取得できませんでした')
      localStorage.removeItem('fate_pending_question')
      const state = await fetchReadingApi('/api/reading/status', { headers: authHeaders() }).then(r => r.json()); setStatus(state)
    } catch (e) {
      setMessages(prev => prev.slice(0, -1)); setError(e instanceof Error ? e.message : '回答を取得できませんでした')
    } finally { setSending(false) }
  }

  async function openConversation(id: string) {
    track('reading_history_opened', { conversation_id: id })
    const item = history.find(entry => entry.id === id)
    navigate(item?.secret_token ? `/r/${item.secret_token}` : `/reading/${id}`)
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
    if (input.trim()) localStorage.setItem('fate_pending_question', input.trim())
    track('checkout_started', { conversation_id: conversationId })
    const response = await fetch('/api/stripe/checkout', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ conversationId }) })
    const body = await response.json(); if (body.url) location.href = body.url; else setError(body.error ?? '決済ページを開けませんでした')
  }

  async function openPortal() {
    const response = await fetch('/api/stripe/portal', { method: 'POST', headers: authHeaders(), body: '{}' })
    const body = await response.json(); if (body.url) location.href = body.url; else setError(body.error ?? '契約管理画面を開けませんでした')
  }

  async function shareSummary() {
    if (!session?.access_token || identifier !== 'token' || !routeIdentifier) return
    setShareNotice('共有ページを準備しています…')
    const response = await fetchReadingApi(`/api/reading/reports/${encodeURIComponent(routeIdentifier)}/share`, {
      method: 'POST', headers: authHeaders(), body: '{}',
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.shareId) { setShareNotice(body.error ?? '共有リンクを作成できませんでした'); return }
    const url = `${window.location.origin}/s/${body.shareId}`
    try { await navigator.clipboard.writeText(url); setShareNotice('共有リンクをコピーしました。生年月日・出生地は含まれません。') }
    catch { setShareNotice(url) }
  }

  async function answerTrait(trait: ProfileTrait, statusValue: 'approved' | 'rejected') {
    const response = await fetchReadingApi(`/api/reading/profile/traits/${trait.id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: statusValue }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { setError(body.error ?? '回答を保存できませんでした'); return }
    setMessages(previous => previous.map(message => ({
      ...message, traits: message.traits?.map(item => item.id === trait.id ? { ...item, status: statusValue } : item),
    })))
    if (statusValue === 'approved') {
      setStatus(previous => previous ? { ...previous, approvedCount: body.approvedCount } : previous)
      setProfileNotice(`保存しました${body.approvedCount ? `（${body.approvedCount}件目）` : ''}`)
    }
    else setProfileNotice('「違う」を反映しました。似た内容は次から出しません。')
  }

  const lastMessage = messages[messages.length - 1]
  const suggestions = lastMessage?.role === 'assistant'
    ? [...lastMessage.content.matchAll(/次の質問：(.+)/g)].map(match => match[1].trim()).slice(0, 4)
    : pending?.suggestedQuestion ? [pending.suggestedQuestion, ...contextualSuggestions(activeContext.sourceSection, activeContext.sourceYear)].slice(0, 4) : contextualSuggestions(activeContext.sourceSection, activeContext.sourceYear)
  const userQuestions = messages.filter(message => message.role === 'user')
  const sourceLabel = activeContext.sourceYear ? `${activeContext.sourceYear}年` : activeContext.sourceSection ?? '鑑定結果'
  const backToReport = () => {
    if (window.history.length > 1) window.history.back()
    else window.location.href = '/lp.html#fortune-form'
  }

  const readingNavigation = (mobile = false) => <div className={mobile ? 'p-5' : 'p-4 pt-5'}>
    <p className="sidebar-label whitespace-nowrap text-xs tracking-[.18em] text-[#9a762b]">FATE LAB</p>
    <div className="mt-4 border-t border-[#d8c79e] pt-4">
      <button onClick={backToReport} className="sidebar-heading text-lg text-left w-full">■ 鑑定書</button>
      <nav className="mt-3 grid gap-1.5 pl-4 text-sm text-[#5c5349]">
        {readingSections.map(section => <button key={section} onClick={() => { setMobileNavOpen(false); backToReport() }} className="text-left py-1">{section}</button>)}
      </nav>
    </div>
    <div className="mt-5 border-t border-[#d8c79e] pt-4">
      <h2 className="sidebar-heading text-lg">質問履歴{userQuestions.length ? `（${userQuestions.length}）` : ''}</h2>
      {userQuestions.length ? <ol className="mt-3 grid gap-2 text-sm text-[#5c5349]">{userQuestions.map((message, index) => <li key={index} className="line-clamp-2"><span className="mr-2 text-[#9a762b]">{kanjiNumbers[index] ?? index + 1}</span>{message.content}</li>)}</ol> : <p className="mt-2 text-sm leading-6 text-[#5c5349]">質問すると、ここに記録されます。</p>}
    </div>
    <Link to="/me" className="mt-5 block border-t border-[#d8c79e] pt-4 text-sm text-[#70531e]">あなたについてわかってきたこと →</Link>
    <a href="/lp.html#fortune-form" className="block mt-5 border border-[#bfa66e] rounded-lg py-3 text-center text-sm text-[#70531e]">新しく鑑定する</a>
  </div>

  if (isLoading) return <main className="min-h-screen bg-[#faf7ef]" />
  if (!user) {
    const returnTo = mode === 'start' ? '/reading/new' : mode === 'history' ? '/reading/history' : identifier === 'token' ? `/r/${routeIdentifier}` : `/reading/${routeIdentifier}`
    return <main className="reading-page min-h-screen bg-[#faf7ef] text-[#211d18] px-5 py-16"><section className="max-w-xl mx-auto border border-[#d8c79e] bg-[#fffdf8] p-8 rounded-2xl shadow-[0_18px_50px_rgba(83,61,25,.08)]"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><h1 className="text-2xl mt-4">鑑定結果について質問する</h1><p className="mt-5 leading-8 text-[#62594f]">鑑定結果と質問履歴を安全に保存するため、無料登録またはログインをお願いします。先ほどの鑑定内容はそのまま引き継がれます。</p><div className="grid gap-3 mt-7"><Link onClick={() => track('question_cta_clicked', { action: 'register' })} to={`/auth?mode=register&returnTo=${encodeURIComponent(returnTo)}`} className="block bg-[#9a6d16] text-white text-center rounded-lg py-4">新規登録（無料）</Link><Link onClick={() => track('question_cta_clicked', { action: 'login' })} to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} className="block border border-[#bfa66e] bg-[#fffdf8] text-[#5f471c] text-center rounded-lg py-4">ログイン</Link></div></section></main>
  }

  if (mode === 'start' && pending && dataLoading) return <main className="reading-page min-h-screen bg-[#faf7ef] text-[#211d18] px-5 py-16"><section className="max-w-xl mx-auto border border-[#d8c79e] bg-[#fffdf8] p-8 rounded-2xl shadow-[0_18px_50px_rgba(83,61,25,.08)]"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><h1 className="text-2xl mt-4">質問画面を準備しています</h1><p className="mt-5 leading-8 text-[#62594f]">先ほど選んだ「{pending.sourceSection ?? '鑑定結果'}」を引き継いでいます。完了すると、その内容についてすぐ質問できます。</p><div className="mt-7 h-px overflow-hidden bg-[#eadfc7]"><span className="block h-full w-1/2 animate-pulse bg-[#a77a22]" /></div></section></main>

  const historyList = history.length > 0 ? <div className="grid gap-3">{history.map(item => { const updated = new Date(item.updated_at); return <article key={item.id} className={`border rounded-xl p-5 ${conversationId === item.id ? 'border-[#a77a22] bg-[#f5ead1]' : 'border-[#ded2bb] bg-[#fffdf8]'}`}><div className="flex items-start justify-between gap-4"><div><h3 className="text-base leading-7">{item.title}</h3><p className="mt-1 text-xs text-[#887b6b]">{updated.toLocaleDateString('ja-JP')} {updated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新</p></div><details className="relative"><summary aria-label="鑑定書の操作" className="cursor-pointer list-none rounded-lg border border-[#ded2bb] px-3 py-1 text-[#70531e]">⋮</summary><div className="absolute right-0 z-10 mt-2 w-32 rounded-lg border border-[#ded2bb] bg-[#fffdf8] p-2 shadow-lg"><button onClick={() => renameConversation(item)} className="block w-full rounded px-3 py-2 text-left text-xs text-[#70531e]">名前を変更</button><button onClick={() => deleteConversation(item)} className="block w-full rounded px-3 py-2 text-left text-xs text-[#8b453b]">削除</button></div></details></div><button onClick={() => openConversation(item.id)} className="mt-4 w-full rounded-lg border border-[#bfa66e] py-3 text-sm text-[#70531e]">この鑑定書を開く</button></article> })}</div> : null

  if (mode === 'start' && pending && error) return <main className="reading-page min-h-screen bg-[#faf7ef] text-[#211d18] px-5 py-16"><section className="max-w-xl mx-auto border border-[#d8c79e] bg-[#fffdf8] p-8 rounded-2xl shadow-[0_18px_50px_rgba(83,61,25,.08)]"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><h1 className="text-2xl mt-4">鑑定結果について質問する</h1><p className="mt-5 leading-8 text-[#62594f]">先ほどの鑑定結果を質問画面へ保存できませんでした。鑑定内容はブラウザに残っているため、下のボタンから保存を再実行できます。</p><p className="mt-4 text-sm text-[#8b453b] break-words">{error}</p><button onClick={() => { creatingRef.current = false; setError(''); setDataLoading(true); setRetryCount(value => value + 1) }} className="w-full mt-7 bg-[#9a6d16] text-white text-center rounded-lg py-4">保存を再実行する</button><a href="/lp.html#form" className="block mt-4 text-center underline text-[#70531e]">鑑定書へ戻る</a></section></main>

  if (mode === 'history') return <main className="reading-page min-h-screen bg-[#faf7ef] text-[#211d18] px-4 py-10"><div className="max-w-3xl mx-auto"><a href="/lp.html" className="text-sm text-[#5c5349]">← Fate Lab</a><header className="mt-7 border-b border-[#d8c79e] pb-7"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · READING LIBRARY</p><div className="flex items-end justify-between gap-4"><h1 className="text-3xl mt-3">鑑定書一覧</h1><Link to="/me" className="text-sm text-[#70531e]">あなたについて →</Link></div><p className="mt-3 text-[#5c5349] leading-7">これまでに作成した鑑定書の一覧です。選ぶと、その鑑定書と質問を開けます。</p></header><section className="py-7">{error && <div className="mb-5 border border-[#c98775] bg-[#fff6f2] rounded-xl p-4 text-[#7f3427]">{error}<a href="/lp.html#form" className="block mt-3 underline">鑑定書へ戻ってもう一度試す</a></div>}{dataLoading ? <p className="text-[#5c5349]">鑑定書を確認しています…</p> : historyList ?? <div className="border border-[#ded2bb] bg-[#fffdf8] rounded-2xl p-7 text-center"><h2 className="text-xl">保存された鑑定書はまだありません</h2><p className="mt-3 text-[#5c5349] leading-7">最初に無料鑑定を行うと、鑑定書がここへ保存され、結果について質問できるようになります。</p></div>}<a href="/lp.html#form" className="block mt-6 bg-[#9a6d16] text-white text-center rounded-lg py-4">新しく鑑定する</a></section><p className="text-xs text-[#5c5349] leading-6">結果は将来を保証するものではありません。重要な意思決定はご自身で判断してください。</p></div></main>

  if (mode === 'start') return <Navigate to="/reading/history" replace />
  if (!routeIdentifier) return <Navigate to="/reading/history" replace />

  return <main className="reading-page min-h-screen bg-[#faf7ef] text-[#211d18] px-4 py-8"><div className="max-w-6xl mx-auto">
    <div className="flex items-center justify-between gap-4"><button onClick={backToReport} className="text-sm text-[#5c5349]">← 鑑定書に戻る</button><div className="flex gap-2"><button onClick={() => void shareSummary()} className="border border-[#bfa66e] rounded-lg px-4 py-2 text-sm text-[#70531e]">要点を共有</button><button onClick={() => setMobileNavOpen(true)} className="lg:hidden border border-[#bfa66e] rounded-lg px-4 py-2 text-sm text-[#70531e]">履歴</button></div></div>
    {shareNotice && <p className="mt-3 text-xs text-[#70531e] break-all">{shareNotice}</p>}
    {profileNotice && <Link to="/me" className="mt-3 block rounded-lg border border-[#d8c79e] bg-[#f7f2e6] px-4 py-3 text-sm text-[#70531e]">{profileNotice}　あなたのページを見る →</Link>}
    <p className="mt-3 text-xs text-[#7a7065]">鑑定書 › {sourceLabel} › 質問</p>
    <div className="mt-6 grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
    <aside className="hidden lg:block lg:sticky lg:top-6 border border-[#d8c79e] bg-[#fffdf8] rounded-2xl shadow-[0_12px_35px_rgba(83,61,25,.06)]">{readingNavigation()}</aside>
    <div className="w-full min-w-0">
    {checkoutComplete && <div className="mb-6 border-l-4 border-[#9a6d16] bg-[#f3eedf] px-4 py-4"><div className="flex items-start justify-between gap-4"><p className="text-sm leading-7 text-[#211d18]">継続鑑定のお手続きが完了しました。回数の制限なくお読みいただけます。</p><button onClick={() => setCheckoutComplete(false)} aria-label="お知らせを閉じる" className="text-[#70531e]">×</button></div></div>}
    <header className="mt-7 border-b border-[#d8c79e] pb-7"><div className="flex items-center justify-between gap-4"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · PERSONAL READING</p><button onClick={() => void signOut()} className="text-xs underline text-[#5c5349]">ログアウト</button></div><h1 className="text-3xl mt-3">鑑定結果について質問する</h1><p className="mt-3 text-[#5c5349] leading-7">あなたの命式と9つの占術の計算結果をもとに、気になることをさらに読み解けます。</p>{status && <p className="mt-3 text-sm text-[#5c5349]">{status.premium ? '継続鑑定をご利用中です。回数の制限なくお読みいただけます。' : status.remaining && status.remaining > 0 ? `無料でお読みいただける残り：${status.remaining}回` : '無料分をご利用いただきました'}</p>}{status?.premium && <button onClick={openPortal} className="mt-3 text-sm underline text-[#70531e]">契約内容・解約を確認する</button>}</header>
    <section className="py-8 space-y-5">
      {messages.length === 0 && <div className="border-l-2 border-[#bb9345] pl-5 leading-8 text-[#5c5349]">鑑定書で気になった部分を、そのまま質問できます。未来を断定せず、計算済みの結果から読み解きます。</div>}
      {messages.map((message, index) => {
        const answerNumber = messages.slice(0, index + 1).filter(item => item.role === 'assistant').length
        if (message.role === 'user') return <div key={index} className="ml-auto max-w-[85%]"><p className="mb-1 text-right text-[11px] text-[#887b6b]">お尋ね</p><article className="bg-[#ede4d2] p-4 rounded-xl">{message.content}</article></div>
        return <div key={index} className="mr-auto max-w-[92%]">
          <article className="reading-answer overflow-hidden rounded-xl border border-[#ded2bb] bg-[#fffdf8]"><header className="border-b border-[#d8c79e] bg-[#f7f2e6] px-5 py-3"><span className="mr-3 text-[#9a762b]">{kanjiNumbers[answerNumber - 1] ?? answerNumber}</span>{sourceLabel}について</header><div className="p-5">{message.content ? formatAnswer(message.content) : '読み解いています…'}</div>{message.content && <footer className="border-t border-[#eee4d0] px-5 py-3 text-right"><button onClick={backToReport} className="text-xs text-[#70531e]">この内容の元になった箇所を読む → {sourceLabel}</button></footer>}</article>
          {message.traits?.map(trait => <section key={trait.id} className="mt-5 rounded-xl border border-[#d8c79e] bg-[#fffdf8] p-5">
            <h3 className="text-[15px] text-[#5c5349]">今回わかった あなたのこと</h3>
            <div className="mt-3 border-t border-[#e6dcc7] pt-4 font-sans text-base leading-8 text-[#211d18]">{trait.text}</div>
            {trait.status === 'pending' ? <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => void answerTrait(trait, 'approved')} className="rounded-lg border border-[#a77a22] px-3 py-3 text-sm text-[#70531e]">合っている</button><button onClick={() => void answerTrait(trait, 'rejected')} className="rounded-lg border border-[#cfc8bb] px-3 py-3 text-sm text-[#62594f]">違う</button></div> : <p className="mt-4 text-sm text-[#7a7065]">{trait.status === 'approved' ? 'あなたのページに保存しました' : 'この内容は次から出しません'}</p>}
            <p className="mt-3 text-xs leading-6 text-[#7a7065]">「違う」を選ぶと、似た内容は次から出しません</p>
          </section>)}
        </div>
      })}
      <div ref={bottomRef} />
    </section>
    {suggestions.length > 0 && <div className="mb-5 border-y border-[#d8c79e] py-4"><h2 className="text-base mb-2">続けて読み解く</h2><div className="grid">{suggestions.map(item => <button key={item} onClick={() => send(item)} className="text-left border-t first:border-t-0 border-[#e6dcc7] py-3 text-sm text-[#70531e]">・{item}</button>)}</div></div>}
    {status?.remaining === 1 && !status.premium && <p className="mb-3 text-sm text-[#5c5349]">残り1回です。継続プランでは回数の制限なくお読みいただけます。</p>}
    <div className="sticky bottom-3 bg-[#fffdf8] border border-[#d8c79e] shadow-xl rounded-2xl p-3 flex gap-2"><textarea value={input} onChange={e => { setInput(e.target.value); if (showPaywall) setShowPaywall(false) }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} placeholder={`「${sourceLabel}」について質問する…`} className="flex-1 bg-transparent px-3 py-2 resize-none outline-none" rows={2} /><button onClick={() => send()} disabled={!input.trim() || sending} className="px-5 rounded-xl bg-[#9a6d16] text-white disabled:opacity-40">読み解く</button></div>
    {showPaywall && status?.remaining === 0 && !status.premium && <section className="mt-4 border border-[#c8aa6d] bg-[#fffaf0] p-6 rounded-2xl shadow-[0_12px_30px_rgba(112,83,30,.12)]"><p className="text-sm text-[#5c5349]">お書きになった質問</p><blockquote className="mt-2 border-l-2 border-[#bfa66e] pl-4 text-[#211d18]">「{input.trim()}」</blockquote><div className="mt-5 border-t border-[#d8c79e] pt-5"><p className="text-xs tracking-[.18em] text-[#8c681e]">FATE LAB 継続鑑定</p>{Boolean(status.approvedCount) && <p className="mt-3 text-sm text-[#70531e]">あなたについてわかってきたこと：{status.approvedCount}</p>}<h2 className="text-xl mt-2">この続きは、継続鑑定でお読みいただけます。</h2><ul className="mt-4 list-disc pl-5 leading-8 text-[#5c5349]"><li>保存した鑑定書をもとに、回数の制限なく質問できます</li><li>これまでの質問と回答は、いつでも読み返せます</li></ul><p className="mt-3 font-semibold text-lg text-[#70531e]">{monthlyPrice}（税込・自動更新）</p><p className="mt-1 text-sm text-[#5c5349]">いつでも解約できます。</p><button onClick={checkout} className="w-full mt-5 py-4 bg-[#9a6d16] text-white rounded-lg">鑑定を続ける</button><p className="mt-3 text-center text-xs text-[#887b6b]">お支払いはStripeを通じて行われます。</p></div></section>}
    {error && <p className="text-red-700 mt-4">{error}</p>}<p className="text-xs text-[#5c5349] leading-6 mt-8">結果は将来を保証するものではありません。重要な意思決定はご自身で判断し、必要に応じて適切な専門家へご相談ください。</p>
    </div></div>
    {mobileNavOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="履歴を閉じる" onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-black/30" /><aside className="absolute right-0 top-0 h-full w-[86%] max-w-[320px] overflow-y-auto bg-[#fffdf8] shadow-2xl"><div className="flex justify-end p-3"><button onClick={() => setMobileNavOpen(false)} className="px-3 py-2 text-sm text-[#5c5349]">閉じる ×</button></div>{readingNavigation(true)}</aside></div>}
  </div></main>
}
