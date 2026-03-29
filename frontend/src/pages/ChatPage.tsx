import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { saveAnalysis, saveChatMessages } from '../lib/history'
import { calcShichu } from '../lib/shichu'
import { calcNayin } from '../lib/nayin'
import { calcSanmei } from '../lib/sanmei'
import { getSukuyo } from '../lib/sukuyo'
import { calcLifePathNumber } from '../lib/numerology'
import { calcHonmeiStar, KYUSEI_NAMES } from '../lib/kyusei'
import { getArchetype, getSukuyoDetail } from '../lib/archetype'

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

export default function ChatPage() {
  const navigate = useNavigate()
  const { user, session, points, refreshPoints } = useAuth()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [form, setForm] = useState({
    year: '', month: '', day: '', hour: '', minute: '',
    gender: 'female' as 'male' | 'female',
    showPartner: false,
    partnerYear: '', partnerMonth: '', partnerDay: '',
    partnerGender: 'male' as 'male' | 'female',
  })
  const [calcData, setCalcData] = useState<CalcData | null>(null)
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [partnerBirthDate, setPartnerBirthDate] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [formError, setFormError] = useState('')
  const [chatRecordId, setChatRecordId] = useState<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleStartChat(e: React.FormEvent) {
    e.preventDefault()
    if (!form.year || !form.month || !form.day) { setFormError('生年月日を入力してください'); return }
    setFormError('')

    const bd = `${form.year}-${String(form.month).padStart(2, '0')}-${String(form.day).padStart(2, '0')}`
    const bt = form.hour !== '' && form.minute !== ''
      ? `${String(form.hour).padStart(2, '0')}:${String(form.minute).padStart(2, '0')}` : ''
    const pbd = form.showPartner && form.partnerYear && form.partnerMonth && form.partnerDay
      ? `${form.partnerYear}-${String(form.partnerMonth).padStart(2, '0')}-${String(form.partnerDay).padStart(2, '0')}` : ''

    const [y, m, d] = [Number(form.year), Number(form.month), Number(form.day)]
    const hourNum = form.hour !== '' ? Number(form.hour) : undefined
    const shichu = calcShichu(y, m, d, hourNum)
    const nayin = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    const honmei = calcHonmeiStar(y, m, d)

    setCalcData({
      shichuYear: shichu.year.kanshi, shichuMonth: shichu.month.kanshi,
      shichuDay: shichu.day.kanshi, shichuHour: shichu.hour?.kanshi ?? null,
      nayin, sanmeiStar: sanmei.shukumeiStar, chusatsu: sanmei.chusatsu, sukuyo,
      lifePathNumber: calcLifePathNumber(bd),
      honmeiName: KYUSEI_NAMES[honmei],
      archetype: getArchetype(shichu.day.kanshi),
      sukuyoDetail: getSukuyoDetail(sukuyo),
    })
    setBirthDate(bd)
    setBirthTime(bt)
    setPartnerBirthDate(pbd)
    setChatRecordId(null)
    const initMsg: Message = {
      role: 'assistant',
      content: `命式の読み込みが完了しました。${form.gender === 'female' ? '女性' : '男性'}・${form.year}年${form.month}月${form.day}日生まれの方として鑑定を行います。\n\n仕事・恋愛・転機・対人関係など、何でもお気軽にご相談ください。`,
    }
    setMessages([initMsg])
    // ログイン中なら履歴レコードを作成
    if (user) {
      saveAnalysis(user.id, 'chat', bd, `AIチャット — ${bd}`).then(rid => {
        if (rid) setChatRecordId(rid)
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

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

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
        const err = await res.json() as { error?: string; code?: string }
        if (res.status === 402 || err.code === 'INSUFFICIENT_POINTS') {
          throw new Error('ポイントが不足しています。マイページからポイントを購入してください。')
        }
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
      // チャット履歴をSupabaseに保存
      if (chatRecordId) {
        setMessages(prev => {
          saveChatMessages(chatRecordId, prev).catch(() => {})
          return prev
        })
      }
    }
  }

  function renderBold(text: string): React.ReactNode {
    const parts = text.split(/\*\*(.+?)\*\*/g)
    if (parts.length === 1) return text
    return <>{parts.map((p, i) => i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{p}</strong> : <span key={i}>{p}</span>)}</>
  }

  // 未ログイン
  if (!user) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center p-4">
        <div className="glass-card max-w-sm w-full p-8 text-center space-y-5">
          <h2 className="text-white font-bold text-xl">ログインが必要です</h2>
          <p className="text-white/50 text-sm">命術師AIチャットをご利用いただくにはログインが必要です。</p>
          <button onClick={() => navigate('/auth')} className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm">ログイン / 新規登録</button>
          <button onClick={() => navigate('/')} className="w-full py-2 text-white/30 hover:text-white/50 text-xs">トップに戻る</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-deep-navy flex flex-col">
      {/* ヘッダー */}
      <nav className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-20" style={{ background: 'rgba(8,15,40,0.95)' }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="italic text-white/60 text-sm tracking-widest">Meishiki</span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/mypage')} className="text-xs bg-white/10 text-white/60 hover:bg-white/20 rounded-full px-2 py-0.5 font-mono transition-colors">
              {points} pt
            </button>
            <span className="text-white/30 text-xs hidden sm:block">1pt/メッセージ</span>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto w-full px-4 flex-1 flex flex-col py-6 gap-6">

        {/* 命式入力フォーム（チャット開始前） */}
        {!calcData && (
          <div>
            <div className="text-center mb-6">
              <h1 className="text-white font-bold text-xl mb-2">命術師AIに相談する</h1>
              <p className="text-white/40 text-sm">生年月日を入力すると、あなたの命式を踏まえた上で鑑定します。</p>
            </div>

            <form onSubmit={handleStartChat} className="glass-card p-6 space-y-5 border border-accent/15">
              {/* 生年月日 */}
              <div>
                <label className="text-white/50 text-xs mb-2 block">あなたの生年月日 <span className="text-accent">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  <select value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none">
                    <option value="">年</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
                  <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none">
                    <option value="">月</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
                  </select>
                  <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none">
                    <option value="">日</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
                  </select>
                </div>
              </div>

              {/* 時間 */}
              <div>
                <label className="text-white/50 text-xs mb-2 block">生まれた時間 <span className="text-white/25">（任意）</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.hour} onChange={e => setForm(f => ({ ...f, hour: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none appearance-none">
                    <option value="">不明</option>
                    {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}時</option>)}
                  </select>
                  <select value={form.minute} onChange={e => setForm(f => ({ ...f, minute: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none appearance-none">
                    <option value="">不明</option>
                    {MINUTES.map(min => <option key={min} value={min}>{String(min).padStart(2, '0')}分</option>)}
                  </select>
                </div>
              </div>

              {/* 性別 */}
              <div>
                <label className="text-white/50 text-xs mb-2 block">性別 <span className="text-accent">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {(['female', 'male'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gender: g }))}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${form.gender === g ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/10 text-white/40 hover:text-white/60'}`}>
                      {g === 'female' ? '女性' : '男性'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 相手情報 */}
              <div>
                <button type="button" onClick={() => setForm(f => ({ ...f, showPartner: !f.showPartner }))}
                  className={`w-full py-2.5 rounded-lg text-xs font-medium border transition-all ${form.showPartner ? 'border-purple-400/40 bg-purple-400/10 text-purple-300' : 'border-white/10 text-white/35 hover:text-white/55'}`}>
                  {form.showPartner ? '▲ 相手の情報を入力中' : '＋ 相性を見たい相手の情報（任意）'}
                </button>
              </div>

              {form.showPartner && (
                <div className="space-y-4 p-4 rounded-lg border border-purple-400/15" style={{ background: 'rgba(167,139,250,0.05)' }}>
                  <div>
                    <label className="text-white/40 text-xs mb-2 block">相手の生年月日</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ val: form.partnerYear, key: 'partnerYear', opts: YEARS, label: '年', suffix: '年' },
                        { val: form.partnerMonth, key: 'partnerMonth', opts: MONTHS, label: '月', suffix: '月' },
                        { val: form.partnerDay, key: 'partnerDay', opts: DAYS, label: '日', suffix: '日' }].map(({ val, key, opts, label, suffix }) => (
                        <select key={key} value={val} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="bg-navy-light border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none">
                          <option value="">{label}</option>
                          {opts.map(o => <option key={o} value={o}>{o}{suffix}</option>)}
                        </select>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-2 block">相手の性別</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['female', 'male'] as const).map(g => (
                        <button key={g} type="button" onClick={() => setForm(f => ({ ...f, partnerGender: g }))}
                          className={`py-2 rounded-lg text-xs font-medium border transition-all ${form.partnerGender === g ? 'border-purple-400/50 bg-purple-400/10 text-purple-300' : 'border-white/10 text-white/35'}`}>
                          {g === 'female' ? '女性' : '男性'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {formError && <p className="text-red-400 text-xs">{formError}</p>}

              <button type="submit" disabled={!form.year || !form.month || !form.day}
                className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-bold rounded-lg text-sm transition-all disabled:opacity-40">
                ✦ 命術師AIに相談を始める
              </button>
            </form>
          </div>
        )}

        {/* チャットUI */}
        {calcData && (
          <div className="flex flex-col flex-1 gap-4">
            {/* 命式サマリ */}
            <div className="glass-card p-4 border border-accent/15 flex items-center justify-between gap-3">
              <div>
                <p className="text-accent/70 text-xs italic">命式鑑定中</p>
                <p className="text-white text-sm font-medium">{form.year}年{form.month}月{form.day}日 · {form.gender === 'female' ? '女性' : '男性'} · 日柱 {calcData.shichuDay}</p>
                {form.showPartner && partnerBirthDate && (
                  <p className="text-purple-300/60 text-xs mt-0.5">相手: {partnerBirthDate} · {form.partnerGender === 'female' ? '女性' : '男性'}</p>
                )}
              </div>
              <button onClick={() => { setCalcData(null); setMessages([]); setChatRecordId(null) }}
                className="text-white/30 hover:text-accent border border-white/10 hover:border-accent/30 rounded-lg px-3 py-1.5 text-xs transition-all flex-shrink-0">
                新しい相談 →
              </button>
            </div>

            {/* メッセージ一覧 */}
            <div className="flex flex-col gap-4 flex-1">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                      <span className="text-accent text-xs">✦</span>
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-loose ${
                    msg.role === 'user'
                      ? 'bg-accent/20 text-white/90 rounded-tr-sm'
                      : 'bg-white/5 border border-white/8 text-white/80 rounded-tl-sm'
                  }`}>
                    {msg.role === 'assistant' ? renderBold(msg.content) : msg.content}
                    {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && msg.content === '' && (
                      <span className="inline-flex gap-1 ml-1">
                        {[0,1,2].map(j => <span key={j} className="w-1 h-1 rounded-full bg-accent/50 animate-pulse inline-block" style={{ animationDelay: `${j * 0.2}s` }} />)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* 入力エリア */}
            <div className="sticky bottom-0 pb-4 pt-2" style={{ background: 'linear-gradient(to top, rgba(8,15,40,1) 80%, transparent)' }}>
              <div className="flex gap-2 items-end glass-card border border-white/10 p-2 rounded-2xl">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend() } }}
                  placeholder="仕事・恋愛・転機など何でも..."
                  rows={1}
                  disabled={isStreaming}
                  className="flex-1 bg-transparent text-white text-sm placeholder-white/20 focus:outline-none resize-none leading-relaxed px-2 py-1 max-h-32"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                <button onClick={handleSend} disabled={!input.trim() || isStreaming}
                  className="w-9 h-9 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-30 flex items-center justify-center transition-all flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <p className="text-white/15 text-xs text-center mt-2">Enter で送信 · Shift+Enter で改行</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
