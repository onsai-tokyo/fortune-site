import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ResultCard } from '../components/ResultCard'
import { ChatArea } from '../components/ChatArea'
import { PayjpModal } from '../components/PayjpModal'
import { SelfAnalysisTab } from '../components/tabs/SelfAnalysisTab'
import { CompatibilityTab } from '../components/tabs/CompatibilityTab'
import { NumerologyTab } from '../components/tabs/NumerologyTab'
import { KyuseiTab } from '../components/tabs/KyuseiTab'
import { calcLifePathNumber, calcBirthdayNumber, LIFE_PATH_MEANINGS } from '../lib/numerology'
import { calcHonmeiStar, calcTsukimeiStar, KYUSEI_NAMES, KYUSEI_ELEMENTS, KYUSEI_MEANINGS } from '../lib/kyusei'
import type { FortuneData, NumerologyResult, KyuseiResult } from '../lib/types'

interface LocationState { fortuneData: FortuneData }

const SUBSCRIPTION_END_KEY = 'fortune_subscription_end'

type Tab = 'shichu' | 'sanmei' | 'sukuyo' | 'numerology' | 'kyusei' | 'ziwei'

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: 'shichu',    label: '四柱推命',   sub: 'Shichu Suimei'  },
  { id: 'sanmei',    label: '算命学',     sub: 'Sanmei'         },
  { id: 'sukuyo',    label: '宿曜',       sub: 'Sukuyo'         },
  { id: 'numerology',label: '数秘術',     sub: 'Numerology'     },
  { id: 'kyusei',    label: '九星気学',   sub: 'Kyusei Kigaku'  },
  { id: 'ziwei',     label: '紫微斗数',   sub: 'Coming Soon'    },
]

function calcNumerology(birthDate: string): NumerologyResult {
  const day = parseInt(birthDate.split('-')[2])
  const lifePathNumber = calcLifePathNumber(birthDate)
  return {
    lifePathNumber,
    birthdayNumber: calcBirthdayNumber(day),
    meaning: LIFE_PATH_MEANINGS[lifePathNumber] ?? LIFE_PATH_MEANINGS[1],
  }
}

function calcKyusei(birthDate: string): KyuseiResult {
  const [yearStr, monthStr, dayStr] = birthDate.split('-')
  const birthYear = parseInt(yearStr)
  const birthMonth = parseInt(monthStr)
  const birthDay = parseInt(dayStr)
  const honmeiStar = calcHonmeiStar(birthYear, birthMonth, birthDay)
  const tsukimeiStar = calcTsukimeiStar(honmeiStar, birthMonth)
  const meanings = KYUSEI_MEANINGS[honmeiStar]
  return {
    honmeiStar,
    honmeiName: KYUSEI_NAMES[honmeiStar],
    tsukimeiStar,
    tsukimeiName: KYUSEI_NAMES[tsukimeiStar],
    element: KYUSEI_ELEMENTS[honmeiStar],
    personality: meanings.personality,
    luckyDirection: meanings.lucky_direction,
    luckyColor: meanings.lucky_color,
    yearFortune: meanings.year_fortune,
  }
}

function isSubscriptionActive(): boolean {
  const end = localStorage.getItem(SUBSCRIPTION_END_KEY)
  return !!end && new Date(end) > new Date()
}

