import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AnalysisChatPanel } from '../components/AnalysisChatPanel'
import { PayjpModal } from '../components/PayjpModal'
import { apiFetch } from '../lib/api'
import { saveAnalysis } from '../lib/history'
import { calcShichu, calcDaiyun, calcRyunen } from '../lib/shichu'
import { calcNayin } from '../lib/nayin'
import { calcSanmei } from '../lib/sanmei'
import { getSukuyo } from '../lib/sukuyo'
import { calcLifePathNumber } from '../lib/numerology'
import { calcHonmeiStar, KYUSEI_NAMES } from '../lib/kyusei'
import { getArchetype, getSukuyoDetail, getAnimalFortune } from '../lib/archetype'
import type { FortuneData } from '../lib/types'
import { useEffect } from 'react'

const now = new Date().getFullYear()
const YEARS  = Array.from({ length: now - 1899 }, (_, i) => now - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const HOURS  = Array.from({ length: 24 }, (_, i) => i)
const MINS   = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const sc = "bg-white/5 border border-white/15 rounded-lg px-2 py-2.5 text-white text-sm focus:outline-none focus:border-accent/60 transition-all appearance-none"

function daysInMonth(y: number, m: number) { return (!y || !m) ? 31 : new Date(y, m, 0).getDate() }

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

export default function AnalyzePage() {
  const navigate = useNavigate()
  const { user, session, isLoading, isPremium, points, refreshPoints } = useAuth()

  // 入力フォーム
  const [year,        setYear]        = useState<number | ''>('')
  const [month,       setMonth]       = useState<number | ''>('')
  const [day,         setDay]         = useState<number | ''>('')
  const [hour,        setHour]        = useState<number | ''>('')
  const [minute,      setMinute]      = useState<number | ''>('')
  const [timeUnknown, setTimeUnknown] = useState(true)
  const [gender,      setGender]      = useState<'male' | 'female'>('female')
  const [question,    setQuestion]    = useState('')
  const [showPartner, setShowPartner] = useState(false)
  const [partnerBirthDate, setPartnerBirthDate] = useState('')
  const [partnerGender,    setPartnerGender]    = useState<'male' | 'female'>('male')

  // 結果
  const [fortuneData,  setFortuneData]  = useState<FortuneData | null>(null)
  const [answer,       setAnswer]       = useState<string | null>(null)
  const [analysisId,   setAnalysisId]   = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [showPayjpModal, setShowPayjpModal] = useState<'small' | 'standard' | 'premium' | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const days = Array.from({ length: daysInMonth(Number(year), Number(month)) }, (_, i) => i + 1)
  const COST = 3
  const hasEnough = isPremium || points >= COST

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth?mode=register', { replace: true })
  }, [user, isLoading])

  if (isLoading || !user) return null

  function buildFortuneData(): FortuneData {
    const y = Number(year), m = Number(month), d = Number(day)
    const h = (!timeUnknown && hour !== '') ? Number(hour) : undefined
    const shichu = calcShichu(y, m, d, h)
    const nayin  = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    const birthDate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const birthTime = (!timeUnknown && hour !== '' && minute !== '')
      ? `${String(Number(hour)).padStart(2,'0')}:${String(Number(minute)).padStart(2,'0')}` : ''
    const lifePathNumber = calcLifePathNumber(birthDate)
    const honmeiStar = calcHonmeiStar(y, m, d)
    const honmeiName = KYUSEI_NAMES[honmeiStar]
    const archetype = getArchetype(shichu.day.kanshi)
    const animalFortune = getAnimalFortune(shichu.day.kanshi)
    const sukuyoDetail = getSukuyoDetail(sukuyo)
    const currentYear = new Date().getFullYear()
    const age = currentYear - y
    const daiyunList = calcDaiyun(y, m, d, gender)
    const currentDaiyun = daiyunList.find(dyn => age >= dyn.startAge && age <= dyn.endAge) ?? daiyunList[0]
    const daiyun = currentDaiyun.kanshi
    const daiyunAge = `${currentDaiyun.startAge}〜${currentDaiyun.endAge}歳`
    const ryunen = calcRyunen(currentYear)
    return {
      input: { birthDate, birthTime, gender, mbti: '', question, partnerBirthDate, partnerBirthTime: '', partnerGender, partnerMbti: '' },
      shichu, nayin, sanmei, sukuyo,
      lifePathNumber, honmeiName, archetype, animalFortune, sukuyoDetail, daiyun, daiyunAge, ryunen,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !month || !day) return
    if (!hasEnough) { setShowPayjpModal('standard'); return }

    setLoading(true)
    setError('')
    setAnswer(null)
    setAnalysisId(null)

    try {
      const fd = buildFortuneData()
      setFortuneData(fd)

      const res = await apiFetch('/api/analyze/free', {
        method: 'POST',
        body: JSON.stringify({
          fortuneData: fd,
          question: question || undefined,
          partnerBirthDate: showPartner && partnerBirthDate ? partnerBirthDate : undefined,
          partnerGender: showPartner && partnerBirthDate ? partnerGender : undefined,
        }),
      })
      if (res.status === 402) throw new Error('ポイントが不足しています')
      if (!res.ok) throw new Error('解析に失敗しました')

      const json = await res.json() as { answer: string }
      setAnswer(json.answer)
      refreshPoints()

      if (user) {
        const title = question ? question.slice(0, 40) : `自由鑑定 - ${fd.input.birthDate}`
        const id = await saveAnalysis(user.id, 'free', fd.input.birthDate, title, { result: { answer: json.answer } })
        if (id) setAnalysisId(id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handlePayment(payjpToken: string) {
    if (!showPayjpModal) return
    setIsProcessingPayment(true); setPaymentError('')
    const endpointMap = { small: '/api/payment/subscribe-light', standard: '/api/payment/subscribe-standard', premium: '/api/payment/subscribe-heavy' }
    try {
      const res = await fetch(endpointMap[showPayjpModal], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ payjpToken }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? '決済に失敗しました')
      setShowPayjpModal(null)
      await refreshPoints()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : '決済に失敗しました')
    } finally { setIsProcessingPayment(false) }
  }

  const payjpTitleMap = { small: 'ライトプラン — 30pt/月', standard: 'スタンダードプラン — 80pt/月', premium: 'ヘビープラン — 200pt/月' }
  const payjpAmountMap = { small: 780, standard: 1980, premium: 3980 }
  const payjpPtsMap = { small: 30, standard: 80, premium: 200 }

  return (
    <div className="min-h-screen bg-deep-navy">
      {showPayjpModal && (
        <PayjpModal
          mode="subscription"
          title={payjpTitleMap[showPayjpModal]}
          amount={payjpAmountMap[showPayjpModal]}
          pts={payjpPtsMap[showPayjpModal]}
          isProcessing={isProcessingPayment}
          error={paymentError}
          onToken={handlePayment}
          onClose={() => { setShowPayjpModal(null); setPaymentError('') }}
        />
      )}

      <nav className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-10" style={{ background: 'rgba(8,15,40,0.9)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/60 transition-colors text-sm">← トップ</button>
          <span className="text-white/60 text-sm font-medium">自由鑑定</span>
          {!isPremium && <span className="text-white/30 text-xs font-mono">{points} pt</span>}
          {isPremium && <span className="text-xs bg-accent/20 text-accent rounded-full px-2 py-0.5">Premium</span>}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {!answer ? (
          <>
            <div className="glass-card p-5">
              <p className="text-white/50 text-sm leading-relaxed">
                生年月日を入力して、気になることを自由に入力してください。複数の占術を統合して回答します。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
              {/* 生年月日 */}
              <div>
                <p className="text-white/50 text-xs mb-3">生年月日 <span className="text-red-400">*</span></p>
                <div className="flex gap-1.5 items-center flex-wrap">
                  <select value={year}  onChange={e => setYear(e.target.value ? Number(e.target.value) : '')}  className={`${sc} w-[5.5rem]`}>
                    <option value="">年</option>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className="text-white/30 text-xs">年</span>
                  <select value={month} onChange={e => setMonth(e.target.value ? Number(e.target.value) : '')} className={`${sc} w-14`}>
                    <option value="">月</option>{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <span className="text-white/30 text-xs">月</span>
                  <select value={day}   onChange={e => setDay(e.target.value ? Number(e.target.value) : '')}   className={`${sc} w-14`}>
                    <option value="">日</option>{days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span className="text-white/30 text-xs">日</span>
                </div>
              </div>

              {/* 時間 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-white/50 text-xs">生まれた時間</p>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={timeUnknown} onChange={e => setTimeUnknown(e.target.checked)} className="w-3 h-3 accent-blue-400 rounded" />
                    <span className="text-white/30 text-xs">時間不明</span>
                  </label>
                </div>
                {!timeUnknown && (
                  <div className="flex gap-1.5 items-center">
                    <select value={hour}   onChange={e => setHour(e.target.value !== '' ? Number(e.target.value) : '')}   className={`${sc} w-16`}>
                      <option value="">時</option>{HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}</option>)}
                    </select>
                    <span className="text-white/30 text-xs">時</span>
                    <select value={minute} onChange={e => setMinute(e.target.value !== '' ? Number(e.target.value) : '')} className={`${sc} w-16`}>
                      <option value="">分</option>{MINS.map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                    </select>
                    <span className="text-white/30 text-xs">分</span>
                  </div>
                )}
              </div>

              {/* 性別 */}
              <div>
                <p className="text-white/50 text-xs mb-3">性別 <span className="text-red-400">*</span></p>
                <div className="flex gap-2">
                  {(['female', 'male'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      className={`px-5 py-2 rounded-lg text-sm border transition-all ${gender === g ? 'border-accent bg-accent/10 text-accent' : 'border-white/15 text-white/40 hover:border-white/30'}`}>
                      {g === 'female' ? '女性' : '男性'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 質問 */}
              <div>
                <p className="text-white/50 text-xs mb-2">何を知りたいですか？（任意）</p>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="例：仕事運について教えて　/　転職のタイミングは？　/　部下との関係を改善したい"
                  rows={3}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/40 resize-none leading-relaxed"
                />
                <p className="text-white/20 text-xs mt-1">入力しない場合は総合的な特性・強み・傾向を解析します</p>
              </div>

              {/* 相手の生年月日（オプション） */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPartner(p => !p)}
                  className="text-white/40 hover:text-white/60 text-xs flex items-center gap-1.5 transition-colors"
                >
                  <span>{showPartner ? '▼' : '▶'}</span>
                  相手の生年月日を入力する（相性・関係性の質問の場合）
                </button>
                {showPartner && (
                  <div className="mt-3 p-4 bg-white/3 border border-white/8 rounded-xl space-y-3">
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={partnerBirthDate}
                        onChange={e => setPartnerBirthDate(e.target.value)}
                        className="flex-1 bg-deep-navy/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/40"
                      />
                      <div className="flex gap-1.5">
                        {(['male', 'female'] as const).map(g => (
                          <button key={g} type="button" onClick={() => setPartnerGender(g)}
                            className={`px-3 py-2 rounded-lg text-xs border transition-all ${partnerGender === g ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-white/40'}`}>
                            {g === 'male' ? '男' : '女'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ポイント */}
              {!isPremium && (
                <div className={`flex items-center justify-between rounded-lg px-4 py-3 border ${hasEnough ? 'border-white/10 bg-white/3' : 'border-red-500/30 bg-red-500/5'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">消費ポイント</span>
                    <span className={`font-bold text-sm ${hasEnough ? 'text-white' : 'text-red-400'}`}>{COST} pt</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/30 text-xs">残高</span>
                    <span className={`font-mono text-sm font-bold ${hasEnough ? 'text-accent' : 'text-red-400'}`}>{points} pt</span>
                  </div>
                </div>
              )}

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}

              <button
                type="submit"
                disabled={!year || !month || !day || loading}
                className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all shadow-lg shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    解析中...
                  </>
                ) : (
                  '解析する → 3pt'
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="glass-card border border-accent/20 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-accent rounded-full" />
                <h2 className="text-white font-semibold">解析結果</h2>
                {fortuneData && <span className="text-white/20 text-xs ml-1">{fortuneData.input.birthDate}</span>}
              </div>
              {question && (
                <div className="bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 mb-4">
                  <p className="text-white/50 text-xs mb-0.5">質問</p>
                  <p className="text-white/80 text-sm">{question}</p>
                </div>
              )}
              <p className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap">{renderBold(answer)}</p>
            </div>

            {fortuneData && (
              <AnalysisChatPanel
                fortuneData={fortuneData}
                featureLabel="自由鑑定"
                analysisId={analysisId ?? undefined}
              />
            )}

            <button
              onClick={() => { setAnswer(null); setFortuneData(null); setAnalysisId(null) }}
              className="w-full py-2 text-white/30 hover:text-white/50 text-sm transition-colors"
            >
              ← 別の質問をする
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
