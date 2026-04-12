import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SelfAnalysisTab } from '../components/tabs/SelfAnalysisTab'
import { CompatibilityTab } from '../components/tabs/CompatibilityTab'
import { OrganizationTab } from '../components/tabs/OrganizationTab'
import { MarriageTab } from '../components/tabs/MarriageTab'
import { RecruitTab } from '../components/tabs/RecruitTab'
import { BossTab } from '../components/tabs/BossTab'
import { SubordinateTab } from '../components/tabs/SubordinateTab'
import { ClientTab } from '../components/tabs/ClientTab'
import { DirectionTab } from '../components/tabs/DirectionTab'
import { PayjpModal } from '../components/PayjpModal'
import { AnalysisChatPanel } from '../components/AnalysisChatPanel'
import type { FortuneData } from '../lib/types'
import { calcShichu, calcDaiyun, calcRyunen } from '../lib/shichu'
import { calcNayin } from '../lib/nayin'
import { calcSanmei } from '../lib/sanmei'
import { getSukuyo } from '../lib/sukuyo'
import { calcLifePathNumber } from '../lib/numerology'
import { calcHonmeiStar, KYUSEI_NAMES } from '../lib/kyusei'
import { getArchetype, getSukuyoDetail, getAnimalFortune } from '../lib/archetype'

type FeatureId = 'self' | 'compat' | 'marriage' | 'org' | 'recruit' | 'boss' | 'subordinate' | 'client' | 'direction'

// ポイントコスト定義
const POINT_COST: Record<FeatureId, number> = {
  self: 3, compat: 3, marriage: 3, org: 3, recruit: 3, boss: 3, subordinate: 3, client: 3, direction: 2,
}

const FEATURE_META: Record<FeatureId, {
  label: string; sub: string; dot: string; border: string; description: string
}> = {
  self: {
    label: '自己分析', sub: 'Self Analysis',
    dot: 'bg-blue-400', border: 'border-blue-500/30',
    description: '生年月日を入力すると、強み・弱み・適職・人生転換期を命式から解析します。',
  },
  compat: {
    label: '相性診断', sub: 'Compatibility',
    dot: 'bg-pink-400', border: 'border-pink-500/30',
    description: 'あなたの生年月日を入力後、次の画面で相手の情報を入力して仕事・恋愛の相性を診断します。',
  },
  marriage: {
    label: '結婚相性', sub: 'Marriage',
    dot: 'bg-rose-400', border: 'border-rose-500/30',
    description: 'あなたの生年月日を入力後、パートナーの情報を入力して結婚生活・力関係・うまくいくコツを解析します。',
  },
  org: {
    label: '組織診断', sub: 'Organization',
    dot: 'bg-emerald-400', border: 'border-emerald-500/30',
    description: 'あなたの生年月日を入力後、メンバーを追加してチームのキーマン・戦い方・人間関係マトリクスを解析します。',
  },
  recruit: {
    label: '採用・他己分析', sub: 'Recruitment Analysis',
    dot: 'bg-violet-400', border: 'border-violet-500/30',
    description: 'あなた（面接官）の生年月日を入力後、候補者の情報を入力して強み・適性・あなたとの相性を命式から解析します。',
  },
  boss: {
    label: '上司占い', sub: 'Boss Fortune',
    dot: 'bg-blue-400', border: 'border-blue-500/30',
    description: 'あなたの生年月日を入力後、上司の情報を入力してコミュニケーションのコツ・喜ぶ言葉・避けるべき言葉を解析します。',
  },
  subordinate: {
    label: '部下占い', sub: 'Subordinate Fortune',
    dot: 'bg-green-400', border: 'border-green-500/30',
    description: 'あなたの生年月日を入力後、部下の情報を入力してモチベーション・成長ポイント・マネジメントのコツを解析します。',
  },
  client: {
    label: '取引先占い', sub: 'Client Fortune',
    dot: 'bg-purple-400', border: 'border-purple-500/30',
    description: 'あなたの生年月日を入力後、取引先担当者の情報を入力して意思決定スタイル・信頼構築ポイント・アプローチ戦略を解析します。',
  },
  direction: {
    label: '方位診断', sub: 'Direction Diagnosis',
    dot: 'bg-cyan-400', border: 'border-cyan-500/30',
    description: 'あなたの生年月日から九星気学と四柱推命を統合し、吉方位・凶方位・引越し・出張・デスク配置のアドバイスを解析します。',
  },
}

const currentYear = new Date().getFullYear()
const YEARS  = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const HOURS  = Array.from({ length: 24 }, (_, i) => i)
const MINS   = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
function daysInMonth(y: number, m: number) { return (!y || !m) ? 31 : new Date(y, m, 0).getDate() }