export function ResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as LocationState | null

  const storedFortuneData = (() => { try { return JSON.parse(sessionStorage.getItem('fortune_data') ?? 'null') } catch { return null } })()
  const storedSessionData = (() => { try { return JSON.parse(sessionStorage.getItem('fortune_session') ?? 'null') } catch { return null } })()
  const storedReading = sessionStorage.getItem('fortune_reading') ?? ''

  const fortuneData: FortuneData | null = state?.fortuneData ?? storedFortuneData

  const [reading, setReading]         = useState('')
  const [isStreaming, setIsStreaming]  = useState(true)
  const [apiError, setApiError]       = useState(false)
  const [rateLimitError, setRateLimitError] = useState(false)
  const [noApiKey, setNoApiKey]       = useState(false)
  const [sessionData, setSessionData] = useState<Record<string, unknown>>(storedSessionData ?? {})
  const [activeTab, setActiveTab]     = useState<Tab>('shichu')

  const [hasSubscription, setHasSubscription] = useState(isSubscriptionActive())
  const [showSubModal, setShowSubModal]         = useState(false)
  const [isProcessingSub, setIsProcessingSub]   = useState(false)
  const [subError, setSubError]                 = useState('')

  const abortRef = useRef<AbortController | null>(null)

  const numerologyResult = fortuneData ? calcNumerology(fortuneData.input.birthDate) : null
  const kyuseiResult     = fortuneData ? calcKyusei(fortuneData.input.birthDate) : null

  useEffect(() => {
    if (!fortuneData) { navigate('/'); return }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    fetch('/health')
      .then(r => r.json())
      .then((body: { hasApiKey?: boolean }) => {
        if (controller.signal.aborted) return
        if (!body.hasApiKey) { setNoApiKey(true); setIsStreaming(false); return }
        streamFortune(fortuneData, controller.signal)
      })
      .catch(() => { if (!controller.signal.aborted && fortuneData) streamFortune(fortuneData, controller.signal) })
    return () => { controller.abort() }
  }, [])

  async function streamFortune(fd: FortuneData, signal: AbortSignal) {
    setReading(''); setIsStreaming(true); setApiError(false); setRateLimitError(false)
    try {
      const { input, shichu, nayin, sanmei, sukuyo } = fd
      const res = await fetch('/api/fortune', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate: input.birthDate, birthTime: input.birthTime, gender: input.gender, question: input.question, fortuneData: { input, shichu, nayin, sanmei, sukuyo, partner: fd.partner } }),
        signal,
      })
      if (!res.ok) {
        if (res.status === 429) { setRateLimitError(true); setIsStreaming(false); return }
        const eb = await res.json().catch(() => ({})); throw new Error((eb as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      if (!res.body) throw new Error('No body')
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let accum = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') { setIsStreaming(false); sessionStorage.setItem('fortune_reading', accum); continue }
          try {
            const parsed = JSON.parse(raw)
            if (parsed.sessionData) { setSessionData(parsed.sessionData); continue }
            const delta = parsed.delta?.text ?? ''; if (delta) { accum += delta; setReading(accum) }
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Stream error:', err); setApiError(true)
    } finally { setIsStreaming(false) }
  }

  async function handleSubscriptionToken(payjpToken: string) {
    setIsProcessingSub(true); setSubError('')
    try {
      const res = await fetch('/api/payment/subscribe-monthly', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payjpToken }),
      })
      const body = await res.json() as { token?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? '決済に失敗しました')
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      localStorage.setItem(SUBSCRIPTION_END_KEY, end)
      setHasSubscription(true)
      setShowSubModal(false)
    } catch (err) {
      setSubError(err instanceof Error ? err.message : '決済に失敗しました')
    } finally { setIsProcessingSub(false) }
  }

  if (!fortuneData || !numerologyResult || !kyuseiResult) return null

  return (
    <>
      {showSubModal && (
        <PayjpModal
          mode="subscription"
          title="命術師AIチャット — プレミアム会員"
          amount={1980}
          isProcessing={isProcessingSub}
          error={subError}
          onToken={handleSubscriptionToken}
          onClose={() => { setShowSubModal(false); setSubError('') }}
        />
      )}

      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          <header className="flex items-center justify-between">
            <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/60 transition-colors text-sm flex items-center gap-1">
              ← トップに戻る
            </button>
            <span className="text-white/30 italic text-xs tracking-widest">Meishiki Analysis</span>
          </header>

          <ResultCard data={fortuneData} />

          {/* エラー */}
          {noApiKey && (
            <div className="glass-card p-4 border border-yellow-500/20">
              <p className="text-yellow-400 text-sm font-semibold">APIキーが未設定です</p>
            </div>
          )}
          {rateLimitError && (
            <div className="glass-card p-4 border border-accent/20 text-center">
              <p className="text-accent text-sm font-semibold">解析回数の上限に達しました</p>
              <p className="text-white/40 text-xs mt-1">しばらく時間をおいてからお試しください。</p>
            </div>
          )}
          {apiError && (
            <div className="glass-card p-4 border border-red-500/20">
              <p className="text-red-400 text-sm font-semibold">解析エラーが発生しました</p>
            </div>
          )}

          {/* タブナビゲーション */}
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-0 border-b border-navy-light min-w-max">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => tab.id !== 'ziwei' && setActiveTab(tab.id)}
                  className={`flex flex-col items-center px-4 py-2.5 text-xs border-b-2 -mb-px transition-all flex-shrink-0 ${
                    tab.id === 'ziwei'
                      ? 'border-transparent text-white/15 cursor-default'
                      : activeTab === tab.id
                        ? 'border-accent text-accent'
                        : 'border-transparent text-white/30 hover:text-white/60'
                  }`}
                >
                  <span className="font-medium">{tab.label}</span>
                  <span className={`text-[10px] italic ${activeTab === tab.id ? 'text-accent/60' : 'text-white/15'}`}>{tab.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1 space-y-4">

            {/* 四柱推命 */}
            {activeTab === 'shichu' && (
              <div className="glass-card p-6 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-accent rounded-full" />
                  <h2 className="text-white font-semibold text-base">四柱推命 解析レポート</h2>
                </div>
                {!reading && isStreaming && (
                  <div className="flex items-center justify-center h-32 gap-3">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                    <p className="text-white/50 text-sm">データを解析中...</p>
                  </div>
                )}
                {reading && (
                  <div className="text-white/85 leading-loose text-sm sm:text-base whitespace-pre-wrap">
                    {reading}
                    {isStreaming && <span className="streaming-cursor" />}
                  </div>
                )}
              </div>
            )}

            {/* 算命学 */}
            {activeTab === 'sanmei' && <SelfAnalysisTab fortuneData={fortuneData} />}

            {/* 宿曜 */}
            {activeTab === 'sukuyo' && <CompatibilityTab fortuneData={fortuneData} />}

            {/* 数秘術 */}
            {activeTab === 'numerology' && (
              <NumerologyTab result={numerologyResult} hasFullAccess={true} onOpenOneTime={() => {}} onOpenSubscription={() => {}} />
            )}

            {/* 九星気学 */}
            {activeTab === 'kyusei' && (
              <KyuseiTab result={kyuseiResult} hasFullAccess={true} onOpenOneTime={() => {}} onOpenSubscription={() => {}} />
            )}

            {/* 紫微斗数（近日公開） */}
            {activeTab === 'ziwei' && (
              <div className="glass-card p-10 flex flex-col items-center gap-4 animate-fade-in">
                <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center">
                  <span className="text-white/20 text-2xl">✦</span>
                </div>
                <div className="text-center">
                  <p className="text-white/50 font-semibold">紫微斗数</p>
                  <p className="text-white/25 text-sm mt-1">近日公開予定</p>
                </div>
              </div>
            )}

            {/* 他のメニュー導線 */}
            <div className="glass-card p-4 border border-white/5">
              <p className="text-white/25 text-xs mb-3 italic">他のメニューも試す — More Features</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '相談し放題プラン', sub: '命術師AIに何でも相談', path: '/feature/chat',        dot: 'bg-accent',        border: 'border-accent/20        hover:border-accent/40',        text: 'text-accent'        },
                  { label: '自己詳細分析',     sub: '強み・適職・転換期',  path: '/feature/self',        dot: 'bg-blue-400',      border: 'border-blue-400/20      hover:border-blue-400/40',      text: 'text-blue-300'      },
                  { label: '相性診断',         sub: '仕事・恋愛の相性',    path: '/feature/compat',      dot: 'bg-pink-400',      border: 'border-pink-400/20      hover:border-pink-400/40',      text: 'text-pink-300'      },
                  { label: '結婚相性',         sub: '生活・力関係・コツ',  path: '/feature/marriage',    dot: 'bg-rose-400',      border: 'border-rose-400/20      hover:border-rose-400/40',      text: 'text-rose-300'      },
                  { label: '組織診断',         sub: 'キーマン・戦略分析',  path: '/feature/org',         dot: 'bg-emerald-400',   border: 'border-emerald-400/20   hover:border-emerald-400/40',   text: 'text-emerald-300'   },
                  { label: '他己分析',         sub: '採用・相手の特性',    path: '/feature/recruit',     dot: 'bg-violet-400',    border: 'border-violet-400/20    hover:border-violet-400/40',    text: 'text-violet-300'    },
                  { label: '上司占い',         sub: 'コミュニケーション',  path: '/feature/boss',        dot: 'bg-blue-500',      border: 'border-blue-500/20      hover:border-blue-500/40',      text: 'text-blue-400'      },
                  { label: '部下占い',         sub: 'マネジメントのコツ',  path: '/feature/subordinate', dot: 'bg-green-500',     border: 'border-green-500/20     hover:border-green-500/40',     text: 'text-green-400'     },
                  { label: '取引先占い',       sub: '信頼構築・戦略',      path: '/feature/client',      dot: 'bg-purple-500',    border: 'border-purple-500/20    hover:border-purple-500/40',    text: 'text-purple-400'    },
                  { label: '方位診断',         sub: '吉方位・引越し',      path: '/feature/direction',   dot: 'bg-cyan-500',      border: 'border-cyan-500/20      hover:border-cyan-500/40',      text: 'text-cyan-400'      },
                ].map(item => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`p-3 border rounded-lg text-left transition-all ${item.border}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={`w-1 h-1 rounded-full flex-shrink-0 ${item.dot}`} />
                      <p className={`font-semibold text-xs ${item.text}`}>{item.label}</p>
                    </div>
                    <p className="text-white/30 text-xs pl-2.5">{item.sub}</p>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* AIチャット（サブスク会員のみ） */}
          <div className="pt-4 border-t border-white/5">
            {hasSubscription ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <p className="text-white/40 text-xs">命術師AIチャット — プレミアム会員</p>
                </div>
                <ChatArea fortuneData={fortuneData} initialReading={storedReading} sessionData={sessionData} />
              </div>
            ) : (
              <div className="glass-card p-6 border border-accent/15 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-accent/30 flex items-center justify-center flex-shrink-0"
                    style={{ background: 'radial-gradient(circle, rgba(148,163,184,0.1) 0%, transparent 70%)' }}>
                    <span className="text-accent text-lg">✦</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">命術師AIチャット</p>
                    <p className="text-white/40 text-xs">命式を記憶したAI占術師に何でも相談できます</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {['命式データを踏まえた深掘り相談', '仕事・恋愛・転機など何でも質問可能', '毎月の運勢レポートも自動配信'].map(item => (
                    <li key={item} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-accent/60 flex-shrink-0" />
                      <span className="text-white/50 text-xs">{item}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowSubModal(true)}
                  className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all"
                >
                  1,980円/月でチャットを解放する
                </button>
                <p className="text-white/20 text-xs text-center">いつでも解約可能 · PAY.JP による安全な決済</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
