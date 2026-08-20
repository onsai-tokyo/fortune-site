import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { saveAnalysis, saveChatMessages, getAnalyses, type AnalysisRecord } from '../lib/history'
import { getArchetype, getSukuyoDetail } from '../lib/archetype'
import { calculateFortuneData } from '../lib/api'

interface CalcData {
  shichuYear: string; shichuMonth: string; shichuDay: string; shichuHour: string | null
  nayin: string; sanmeiStar: string; chusatsu: string; sukuyo: string
  lifePathNumber: number; honmeiName: string; archetype: string; sukuyoDetail: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const YEARS   = Array.from({ length: 107 }, (_, i) => 2026 - i)
const MONTHS  = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS    = Array.from({ length: 31 }, (_, i) => i + 1)
const HOURS   = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function groupSessions(sessions: AnalysisRecord[]) {
  const now = new Date()
  const groups: { label: string; items: AnalysisRecord[] }[] = [
    { label: '今日', items: [] },
    { label: '昨日', items: [] },
    { label: '過去7日間', items: [] },
    { label: '過去30日間', items: [] },
    { label: 'それ以前', items: [] },
  ]
  sessions.forEach(s => {
    const diff = (now.getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (diff < 1) groups[0].items.push(s)
    else if (diff < 2) groups[1].items.push(s)
    else if (diff < 7) groups[2].items.push(s)
    else if (diff < 30) groups[3].items.push(s)
    else groups[4].items.push(s)
  })
  return groups.filter(g => g.items.length > 0)
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return <>{parts.map((p, i) => i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{p}</strong> : <span key={i}>{p}</span>)}</>
}

const sc = 'bg-white/5 border border-white/10 rounded-lg px-2 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none w-full'

export default function ChatPage() {
  const navigate = useNavigate()
  const { user, session, points, refreshPoints, isLoading } = useAuth()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Sidebar
  const [sessions, setSessions]         = useState<AnalysisRecord[]>([])
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isViewingPast, setIsViewingPast]     = useState(false)

  // Chat
  const [calcData, setCalcData]             = useState<CalcData | null>(null)
  const [birthDate, setBirthDate]           = useState('')
  const [birthTime, setBirthTime]           = useState('')
  const [partnerBirthDate, setPartnerBirthDate] = useState('')
  const [messages, setMessages]             = useState<Message[]>([])
  const [input, setInput]                   = useState('')
  const [isStreaming, setIsStreaming]       = useState(false)
  const [chatRecordId, setChatRecordId]     = useState<string | null>(null)
  const [showInsufficientModal, setShowInsufficientModal] = useState(false)

  // Birth form
  const [form, setForm] = useState({
    year: '', month: '', day: '', hour: '', minute: '',
    gender: 'female' as 'male' | 'female',
    showPartner: false,
    partnerYear: '', partnerMonth: '', partnerDay: '',
    partnerGender: 'male' as 'male' | 'female',
  })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!user) return
    getAnalyses(user.id).then(data => {
      setSessions(data.filter(r => r.feature === 'chat'))
    }).catch(() => {})
  }, [user])

  function startNewChat() {
    setCalcData(null)
    setMessages([])
    setActiveSessionId(null)
    setIsViewingPast(false)
    setChatRecordId(null)
    setForm({ year: '', month: '', day: '', hour: '', minute: '', gender: 'female', showPartner: false, partnerYear: '', partnerMonth: '', partnerDay: '', partnerGender: 'male' })
    setSidebarOpen(false)
  }

  function loadSession(record: AnalysisRecord) {
    const raw = record.content as Record<string, unknown> | null
    const msgs = Array.isArray(raw?.chat)
      ? raw!.chat as Message[]
      : Array.isArray(raw) ? raw as Message[]
      : []
    setMessages(msgs)
    setCalcData(null)
    setActiveSessionId(record.id)
    setIsViewingPast(true)
    setSidebarOpen(false)
  }

  async function handleStartChat(e: React.FormEvent) {
    e.preventDefault()
    if (!form.year || !form.month || !form.day) { setFormError('生年月日を入力してください'); return }
    setFormError('')

    const bd = `${form.year}-${String(form.month).padStart(2, '0')}-${String(form.day).padStart(2, '0')}`
    const bt = form.hour !== '' && form.minute !== ''
      ? `${String(form.hour).padStart(2, '0')}:${String(form.minute).padStart(2, '0')}` : ''
    const pbd = form.showPartner && form.partnerYear && form.partnerMonth && form.partnerDay
      ? `${form.partnerYear}-${String(form.partnerMonth).padStart(2, '0')}-${String(form.partnerDay).padStart(2, '0')}` : ''

    let fortune
    try {
      fortune = await calculateFortuneData({
        birthDate: bd, birthTime: bt, gender: form.gender, mbti: '', question: '',
        partnerBirthDate: pbd, partnerBirthTime: '', partnerGender: form.partnerGender, partnerMbti: '',
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '命式を計算できませんでした')
      return
    }
    const calc: CalcData = {
      shichuYear: fortune.shichu.year.kanshi, shichuMonth: fortune.shichu.month.kanshi,
      shichuDay: fortune.shichu.day.kanshi, shichuHour: fortune.shichu.hour?.kanshi ?? null,
      nayin: fortune.nayin, sanmeiStar: fortune.sanmei.shukumeiStar,
      chusatsu: fortune.sanmei.chusatsu, sukuyo: fortune.sukuyo,
      lifePathNumber: fortune.lifePathNumber!, honmeiName: fortune.honmeiName!,
      archetype: getArchetype(fortune.shichu.day.kanshi),
      sukuyoDetail: getSukuyoDetail(fortune.sukuyo),
    }
    setCalcData(calc)
    setBirthDate(bd)
    setBirthTime(bt)
    setPartnerBirthDate(pbd)
    setIsViewingPast(false)

    const initMsg: Message = {
      role: 'assistant',
      content: `命式の読み込みが完了しました。${form.gender === 'female' ? '女性' : '男性'}・${form.year}年${form.month}月${form.day}日生まれの方として鑑定を行います。\n\n仕事・恋愛・転機・対人関係など、何でもお気軽にご相談ください。`,
    }
    setMessages([initMsg])

    if (user) {
      const title = `鑑定結果への質問 — ${bd}`
      saveAnalysis(user.id, 'chat', bd, title).then(rid => {
        if (rid) {
          const newRecord: AnalysisRecord = {
            id: rid, user_id: user.id, feature: 'chat',
            birth_date: bd, title, content: null,
            created_at: new Date().toISOString(),
          }
          setChatRecordId(rid)
          setActiveSessionId(rid)
          setSessions(prev => [newRecord, ...prev])
        }
      }).catch(() => {})
    }
  }

  async function handleSend() {
    if (!input.trim() || isStreaming || !calcData) return
    const userMsg = input.trim()
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setIsStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          newMessage: userMsg,
          conversationHistory: newMessages.slice(0, -1),
          birthDate, birthTime, gender: form.gender,
          calculatedData: calcData,
          partnerBirthDate, partnerGender: form.showPartner ? form.partnerGender : undefined,
        }),
      })

      if (!res.ok) {
        if (res.status === 402) {
          setShowInsufficientModal(true)
          setMessages(prev => prev.slice(0, -1))
          setIsStreaming(false)
          return
        }
        const ct = res.headers.get('content-type')
        if (ct?.includes('application/json')) {
          const err = await res.json() as { error?: string }
          throw new Error(err.error ?? 'エラーが発生しました')
        }
        throw new Error(`エラーが発生しました（${res.status}）`)
      }

      const reader  = res.body!.getReader()
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
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: err instanceof Error ? err.message : 'エラーが発生しました' }
        return updated
      })
    } finally {
      setIsStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 100)
      refreshPoints()
      if (chatRecordId) {
        setMessages(prev => {
          saveChatMessages(chatRecordId, prev).catch(() => {})
          return prev
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center p-4">
        <div className="glass-card max-w-sm w-full p-8 text-center space-y-5">
          <h2 className="text-white font-bold text-xl">ログインが必要です</h2>
          <p className="text-white/50 text-sm">鑑定結果への質問をご利用いただくにはログインが必要です。</p>
          <button onClick={() => navigate('/auth')} className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm">
            ログイン / 新規登録
          </button>
          <button onClick={() => navigate('/')} className="w-full py-2 text-white/30 hover:text-white/50 text-xs">
            トップに戻る
          </button>
        </div>
      </div>
    )
  }

  const grouped = groupSessions(sessions)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080f28' }}>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-40 md:z-auto
          w-64 flex-shrink-0 flex flex-col border-r border-white/5
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ background: '#060b1c' }}
      >
        {/* Logo + New chat */}
        <div className="p-3 border-b border-white/5 flex-shrink-0">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-white/50 text-sm italic tracking-widest">fate-lab</span>
          </button>
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all text-sm text-white/55 hover:text-white/80"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            新しい鑑定
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {grouped.length === 0 ? (
            <p className="text-white/20 text-xs px-3 py-4 text-center">鑑定履歴はありません</p>
          ) : (
            grouped.map(group => (
              <div key={group.label} className="mb-3">
                <p className="text-white/20 text-xs px-3 py-1">{group.label}</p>
                {group.items.map(s => {
                  const title = (s.title ?? '').replace(/^鑑定結果への質問 — \d{4}-\d{2}-\d{2}$/, s.birth_date ?? '').trim() || s.birth_date || '鑑定履歴'
                  const isActive = s.id === activeSessionId
                  return (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all truncate block ${
                        isActive
                          ? 'bg-white/10 text-white/80'
                          : 'text-white/40 hover:bg-white/5 hover:text-white/65'
                      }`}
                    >
                      {title}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 flex-shrink-0 flex items-center justify-between">
          <button
            onClick={() => navigate('/mypage')}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition-colors"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            マイページ
          </button>
          <span className="text-white/60 text-xs font-mono bg-white/8 px-2 py-0.5 rounded-full">{points} pt</span>
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-white/5 flex-shrink-0" style={{ background: '#060b1c' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-white/40 hover:text-white/70 transition-colors">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-white/55 text-sm italic tracking-widest">fate-lab</span>
          </div>
          <span className="ml-auto text-white/60 text-xs font-mono bg-white/5 px-2 py-0.5 rounded-full">{points} pt</span>
        </div>

        {/* ── Past session view ── */}
        {isViewingPast && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-white/25 text-xs">過去のチャット</p>
                  <button
                    onClick={startNewChat}
                    className="text-xs bg-accent/15 text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/25 transition-colors"
                  >
                    + 新しい鑑定
                  </button>
                </div>
                {messages.length === 0 ? (
                  <p className="text-white/25 text-sm text-center py-20">質問履歴がありません</p>
                ) : (
                  <div className="space-y-5">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-accent text-xs">✦</span>
                          </div>
                        )}
                        <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-loose ${
                          msg.role === 'user'
                            ? 'bg-accent/20 text-white/90 rounded-tr-sm'
                            : 'bg-white/5 border border-white/8 text-white/80 rounded-tl-sm'
                        }`}>
                          {msg.role === 'assistant' ? renderBold(msg.content) : msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Welcome / birth form ── */}
        {!isViewingPast && !calcData && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto mb-4">
                  <span className="text-accent text-2xl">✦</span>
                </div>
                <h1 className="text-white text-2xl font-bold mb-2">鑑定結果について質問する</h1>
                <p className="text-white/35 text-sm">生年月日を入力して鑑定を始めてください</p>
              </div>

              <form onSubmit={handleStartChat} className="glass-card p-6 space-y-5">
                {/* 生年月日 */}
                <div>
                  <label className="text-white/45 text-xs mb-2 block">あなたの生年月日 <span className="text-accent">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={sc}>
                      <option value="">年</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
                    </select>
                    <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className={sc}>
                      <option value="">月</option>
                      {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
                    </select>
                    <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))} className={sc}>
                      <option value="">日</option>
                      {DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
                    </select>
                  </div>
                </div>

                {/* 時間 */}
                <div>
                  <label className="text-white/45 text-xs mb-2 block">生まれた時間 <span className="text-white/25">（任意）</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={form.hour} onChange={e => setForm(f => ({ ...f, hour: e.target.value }))} className={sc}>
                      <option value="">不明</option>
                      {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}時</option>)}
                    </select>
                    <select value={form.minute} onChange={e => setForm(f => ({ ...f, minute: e.target.value }))} className={sc}>
                      <option value="">不明</option>
                      {MINUTES.map(min => <option key={min} value={min}>{String(min).padStart(2, '0')}分</option>)}
                    </select>
                  </div>
                </div>

                {/* 性別 */}
                <div>
                  <label className="text-white/45 text-xs mb-2 block">性別 <span className="text-accent">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['female', 'male'] as const).map(g => (
                      <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gender: g }))}
                        className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${form.gender === g ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/10 text-white/40 hover:text-white/60'}`}>
                        {g === 'female' ? '女性' : '男性'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 相手 */}
                <div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, showPartner: !f.showPartner }))}
                    className={`w-full py-2.5 rounded-lg text-xs font-medium border transition-all ${form.showPartner ? 'border-accent/40 bg-accent/10 text-accent' : 'border-white/10 text-white/35 hover:text-white/55'}`}>
                    {form.showPartner ? '▲ 相手の情報を入力中' : '＋ 相手の情報を追加（相性診断の場合）'}
                  </button>
                </div>

                {form.showPartner && (
                  <>
                    <div>
                      <label className="text-white/45 text-xs mb-2 block">相手の生年月日</label>
                      <div className="grid grid-cols-3 gap-2">
                        <select value={form.partnerYear} onChange={e => setForm(f => ({ ...f, partnerYear: e.target.value }))} className={sc}>
                          <option value="">年</option>
                          {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
                        </select>
                        <select value={form.partnerMonth} onChange={e => setForm(f => ({ ...f, partnerMonth: e.target.value }))} className={sc}>
                          <option value="">月</option>
                          {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
                        </select>
                        <select value={form.partnerDay} onChange={e => setForm(f => ({ ...f, partnerDay: e.target.value }))} className={sc}>
                          <option value="">日</option>
                          {DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-white/45 text-xs mb-2 block">相手の性別</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['female', 'male'] as const).map(g => (
                          <button key={g} type="button" onClick={() => setForm(f => ({ ...f, partnerGender: g }))}
                            className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${form.partnerGender === g ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/10 text-white/40 hover:text-white/60'}`}>
                            {g === 'female' ? '女性' : '男性'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {formError && <p className="text-red-400 text-xs">{formError}</p>}

                <button type="submit" disabled={!form.year || !form.month || !form.day}
                  className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-bold rounded-xl text-sm transition-all disabled:opacity-40 shadow-lg shadow-accent/20">
                  鑑定を始める
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Active chat ── */}
        {!isViewingPast && calcData && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Session bar */}
            <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/5 flex items-center justify-between gap-3" style={{ background: 'rgba(6,11,28,0.8)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                <span className="text-white/50 text-xs truncate">
                  {form.year}年{form.month}月{form.day}日 · {form.gender === 'female' ? '女性' : '男性'} · 日柱 {calcData.shichuDay}
                </span>
              </div>
              <button
                onClick={startNewChat}
                className="text-white/30 hover:text-accent text-xs border border-white/10 hover:border-accent/30 rounded-lg px-3 py-1.5 transition-all flex-shrink-0"
              >
                新しい鑑定
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-accent text-xs">✦</span>
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-loose ${
                      msg.role === 'user'
                        ? 'bg-accent/20 text-white/90 rounded-tr-sm'
                        : 'bg-white/5 border border-white/8 text-white/80 rounded-tl-sm'
                    }`}>
                      {msg.role === 'assistant' ? renderBold(msg.content) : msg.content}
                      {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && msg.content === '' && (
                        <span className="inline-flex gap-1 ml-1">
                          {[0, 1, 2].map(j => (
                            <span key={j} className="w-1 h-1 rounded-full bg-accent/50 animate-pulse inline-block" style={{ animationDelay: `${j * 0.2}s` }} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-4 pb-4 pt-2" style={{ background: 'linear-gradient(to top, rgba(8,15,40,1) 70%, transparent)' }}>
              <div className="max-w-2xl mx-auto">
                <div className="flex gap-2 items-end bg-white/5 border border-white/10 hover:border-white/15 p-2 rounded-2xl transition-colors">
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
                    placeholder="何でも聞いてみてください..."
                    rows={1}
                    disabled={isStreaming}
                    className="flex-1 bg-transparent text-white text-sm placeholder-white/20 focus:outline-none resize-none leading-relaxed px-2 py-1.5 max-h-32"
                    style={{ fieldSizing: 'content' } as React.CSSProperties}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming}
                    className="w-9 h-9 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-30 flex items-center justify-center transition-all flex-shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
                <p className="text-white/12 text-xs text-center mt-2">Enter で送信 · Shift+Enter で改行 · 2pt/メッセージ</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Insufficient points modal */}
      {showInsufficientModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowInsufficientModal(false)}>
          <div className="glass-card max-w-sm w-full p-8 space-y-6 border border-accent/20" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💎</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">ポイントが不足しています</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                メッセージを送信するには2ポイントが必要です。
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setShowInsufficientModal(false); navigate('/mypage') }}
                className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-bold rounded-lg text-sm transition-all"
              >
                💎 ポイントを購入する
              </button>
              <button
                onClick={() => setShowInsufficientModal(false)}
                className="w-full py-2.5 text-white/40 hover:text-white/60 text-sm transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