const sc = "bg-white/5 border border-white/15 rounded-lg px-2 py-2.5 text-white text-sm focus:outline-none focus:border-accent/60 transition-all font-sans cursor-pointer appearance-none"

function BirthForm({
  meta: _meta,
  featureId,
  points,
  isPremium,
  onSubmit,
  onInsufficientPoints,
}: {
  meta: typeof FEATURE_META[FeatureId]
  featureId: FeatureId
  points: number
  isPremium: boolean
  onSubmit: (fd: FortuneData) => void
  onInsufficientPoints?: () => void
}) {
  const cost = POINT_COST[featureId]
  const hasEnough = isPremium || points >= cost

  const [year,        setYear]        = useState<number | ''>('')
  const [month,       setMonth]       = useState<number | ''>('')
  const [day,         setDay]         = useState<number | ''>('')
  const [hour,        setHour]        = useState<number | ''>('')
  const [minute,      setMinute]      = useState<number | ''>('')
  const [timeUnknown, setTimeUnknown] = useState(true)
  const [gender,      setGender]      = useState<'male' | 'female'>('female')
  const days = Array.from({ length: daysInMonth(Number(year), Number(month)) }, (_, i) => i + 1)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !month || !day) {
      alert('生年月日を入力してください')
      return
    }
    if (!hasEnough) {
      console.log('[BirthForm] Insufficient points!')
      onInsufficientPoints?.()
      return
    }
    const y = Number(year), m = Number(month), d = Number(day)
    const h = (!timeUnknown && hour !== '') ? Number(hour) : undefined
    const shichu = calcShichu(y, m, d, h)
    const nayin  = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    const birthDate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const birthTime = (!timeUnknown && hour !== '' && minute !== '')
      ? `${String(Number(hour)).padStart(2,'0')}:${String(Number(minute)).padStart(2,'0')}` : ''

    // 拡張占術データ（プレビューと同レベルの精度）
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

    onSubmit({
      input: { birthDate, birthTime, gender, mbti: '', question: '', partnerBirthDate: '', partnerBirthTime: '', partnerGender: 'female', partnerMbti: '' },
      shichu, nayin, sanmei, sukuyo,
      lifePathNumber, honmeiName, archetype, animalFortune, sukuyoDetail, daiyun, daiyunAge, ryunen,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">

      {/* 生年月日 */}
      <div>
        <p className="text-white/50 text-xs mb-3">生年月日 <span className="text-red-400">*</span></p>
        <div className="flex gap-1.5 items-center flex-wrap">
          <select value={year}  onChange={e => setYear(e.target.value ? Number(e.target.value) : '')}  className={`${sc} w-[5.5rem]`}>
            <option value="">年</option>{YEARS.map(y  => <option key={y}  value={y}>{y}</option>)}
          </select>
          <span className="text-white/30 text-xs">年</span>
          <select value={month} onChange={e => setMonth(e.target.value ? Number(e.target.value) : '')} className={`${sc} w-14`}>
            <option value="">月</option>{MONTHS.map(m => <option key={m}  value={m}>{m}</option>)}
          </select>
          <span className="text-white/30 text-xs">月</span>
          <select value={day}   onChange={e => setDay(e.target.value ? Number(e.target.value) : '')}   className={`${sc} w-14`}>
            <option value="">日</option>{days.map(d   => <option key={d}  value={d}>{d}</option>)}
          </select>
          <span className="text-white/30 text-xs">日</span>
        </div>
      </div>

      {/* 生まれた時間（任意） */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-white/50 text-xs">生まれた時間</p>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={timeUnknown} onChange={e => setTimeUnknown(e.target.checked)}
              className="w-3 h-3 accent-blue-400 rounded" />
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
        {!timeUnknown && (
          <p className="text-white/20 text-xs mt-1.5">時柱まで含めた精密解析が可能になります</p>
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

      {/* ポイント表示 */}
      {!isPremium && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
          hasEnough ? 'border-white/10 bg-white/3' : 'border-red-500/30 bg-red-500/5'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs">消費ポイント</span>
            <span className={`font-bold text-sm ${hasEnough ? 'text-white' : 'text-red-400'}`}>{cost} pt</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/30 text-xs">残高</span>
            <span className={`font-mono text-sm font-bold ${hasEnough ? 'text-accent' : 'text-red-400'}`}>{points} pt</span>
          </div>
        </div>
      )}

      {isPremium && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3 border border-accent/20 bg-accent/5">
          <span className="text-accent text-xs">✓ プレミアム会員</span>
          <span className="text-white/30 text-xs">— ポイント消費なし</span>
        </div>
      )}

      <button type="submit" disabled={!year || !month || !day || !hasEnough}
        className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all shadow-lg shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed">
        {hasEnough ? '解析を開始する →' : 'ポイントが不足しています'}
      </button>

      {!hasEnough && (
        <div className="flex items-center justify-center">
          <p className="text-red-400/70 text-xs">
            ポイントを購入するか、月額プランにアップグレードしてください（
            <button
              type="button"
              onClick={onInsufficientPoints}
              className="text-accent underline underline-offset-2 hover:text-accent-dark transition-colors"
            >
              →ポイントを購入する
            </button>
            ）
          </p>
        </div>
      )}
    </form>
  )
}

// ポイント不足モーダル
function InsufficientPointsModal({
  onClose,
  onBuySmall,
  onBuyStandard,
  onPremium,
  isProcessing,
  error,
}: {
  onClose: () => void
  onBuySmall: () => void
  onBuyStandard: () => void
  onPremium: () => void
  isProcessing: boolean
  error: string
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-sm p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full border border-red-400/30 flex items-center justify-center mx-auto bg-red-400/10">
            <span className="text-red-400 text-xl">!</span>
          </div>
          <h3 className="text-white font-semibold text-lg">ポイントが不足しています</h3>
          <p className="text-white/40 text-xs">ポイントを購入してください</p>
        </div>

        <div className="space-y-2">
          <button onClick={onBuySmall} disabled={isProcessing}
            className="w-full py-3 border border-white/15 hover:border-white/30 rounded-lg text-sm transition-all text-left px-4 disabled:opacity-40">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white font-medium">ライト</span>
                <span className="text-white/40 text-xs ml-2">30 ポイント/月</span>
              </div>
              <span className="text-accent font-bold">¥480/月</span>
            </div>
          </button>

          <button onClick={onBuyStandard} disabled={isProcessing}
            className="w-full py-3 border border-accent/30 hover:border-accent/60 rounded-lg text-sm transition-all text-left px-4 bg-accent/5 disabled:opacity-40">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white font-medium">スタンダード</span>
                <span className="text-white/40 text-xs ml-2">80 ポイント/月</span>
                <span className="text-xs text-accent ml-2">おすすめ</span>
              </div>
              <span className="text-accent font-bold">¥980/月</span>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-white/25 text-xs">または</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button onClick={onPremium} disabled={isProcessing}
            className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all disabled:opacity-40">
            月額プラン ¥1,980 — 無制限
          </button>
        </div>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <button onClick={onClose} className="w-full py-2 text-white/30 hover:text-white/60 text-xs transition-colors">
          キャンセル
        </button>
      </div>
    </div>
  )
}

export function FeaturePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, session, isLoading, isPremium, points, refreshPoints } = useAuth()
  const [fortuneData, setFortuneData] = useState<FortuneData | null>(null)
  const [showInsufficientModal, setShowInsufficientModal] = useState(false)
  const [showPayjpModal, setShowPayjpModal] = useState<'small' | 'standard' | 'premium' | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const featureId = (id as FeatureId) ?? 'self'
  const meta = FEATURE_META[featureId] ?? FEATURE_META.self

  // 未ログインならリダイレクト（isLoading中は待機）
  // /feature/chat は ChatPage（/chat）で処理する
  useEffect(() => {
    if (!isLoading && !user) navigate('/auth?mode=register', { replace: true })
    if (!isLoading && id === 'chat') navigate('/chat', { replace: true })
  }, [user, isLoading, id, navigate])

  if (isLoading || !user) return null
  if (id === 'chat') return null

  async function handlePayment(payjpToken: string) {
    if (!showPayjpModal) return
    setIsProcessingPayment(true); setPaymentError('')

    const endpointMap = {
      small: '/api/payment/subscribe-light',
      standard: '/api/payment/subscribe-standard',
      premium: '/api/payment/subscribe-heavy',
    }

    try {
      const res = await fetch(endpointMap[showPayjpModal], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ payjpToken }),
      })
      const data = await res.json() as { success?: boolean; newBalance?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? '決済に失敗しました')
      setShowPayjpModal(null)
      setShowInsufficientModal(false)
      await refreshPoints()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : '決済に失敗しました')
    } finally { setIsProcessingPayment(false) }
  }

  function handleFortuneSubmit(fd: FortuneData) {
    setFortuneData(fd)
    // 注：analyzed_featuresへの追加は各タブで解析成功後に行う
  }

  const payjpTitleMap = {
    small: 'ライトプラン — 30pt/月',
    standard: 'スタンダードプラン — 80pt/月',
    premium: 'ヘビープラン — 200pt/月',
  }
  const payjpAmountMap = { small: 480, standard: 980, premium: 1980 }
  const payjpPtsMap = { small: 30, standard: 80, premium: 200 }

  return (
    <div className="min-h-screen">
      {/* Pay.jp モーダル */}
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

      {/* ポイント不足モーダル */}
      {showInsufficientModal && (
        <InsufficientPointsModal
          onClose={() => setShowInsufficientModal(false)}
          onBuySmall={() => { setShowInsufficientModal(false); setShowPayjpModal('small') }}
          onBuyStandard={() => { setShowInsufficientModal(false); setShowPayjpModal('standard') }}
          onPremium={() => { setShowInsufficientModal(false); setShowPayjpModal('premium') }}
          isProcessing={isProcessingPayment}
          error={paymentError}
        />
      )}

      {/* ナビ */}
      <nav className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-10" style={{ background: 'rgba(8,15,40,0.8)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/60 transition-colors text-sm">
            ← トップ
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            <span className="text-white/60 text-sm font-medium">{meta.label}</span>
            <span className="text-white/20 text-xs italic hidden sm:block">{meta.sub}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {/* ポイント残高 */}
            {!isPremium && (
              <button
                onClick={() => setShowInsufficientModal(true)}
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 hover:border-accent/30 transition-colors"
              >
                <span className="text-white/40 text-xs">残高</span>
                <span className="text-accent text-xs font-bold font-mono">{points} pt</span>
              </button>
            )}
            {isPremium && (
              <span className="text-xs bg-accent/20 text-accent rounded-full px-2 py-0.5">Premium</span>
            )}
            {fortuneData && (
              <button onClick={() => setFortuneData(null)} className="text-white/20 hover:text-white/50 text-xs transition-colors">
                ← 再入力
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {!fortuneData ? (
          <>
            <div className={`glass-card border ${meta.border} p-6`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-1 h-6 rounded-full ${meta.dot}`} />
                <div>
                  <p className="text-white/25 text-xs italic tracking-widest">{meta.sub}</p>
                  <h1 className="text-white font-bold text-xl">{meta.label}</h1>
                </div>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">{meta.description}</p>
            </div>
            <BirthForm
              meta={meta}
              featureId={featureId}
              points={points}
              isPremium={isPremium}
              onSubmit={handleFortuneSubmit}
              onInsufficientPoints={() => setShowInsufficientModal(true)}
            />
            {/* ポイント不足時のアップグレード導線 */}
            {!isPremium && points < POINT_COST[featureId] && (
              <div className="glass-card border border-red-500/20 p-4 text-center space-y-3">
                <p className="text-white/50 text-sm">ポイントが不足しています</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowPayjpModal('small')}
                    className="flex-1 py-2.5 border border-white/15 hover:border-white/30 rounded-lg text-xs text-white/60 hover:text-white/80 transition-all">
                    30pt — ¥480/月
                  </button>
                  <button onClick={() => setShowPayjpModal('standard')}
                    className="flex-1 py-2.5 border border-accent/30 hover:border-accent/60 rounded-lg text-xs text-accent transition-all bg-accent/5">
                    80pt — ¥980/月
                  </button>
                </div>
                <button onClick={() => setShowPayjpModal('premium')}
                  className="w-full py-2.5 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-xs transition-all">
                  月額プラン ¥1,980 — 無制限
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className={`w-1 h-5 rounded-full ${meta.dot}`} />
              <h2 className="text-white font-semibold">{meta.label}</h2>
              <span className="text-white/20 text-xs ml-1">{fortuneData.input.birthDate}</span>
            </div>

            {featureId === 'self'        && <SelfAnalysisTab  fortuneData={fortuneData} />}
            {featureId === 'compat'      && <CompatibilityTab fortuneData={fortuneData} />}
            {featureId === 'marriage'    && <MarriageTab      fortuneData={fortuneData} />}
            {featureId === 'org'         && <OrganizationTab  fortuneData={fortuneData} />}
            {featureId === 'recruit'     && <RecruitTab       fortuneData={fortuneData} />}
            {featureId === 'boss'        && <BossTab          fortuneData={fortuneData} />}
            {featureId === 'subordinate' && <SubordinateTab   fortuneData={fortuneData} />}
            {featureId === 'client'      && <ClientTab        fortuneData={fortuneData} />}
            {featureId === 'direction'   && <DirectionTab     fortuneData={fortuneData} />}
            <AnalysisChatPanel fortuneData={fortuneData} featureLabel={meta.label} />
          </>
        )}

      </div>
    </div>
  )
}
