import { useRef, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PayjpModal } from '../components/PayjpModal'
import { Toast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { calcShichu, calcDaiyun, calcRyunen } from '../lib/shichu'
import { calcNayin } from '../lib/nayin'
import { calcSanmei } from '../lib/sanmei'
import { getSukuyo } from '../lib/sukuyo'
import { calcLifePathNumber } from '../lib/numerology'
import { calcHonmeiStar, calcTsukimeiStar, KYUSEI_NAMES } from '../lib/kyusei'
import { getArchetype, getSukuyoDetail } from '../lib/archetype'
import { saveAnalysis } from '../lib/history'

interface FortuneCalcData {
  shichuYear: string
  shichuMonth: string
  shichuDay: string
  shichuHour: string | null
  nayin: string
  sanmeiStar: string
  chusatsu: string
  sukuyo: string
  lifePathNumber: number
  honmeiName: string
  tsukimeiName: string
  archetype: string
  sukuyoDetail: string
  daiyun: string        // 現在の大運干支
  daiyunAge: string     // 大運の年齢範囲
  ryunen: string        // 今年の流年干支
}

const TOC_ITEMS = [
  { num: '1',  title: '性格特性 — あなたの本質と気質' },
  { num: '2',  title: '周りから見たあなた — 社会的ペルソナ' },
  { num: '3',  title: '仕事・適職 — 才能が開花する職業領域' },
  { num: '4',  title: '恋愛特徴 — 愛し方・愛され方のパターン' },
  { num: '5',  title: '結婚相手の特徴 — 理想的な伴侶の命式' },
  { num: '6',  title: '子供との縁と特徴' },
  { num: '7',  title: '親・兄弟との縁 — 家族が結んだ宿縁' },
  { num: '8',  title: '人生の使命 — この世に担って生まれた役割' },
  { num: '9',  title: '人生の転換期 — 大きな変化のタイミング' },
  { num: '10', title: 'あなたらしく生きるためのアドバイス' },
  { num: '11', title: '相性診断 — 入力した場合のみ生成' },
  { num: '12', title: '特に確認したいことへのご回答 — 入力した場合のみ生成' },
]




const FAQS = [
  { q: '無料でどこまで使えますか？', a: '総合命式鑑定書の生成は完全無料・登録不要です。詳細分析（自己分析・相性診断・組織診断など）はポイントが必要です。登録すると3ポイント無料でもらえます。' },
  { q: 'ポイントとは何ですか？', a: '詳細分析・AIチャットを利用するために消費するポイントです。登録時に3pt付与。自己分析・相性診断・結婚相性・採用分析は3pt、組織診断は3pt、AIチャットは2pt/メッセージ消費します。月額サブスクで毎月ポイントが付与されます。' },
  { q: 'AIチャットとは何ですか？', a: 'あなたの命式データを記憶した命術師AIに、仕事・恋愛・対人関係など何でも相談できます。2pt/メッセージで利用できます。月額サブスクを契約するとまとめてお得にポイントを受け取れます。' },
  { q: 'サブスクはいつでも解約できますか？', a: 'はい、いつでも解約できます。解約後は翌月からポイントの付与が停止します。残ったポイントはそのままご利用いただけます。' },
  { q: '解約方法を教えてください', a: 'ログイン後、マイページまたはトップページの料金セクションから解約できます。解約後は即時にサブスクが停止され、翌月の課金はありません。' },
]

const YEARS    = Array.from({ length: 107 }, (_, i) => 2026 - i)  // 2026〜1920
const MONTHS   = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS     = Array.from({ length: 31 }, (_, i) => i + 1)
const HOURS    = Array.from({ length: 24 }, (_, i) => i)
const MINUTES  = Array.from({ length: 60 }, (_, i) => i)

export function TopPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, session, isPremium, points, signOut, refreshPoints } = useAuth()
  const inputRef    = useRef<HTMLDivElement>(null)
  const previewRef  = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const chatRef     = useRef<HTMLDivElement>(null)
  const pricingRef  = useRef<HTMLDivElement>(null)
  const faqRef      = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const section = searchParams.get('section')
    if (section === 'pricing') {
      setTimeout(() => pricingRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // フォーム状態
  const [form, setForm] = useState({
    year: '', month: '', day: '',
    hour: '', minute: '',
    gender: 'female' as 'male' | 'female',
    showPartner: false,
    partnerYear: '', partnerMonth: '', partnerDay: '',
    partnerHour: '', partnerMinute: '',
    partnerGender: 'male' as 'male' | 'female',
    question: '',
  })
  const [isStreaming, setIsStreaming] = useState(false)

  // isStreaming が true になったら鑑定結果セクションにスクロール
  useEffect(() => {
    if (isStreaming) {
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }
  }, [isStreaming])
  const [previewContent, setPreviewContent] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [submittedLabel, setSubmittedLabel] = useState('')
  const [calcData, setCalcData] = useState<FortuneCalcData | null>(null)

  // 質問課金フロー
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [isProcessingQPayment, setIsProcessingQPayment] = useState(false)
  const [qPaymentError, setQPaymentError] = useState('')
  const [questionAnswer, setQuestionAnswer] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)
  const [submittedQuestion, setSubmittedQuestion] = useState('')

  // サブスク購入フロー
  const [showSubModal, setShowSubModal] = useState<null | 'light' | 'standard' | 'heavy'>(null)
  const [isProcessingSub, setIsProcessingSub] = useState(false)
  const [subError, setSubError] = useState('')

  useEffect(() => {
    console.log('[TopPage] User changed, userId:', user?.id)
  }, [user?.id])

  // 登録完了通知 - URLパラメータから直接チェック
  const [showRegistrationToast, setShowRegistrationToast] = useState(
    searchParams.get('registered') === 'true' ||
    searchParams.get('welcome') === 'true'
  )

  useEffect(() => {
    console.log('[TopPage] Component mounted')
    console.log('[TopPage] URL params:', window.location.search)
    console.log('[TopPage] showRegistrationToast:', showRegistrationToast)

    // 旧フォーマットの鑑定済みフラグを完全クリア
    try {
      const oldKey = localStorage.getItem('analyzed_features')
      if (oldKey) {
        console.log('[TopPage] Clearing old analyzed_features')
        localStorage.removeItem('analyzed_features')
      }
    } catch (e) {
      console.error('[TopPage] Failed to clear old data:', e)
    }

    // localStorageからもチェック（バックアップ）
    const flag = localStorage.getItem('show_registration_complete')
    if (flag === 'true') {
      console.log('[TopPage] ✅ localStorage flag detected!')
      localStorage.removeItem('show_registration_complete')
      setShowRegistrationToast(true)
    }
  }, [])

  // 無料鑑定 日次制限（3回/日、キャッシュヒットはカウントしない）
  const [showLimitModal, setShowLimitModal] = useState(false)

  function checkDailyLimit(): boolean {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const stored = localStorage.getItem('fortune_daily_usage')
      const usage = stored ? JSON.parse(stored) as { date: string; count: number } : { date: '', count: 0 }
      if (usage.date !== today) {
        localStorage.setItem('fortune_daily_usage', JSON.stringify({ date: today, count: 1 }))
        return true
      }
      if (usage.count >= 3) return false
      localStorage.setItem('fortune_daily_usage', JSON.stringify({ date: today, count: usage.count + 1 }))
      return true
    } catch { return true }
  }

  const SUBSCRIPTION_PLANS = {
    light:    { pts: 30,  amount: 480,  label: 'ライト',       endpoint: '/api/payment/subscribe-light' },
    standard: { pts: 80,  amount: 980,  label: 'スタンダード', endpoint: '/api/payment/subscribe-standard' },
    heavy:    { pts: 200, amount: 1980, label: 'ヘビー',        endpoint: '/api/payment/subscribe-heavy' },
  } as const

  async function handleSubPayment(payjpToken: string) {
    if (!showSubModal) return
    const plan = SUBSCRIPTION_PLANS[showSubModal]
    setIsProcessingSub(true); setSubError('')
    try {
      const res = await fetch(plan.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ payjpToken }),
      })
      const data = await res.json() as { success?: boolean; error?: string; newBalance?: number }
      if (!res.ok) throw new Error(data.error ?? '決済に失敗しました')
      setShowSubModal(null)
      await refreshPoints()
    } catch (err) {
      setSubError(err instanceof Error ? err.message : '決済に失敗しました')
    } finally { setIsProcessingSub(false) }
  }

  function scrollToInput() {
    inputRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleGeneratePreview(e: React.FormEvent) {
    e.preventDefault()
    if (!form.year || !form.month || !form.day) return

    const birthDate = `${form.year}-${String(form.month).padStart(2, '0')}-${String(form.day).padStart(2, '0')}`
    const birthTime = form.hour !== '' && form.minute !== ''
      ? `${String(form.hour).padStart(2, '0')}:${String(form.minute).padStart(2, '0')}`
      : ''

    const partnerBirthDate = form.showPartner && form.partnerYear && form.partnerMonth && form.partnerDay
      ? `${form.partnerYear}-${String(form.partnerMonth).padStart(2, '0')}-${String(form.partnerDay).padStart(2, '0')}`
      : ''
    const partnerBirthTime = form.showPartner && form.partnerHour !== '' && form.partnerMinute !== ''
      ? `${String(form.partnerHour).padStart(2, '0')}:${String(form.partnerMinute).padStart(2, '0')}`
      : ''

    const label = `${form.year}年${form.month}月${form.day}日　${form.gender === 'female' ? '女性' : '男性'}`
    setSubmittedLabel(label)
    setSubmittedQuestion(form.question)
    setQuestionAnswer('')

    // 全占術データをクライアント側で計算（決定論的・毎回同じ結果）
    const [y, m, d] = [Number(form.year), Number(form.month), Number(form.day)]
    const hourNum = form.hour !== '' ? Number(form.hour) : undefined
    const shichu = calcShichu(y, m, d, hourNum)
    const nayin = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    const lifePathNum = calcLifePathNumber(birthDate)
    const honmei = calcHonmeiStar(y, m, d)
    const tsukimei = calcTsukimeiStar(honmei, m)
    const archetype = getArchetype(shichu.day.kanshi)
    const sukuyoDetail = getSukuyoDetail(sukuyo)
    const currentYear = new Date().getFullYear()
    const daiyunList = calcDaiyun(y, m, d, form.gender)
    const age = currentYear - y
    const currentDaiyun = daiyunList.find(dyn => age >= dyn.startAge && age <= dyn.endAge) ?? daiyunList[0]
    const ryunen = calcRyunen(currentYear)
    const newCalcData: FortuneCalcData = {
      shichuYear: shichu.year.kanshi,
      shichuMonth: shichu.month.kanshi,
      shichuDay: shichu.day.kanshi,
      shichuHour: shichu.hour?.kanshi ?? null,
      nayin,
      sanmeiStar: sanmei.shukumeiStar,
      chusatsu: sanmei.chusatsu,
      sukuyo,
      lifePathNumber: lifePathNum,
      honmeiName: KYUSEI_NAMES[honmei],
      tsukimeiName: KYUSEI_NAMES[tsukimei],
      archetype,
      sukuyoDetail,
      daiyun: currentDaiyun.kanshi,
      daiyunAge: `${currentDaiyun.startAge}〜${currentDaiyun.endAge}歳`,
      ryunen,
    }
    setCalcData(newCalcData)

    // キャッシュキー（質問は含めない — 質問は別課金で都度生成）
    const cacheKey = `meishiki_v2_${birthDate}_${birthTime}_${form.gender}_${partnerBirthDate}_${partnerBirthTime}_${form.showPartner ? form.partnerGender : ''}`

    // キャッシュヒット → API不要（カウントしない）
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      setPreviewContent(cached)
      setPreviewError('')
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      return
    }

    // 日次制限チェック（未ログイン時のみ）
    if (!user && !checkDailyLimit()) {
      setShowLimitModal(true)
      return
    }

    setIsStreaming(true); setPreviewError(''); setPreviewContent('')

    try {
      const res = await fetch('/api/preview/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthDate, birthTime, gender: form.gender,
          partnerBirthDate, partnerBirthTime, partnerGender: form.partnerGender,
          question: form.question,
          calculatedData: {
            shichuYear: newCalcData.shichuYear,
            shichuMonth: newCalcData.shichuMonth,
            shichuDay: newCalcData.shichuDay,
            shichuHour: newCalcData.shichuHour,
            nayin: newCalcData.nayin,
            sanmeiStar: newCalcData.sanmeiStar,
            chusatsu: newCalcData.chusatsu,
            sukuyo: newCalcData.sukuyo,
            lifePathNumber: newCalcData.lifePathNumber,
            honmeiName: newCalcData.honmeiName,
            archetype: newCalcData.archetype,
            sukuyoDetail: newCalcData.sukuyoDetail,
            daiyun: newCalcData.daiyun,
            daiyunAge: newCalcData.daiyunAge,
            ryunen: newCalcData.ryunen,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string; code?: string }
        if (res.status === 429 || err.code === 'DAILY_LIMIT_EXCEEDED') {
          setIsStreaming(false)
          setShowLimitModal(true)
          return
        }
        throw new Error(err.error ?? '生成に失敗しました')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let firstChunk = true
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data) as { delta?: { text?: string } }
            if (parsed.delta?.text) {
              const cleaned = parsed.delta.text
                .replace(/^#{1,3}\s*/gm, '')
                .replace(/^---+$/gm, '')
                .replace(/^===+$/gm, '')
              fullContent += cleaned
              setPreviewContent(prev => prev + cleaned)
              if (firstChunk) {
                firstChunk = false
                setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // 生成完了 → キャッシュ保存 + 履歴保存（ログイン中のみ）
      if (fullContent) {
        try { localStorage.setItem(cacheKey, fullContent) } catch { /* localStorage 容量超過時は無視 */ }
        if (user) {
          saveAnalysis(user.id, 'preview', birthDate, submittedLabel).catch(() => {/* 履歴保存失敗は無視 */})
        }
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setIsStreaming(false)
    }
  }

  async function handleQuestionPayment(payjpToken: string) {
    setIsProcessingQPayment(true); setQPaymentError('')
    try {
      const res = await fetch('/api/payment/charge-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ payjpToken }),
      })
      const data = await res.json() as { token?: string; tdsUrl?: string; chargeId?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? '決済に失敗しました')
      if (data.tdsUrl) { window.location.href = data.tdsUrl; return }
      if (data.token) {
        setShowQuestionModal(false)
        await streamQuestionAnswer(data.token)
      }
    } catch (err) {
      setQPaymentError(err instanceof Error ? err.message : '決済に失敗しました')
    } finally { setIsProcessingQPayment(false) }
  }

  async function streamQuestionAnswer(token: string) {
    if (!calcData || !form.question.trim()) return
    setIsAnswering(true); setQuestionAnswer('')
    const birthDate = `${form.year}-${String(form.month).padStart(2, '0')}-${String(form.day).padStart(2, '0')}`
    try {
      const res = await fetch('/api/preview/question', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: form.question, calculatedData: calcData,
          questionToken: token, birthDate, gender: form.gender,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? '生成に失敗しました')
      }
      const reader = res.body!.getReader(); const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const d = line.slice(6); if (d === '[DONE]') break
          try {
            const parsed = JSON.parse(d) as { delta?: { text?: string } }
            if (parsed.delta?.text) setQuestionAnswer(prev => prev + parsed.delta!.text!)
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setQPaymentError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally { setIsAnswering(false) }
  }

  function renderBold(text: string): React.ReactNode {
    const parts = text.split(/\*\*(.+?)\*\*/g)
    if (parts.length === 1) return text
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1
            ? <strong key={i} className="text-white font-semibold">{part}</strong>
            : <span key={i}>{part}</span>
        )}
      </>
    )
  }

  function parseSections(content: string): { title: string; body: string }[] {
    return content
      .split(/(?=【[^】]+】)/)
      .filter(Boolean)
      .map(part => {
        const match = part.match(/^【([^】]+)】\n?([\s\S]*)/)
        return {
          title: match?.[1]?.trim() ?? '',
          body: match?.[2]?.trim() ?? part.trim(),
        }
      })
      .filter(s => s.title || s.body)
  }

  return (
    <div className="min-h-screen">

      {showRegistrationToast && (
        <Toast
          message="登録が完了しました！ウェルカムボーナス3ptをプレゼントしました"
          type="success"
          onClose={() => setShowRegistrationToast(false)}
          duration={6000}
        />
      )}

      {showQuestionModal && (
        <PayjpModal
          mode="one-time"
          title="ご質問への詳細回答"
          amount={500}
          isProcessing={isProcessingQPayment}
          error={qPaymentError}
          onToken={handleQuestionPayment}
          onClose={() => { setShowQuestionModal(false); setQPaymentError('') }}
        />
      )}

      {showLimitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowLimitModal(false)}>
          <div className="glass-card w-full max-w-sm p-8 text-center space-y-5" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-2">本日の無料枠を使いきりました</h3>
              <p className="text-white/50 text-sm leading-relaxed">無料鑑定は1日3回までご利用いただけます。アカウントを作成すると制限なく続けられます。</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setShowLimitModal(false); navigate('/auth?mode=register') }}
                className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-bold rounded-xl text-sm transition-all"
              >
                無料登録して続ける（3pt もらえる）
              </button>
              <button
                onClick={() => { setShowLimitModal(false); navigate('/auth') }}
                className="w-full py-2 text-white/30 hover:text-white/60 text-xs transition-colors"
              >
                ログインはこちら
              </button>
            </div>
            <p className="text-white/15 text-xs">明日また無料でご利用いただけます</p>
          </div>
        </div>
      )}

      {showSubModal && (
        <PayjpModal
          mode="subscription"
          title={`ポイントサブスク — ${SUBSCRIPTION_PLANS[showSubModal].label}`}
          amount={SUBSCRIPTION_PLANS[showSubModal].amount}
          pts={SUBSCRIPTION_PLANS[showSubModal].pts}
          isProcessing={isProcessingSub}
          error={subError}
          onToken={handleSubPayment}
          onClose={() => { setShowSubModal(null); setSubError('') }}
        />
      )}

      {/* ナビゲーションバー */}
      <nav className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-20" style={{ background: 'rgba(8,15,40,0.96)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={scrollToInput} className="flex items-center gap-2.5 group">
            <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
            <span className="text-white/80 text-sm font-bold tracking-tight group-hover:text-white transition-colors">宿命解析</span>
          </button>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                {isPremium ? (
                  <span className="text-xs bg-accent/20 text-accent rounded-full px-2 py-0.5 font-medium hidden sm:block">Premium</span>
                ) : (
                  <button onClick={() => navigate('/mypage')} className="text-xs bg-white/10 text-white/60 hover:bg-white/20 rounded-full px-2 py-0.5 font-mono transition-colors hidden sm:block">
                    {points} pt
                  </button>
                )}
                <button onClick={() => navigate('/mypage')} className="text-white/30 hover:text-white/60 text-xs transition-colors hidden sm:block">
                  マイページ
                </button>
                <button onClick={() => signOut()} className="text-white/30 hover:text-white/60 text-xs transition-colors">
                  ログアウト
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/auth')} className="text-white/50 hover:text-white/80 text-xs transition-colors">
                  ログイン
                </button>
                <button onClick={() => navigate('/auth?mode=register')} className="text-xs bg-accent hover:bg-accent-dark text-white rounded-full px-3 py-1 font-medium transition-colors">
                  新規登録
                </button>
              </div>
            )}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex flex-col justify-center gap-1.5 w-8 h-8 items-center"
              aria-label="メニュー"
            >
              <span className={`block w-5 h-px bg-white/50 transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block w-5 h-px bg-white/50 transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-px bg-white/50 transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
          </div>
        </div>

        {/* ドロップダウンメニュー */}
        {menuOpen && (
          <div className="border-t border-white/5" style={{ background: 'rgba(8,15,40,0.98)' }}>
            <div className="max-w-5xl mx-auto px-4 py-3 space-y-1">
              {[
                { label: '総合鑑定書を生成する', sub: '無料 · 登録不要', action: () => { scrollToInput(); setMenuOpen(false) } },
                { label: '詳細鑑定',             sub: 'AIに相談・自己分析・相性診断など', action: () => { chatRef.current?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false) } },
                { label: 'プランを購入する',      sub: '¥480/月〜 毎月ポイント付与', action: () => { pricingRef.current?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false) } },
                { label: 'FAQ',                  sub: 'よくある質問・解約について', action: () => { faqRef.current?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false) } },
                ...(user ? [{ label: 'マイページ', sub: '鑑定履歴・チャット記録', action: () => { navigate('/mypage'); setMenuOpen(false) } }] : []),
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/5 transition-colors text-left">
                  <div>
                    <p className="text-white/80 text-sm font-medium">{item.label}</p>
                    <p className="text-white/30 text-xs">{item.sub}</p>
                  </div>
                  <span className="text-white/20 text-xs">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-4">

        {/* ① ヒーローセクション */}
        <section className="pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 border border-accent/25 rounded-full px-4 py-1.5 mb-8" style={{ background: 'rgba(59,130,246,0.08)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-accent/90 text-xs font-medium tracking-wider">6占術 AI統合解析 · 完全無料</span>
          </div>

          <h1
            className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight"
            style={{ background: 'linear-gradient(135deg, #fff 40%, #93c5fd 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            6つの占術を掛け合わせた、<br />統計学鑑定の決定版。
          </h1>

          <p className="text-white/50 text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-10">
            生年月日を入力するだけ。性格・仕事・恋愛・転換期まで、全項目を無料で解析します。
          </p>

          <button
            onClick={scrollToInput}
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent hover:bg-accent-dark text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-accent/20 hover:shadow-accent/30"
          >
            <span>✦</span>
            <span>無料で鑑定書を生成する</span>
            <span className="text-white/60">→</span>
          </button>
          <p className="text-white/20 text-xs mt-3">登録不要 · 生年月日だけ</p>
        </section>

        {/* ★ 指南書プレビューセクション */}
        <section ref={inputRef} className="pb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.3))' }} />
            <span className="text-accent/60 text-xs italic tracking-widest uppercase">Preview — Page 1</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(201,168,76,0.3))' }} />
          </div>

          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-white font-bold text-xl sm:text-2xl mb-2">
                あなた専用の命式鑑定書を、今すぐ生成する
              </h2>
              <p className="text-white/40 text-sm">生年月日を入力するだけ。性格・仕事・恋愛・転換期まで、全項目を無料で解析します。</p>
            </div>

            <form onSubmit={handleGeneratePreview} className="glass-card p-6 space-y-5 border border-accent/15">
              {/* 生年月日 */}
              <div>
                <label className="text-white/50 text-xs mb-2 block">あなたの生年月日 <span className="text-accent">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  <select value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none w-full">
                    <option value="">年</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
                  <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none w-full">
                    <option value="">月</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
                  </select>
                  <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none w-full">
                    <option value="">日</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
                  </select>
                </div>
              </div>

              {/* 時間（任意） */}
              <div>
                <label className="text-white/50 text-xs mb-2 block">生まれた時間 <span className="text-white/25">（任意・より精密な分析に）</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.hour} onChange={e => setForm(f => ({ ...f, hour: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none w-full">
                    <option value="">不明</option>
                    {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}時</option>)}
                  </select>
                  <select value={form.minute} onChange={e => setForm(f => ({ ...f, minute: e.target.value }))}
                    className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none w-full">
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
                    <button key={g} type="button"
                      onClick={() => setForm(f => ({ ...f, gender: g }))}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                        form.gender === g
                          ? 'border-accent/60 bg-accent/15 text-accent'
                          : 'border-white/10 text-white/40 hover:text-white/60'
                      }`}>
                      {g === 'female' ? '女性' : '男性'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 相手情報トグル */}
              <div>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, showPartner: !f.showPartner }))}
                  className={`w-full py-2.5 rounded-lg text-xs font-medium border transition-all ${
                    form.showPartner
                      ? 'border-purple-400/40 bg-purple-400/10 text-purple-300'
                      : 'border-white/10 text-white/35 hover:text-white/55'
                  }`}>
                  {form.showPartner ? '▲ 相手の情報を入力中' : '＋ 相性を見たい相手の情報を入力する（任意）'}
                </button>
              </div>

              {/* 相手の情報（展開時） */}
              {form.showPartner && (
                <div className="space-y-4 p-4 rounded-lg border border-purple-400/15" style={{ background: 'rgba(167,139,250,0.05)' }}>
                  <div>
                    <label className="text-white/40 text-xs mb-2 block">相手の生年月日</label>
                    <div className="grid grid-cols-3 gap-2">
                      <select value={form.partnerYear} onChange={e => setForm(f => ({ ...f, partnerYear: e.target.value }))}
                        className="bg-navy-light border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400/40 appearance-none w-full">
                        <option value="">年</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
                      </select>
                      <select value={form.partnerMonth} onChange={e => setForm(f => ({ ...f, partnerMonth: e.target.value }))}
                        className="bg-navy-light border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400/40 appearance-none w-full">
                        <option value="">月</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
                      </select>
                      <select value={form.partnerDay} onChange={e => setForm(f => ({ ...f, partnerDay: e.target.value }))}
                        className="bg-navy-light border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400/40 appearance-none w-full">
                        <option value="">日</option>
                        {DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-2 block">相手の生まれた時間 <span className="text-white/20">（任意）</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={form.partnerHour} onChange={e => setForm(f => ({ ...f, partnerHour: e.target.value }))}
                        className="bg-navy-light border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none w-full">
                        <option value="">不明</option>
                        {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}時</option>)}
                      </select>
                      <select value={form.partnerMinute} onChange={e => setForm(f => ({ ...f, partnerMinute: e.target.value }))}
                        className="bg-navy-light border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none w-full">
                        <option value="">不明</option>
                        {MINUTES.map(min => <option key={min} value={min}>{String(min).padStart(2, '0')}分</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-2 block">相手の性別</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['female', 'male'] as const).map(g => (
                        <button key={g} type="button"
                          onClick={() => setForm(f => ({ ...f, partnerGender: g }))}
                          className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                            form.partnerGender === g
                              ? 'border-purple-400/50 bg-purple-400/10 text-purple-300'
                              : 'border-white/10 text-white/35 hover:text-white/55'
                          }`}>
                          {g === 'female' ? '女性' : '男性'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 特に確認したいこと */}
              <div>
                <label className="text-white/50 text-xs mb-2 block">特に確認したいこと <span className="text-white/25">（任意）</span></label>
                <textarea
                  value={form.question}
                  onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                  onBlur={() => setTimeout(() => document.getElementById('submit-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                  placeholder="例：転職のタイミングは？　仕事と家庭の両立について　今の恋愛はうまくいく？"
                  rows={3}
                  className="w-full bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 placeholder:text-white/20 resize-none leading-relaxed"
                />
              </div>

              {previewError && <p className="text-red-400 text-xs">{previewError}</p>}

              <button id="submit-btn" type="submit" disabled={!form.year || !form.month || !form.day || isStreaming}
                className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-bold rounded-lg text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {isStreaming ? (
                  <>
                    <div className="flex gap-1">
                      {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
                    </div>
                    鑑定書を生成中...
                  </>
                ) : '✦ 指南書を作る'}
              </button>
              <p className="text-white/20 text-xs text-center">無料 · 登録不要</p>
            </form>
          </div>
        </section>

        {/* ★ プレビュー表示（生成後） */}
        {(previewContent || isStreaming) && (
          <section ref={previewRef} className="pb-16">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.3))' }} />
              <span className="text-accent/60 text-xs italic tracking-widest">命式鑑定書</span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(201,168,76,0.3))' }} />
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="rounded-xl overflow-hidden border border-accent/20 shadow-2xl" style={{ background: '#0d1a3a' }}>

                {/* ── 表紙 ── */}
                <div className="px-8 pt-10 pb-8 text-center border-b border-white/5" style={{ background: 'linear-gradient(135deg, #0a1428 0%, #0d1a3a 100%)' }}>
                  <p className="text-accent/50 text-xs italic tracking-widest mb-4">MEISHIKI ANALYSIS — Confidential</p>
                  <h3 className="text-white font-bold text-2xl sm:text-3xl mb-2">命式鑑定書</h3>
                  <p className="text-accent/60 text-xs italic mb-6">Personal Fortune Analysis Report</p>
                  <p className="text-white/50 text-sm">{submittedLabel}</p>
                  <p className="text-white/25 text-xs mt-1">鑑定日　{new Date().toLocaleDateString('ja-JP')}</p>
                  <div className="flex justify-center gap-2 flex-wrap mt-6">
                    {[
                      { name: '四柱推命', color: '#f87171' }, { name: '算命学', color: '#60a5fa' },
                      { name: '宿曜', color: '#a78bfa' }, { name: '納音', color: '#f59e0b' },
                      { name: '数秘術', color: '#94a3b8' }, { name: '九星気学', color: '#4ade80' },
                    ].map(s => (
                      <span key={s.name} className="text-xs border rounded-full px-3 py-0.5 font-medium"
                        style={{ color: s.color, borderColor: `${s.color}40`, background: `${s.color}10` }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── 命式データパネル ── */}
                {calcData && (
                  <div className="px-8 py-6 border-b border-white/5" style={{ background: 'rgba(201,168,76,0.03)' }}>
                    <p className="text-accent/60 text-xs italic mb-4 border-l-2 border-accent/30 pl-3">命式データ — Fortune Data</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-white/25 text-xs mb-2">四柱推命</p>
                        <div className="flex flex-wrap gap-4">
                          {[
                            { label: '年柱', val: calcData.shichuYear },
                            { label: '月柱', val: calcData.shichuMonth },
                            { label: '日柱（命主）', val: calcData.shichuDay },
                            ...(calcData.shichuHour ? [{ label: '時柱', val: calcData.shichuHour }] : []),
                          ].map(({ label, val }) => (
                            <div key={label} className="text-center">
                              <p className="text-white/25 text-xs">{label}</p>
                              <p className="text-white font-bold text-base">{val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: '納音', val: calcData.nayin },
                          { label: '宿命星（算命学）', val: calcData.sanmeiStar },
                          { label: '天中殺', val: calcData.chusatsu },
                          { label: '宿曜', val: `${calcData.sukuyo}宿` },
                          { label: '運命数（数秘術）', val: String(calcData.lifePathNumber) },
                          { label: '本命星（九星気学）', val: calcData.honmeiName },
                        ].map(({ label, val }) => (
                          <div key={label} className="glass-card p-2.5">
                            <p className="text-white/25 text-xs mb-0.5">{label}</p>
                            <p className="text-white/80 text-sm font-medium">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 目次 ── */}
                <div className="px-8 py-6 border-b border-white/5">
                  <p className="text-accent/60 text-xs italic mb-4 border-l-2 border-accent/30 pl-3">目次 — Contents</p>
                  <div className="space-y-2">
                    {TOC_ITEMS.map(item => (
                      <div key={item.num} className="flex items-center gap-3">
                        <span className="text-white/25 text-xs font-mono w-5 flex-shrink-0 text-right">{item.num}</span>
                        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
                        <span className="text-white/60 text-xs flex-shrink-0">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 各章（ストリーミング表示） ── */}
                {parseSections(previewContent).map(({ title, body }, idx) => (
                  <div key={idx} className="px-8 py-6 border-b border-white/5">
                    {title && (
                      <p className="text-accent/70 text-xs italic mb-3 border-l-2 border-accent/30 pl-3">{title}</p>
                    )}
                    {body && (
                      <div className="text-white/75 text-sm leading-loose whitespace-pre-wrap">
                        {renderBold(body)}
                      </div>
                    )}
                  </div>
                ))}

                {/* ── 質問詳細回答（課金ロック / 表示） ── */}
                {submittedQuestion && !questionAnswer && !isAnswering && previewContent && !isStreaming && (
                  <div className="px-8 py-8 border-b border-white/5">
                    <p className="text-accent/70 text-xs italic mb-3 border-l-2 border-accent/30 pl-3">特に確認したいことへの回答</p>
                    <div className="rounded-lg p-5 border border-accent/15 text-center space-y-3" style={{ background: 'rgba(201,168,76,0.03)' }}>
                      <p className="text-white/50 text-sm">「{submittedQuestion.slice(0, 40)}{submittedQuestion.length > 40 ? '...' : ''}」</p>
                      <button
                        onClick={() => navigate('/auth?mode=register')}
                        className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-bold rounded-lg text-sm transition-all"
                      >
                        会員登録をして続きをみる
                      </button>
                    </div>
                    {qPaymentError && <p className="text-red-400 text-xs mt-2">{qPaymentError}</p>}
                  </div>
                )}

                {(questionAnswer || isAnswering) && (
                  <div className="px-8 py-6 border-b border-white/5">
                    <p className="text-accent/70 text-xs italic mb-3 border-l-2 border-accent/30 pl-3">特に確認したいことへの回答</p>
                    <div className="text-white/75 text-sm leading-loose whitespace-pre-wrap">
                      {renderBold(questionAnswer)}
                      {isAnswering && <span className="text-accent/40 text-xs ml-1">生成中...</span>}
                    </div>
                  </div>
                )}

                {/* ── ストリーミング中インジケーター ── */}
                {isStreaming && (
                  <div className="px-8 py-5 flex items-center gap-2">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                    ))}
                    <span className="text-accent/40 text-xs ml-1">生成中...</span>
                  </div>
                )}


              </div>
            </div>
          </section>
        )}

        {/* ③ 機能カード */}
        <section ref={featuresRef} className="pb-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4">
              <span className="text-white/40 text-xs font-medium tracking-widest uppercase">Features</span>
            </div>
            <h2 className="text-white font-bold text-2xl sm:text-3xl mb-2">詳細分析ツール</h2>
            <p className="text-white/35 text-sm">ポイントを使って各機能を利用できます</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 自由鑑定 */}
            <div ref={chatRef} className="glass-card-hover border flex flex-col gap-4 p-6"
              style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'linear-gradient(145deg, rgba(99,102,241,0.08) 0%, rgba(15,23,42,0.65) 70%)' }}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-accent flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <span className="text-xs font-mono font-medium text-accent opacity-60">3pt / 回</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-base mb-1">自由鑑定</h3>
                <p className="text-white/40 text-xs leading-relaxed">生年月日を入力して、気になることを自由に質問。複数の占術を統合してAIが回答します。</p>
              </div>
              <ul className="space-y-1.5 flex-1">
                {['自己分析・強み・適職', '相性・人間関係・職場', '仕事運・恋愛運・方位など何でも'].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-accent opacity-60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-white/40 text-xs">{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => user ? navigate('/analyze') : navigate('/auth?mode=register')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all text-accent border hover:opacity-90"
                style={{ borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)' }}
              >
                鑑定を始める →
              </button>
            </div>

            {/* AIチャット */}
            <div className="glass-card-hover border flex flex-col gap-4 p-6"
              style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'linear-gradient(145deg, rgba(59,130,246,0.06) 0%, rgba(15,23,42,0.65) 70%)' }}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-400 flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <span className="text-xs font-mono font-medium text-blue-400 opacity-60">2pt / 回</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-base mb-1">AIに何でも相談</h3>
                <p className="text-white/40 text-xs leading-relaxed">命式を記憶した命術師AIに仕事・恋愛・転機など何でも相談。会話形式で深掘りできます。</p>
              </div>
              <ul className="space-y-1.5 flex-1">
                {['テーマ・質問は何でもOK', '命式を踏まえた深い洞察', '会話履歴を記憶'].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-blue-400 opacity-60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-white/40 text-xs">{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => user ? navigate('/chat') : navigate('/auth?mode=register')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all text-blue-400 border hover:opacity-90"
                style={{ borderColor: 'rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.06)' }}
              >
                チャットを始める →
              </button>
            </div>
          </div>
        </section>

        {/* なぜ当たるか */}
        <section className="pb-16">
          <div className="glass-card p-8 border border-accent/15" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(8,15,40,0.8) 100%)' }}>
            <h2 className="text-white font-bold text-xl sm:text-2xl mb-5 leading-snug">
              なぜこの鑑定が当たるのか
            </h2>
            <p className="text-white/60 text-sm leading-loose mb-5">
              四柱推命・算命学・宿曜といった命理体系は、それぞれ数百〜数千年にわたり、膨大な人数の生涯データを照合しながら体系化されてきた<strong className="text-white/85">統計的なパターン集</strong>です。
              「生まれた日時」という変数に対して、性格・対人傾向・人生の転機がどう対応するかを記録し続けた、いわば古代の機械学習です。
            </p>
            <p className="text-white/60 text-sm leading-loose mb-5">
              この鑑定が精度を出せる理由はシンプルです。<strong className="text-white/85">6つの独立した体系を同時に照合し、一致した結論だけを抽出している</strong>から。
              1つの体系が「仕事に向いている」と言っても偶然かもしれない。しかし四柱推命・算命学・数秘術・九星気学の4つが同じ傾向を示すとき、それは統計的に無視できない信号です。
            </p>
            <p className="text-white/35 text-xs leading-loose border-l-2 border-accent/30 pl-4">
              各体系の計算はすべてアルゴリズムで行われます。AIは計算結果を受け取り、複数体系の一致点を言語化します。占い師の主観は介在しません。
            </p>
          </div>
        </section>

        {/* 口コミセクション */}
        <section className="pb-20">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4">
              <span className="text-white/40 text-xs font-medium tracking-widest uppercase">Reviews</span>
            </div>
            <h2 className="text-white font-bold text-2xl sm:text-3xl mb-2">ユーザーの声</h2>
            <p className="text-white/35 text-sm">鑑定書を受け取った方からのフィードバック</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { name: 'M.K', attr: '30代・女性', text: 'めちゃくちゃ当たってて鳥肌立ちました。転職を迷ってた時期がちゃんと「転機の年」として出ていて、背中を押してもらえた感じ。' },
              { name: 'T.N', attr: '20代・男性', text: '人生の転換期のところを読んで震えた。去年の出来事がそのまま書いてあって、もう信じるしかない状態です笑' },
              { name: 'A.S', attr: '30代・女性', text: '結婚相手の特徴が今の彼氏にドンピシャすぎて怖い。占いって曖昧なものだと思ってたけど、ここまで具体的だと話が違う。' },
              { name: 'R.H', attr: '40代・女性', text: '自分でも気づいてなかった「外面と内面のギャップ」の章が刺さりすぎて泣きました。人に見せたくなる内容。' },
              { name: 'K.O', attr: '20代・女性', text: '相性診断を彼と二人でやったら、「なぜ喧嘩になるか」がそのまま書いてあって二人で笑いながら納得。関係が少し楽になった気がします。' },
              { name: 'Y.M', attr: '30代・男性', text: '適職の部分が今の仕事と全然合ってなくて、転職を真剣に考え始めました。これだけで元が取れる内容だと思う。' },
            ].map((r, i) => (
              <div key={i} className="glass-card p-5 border border-white/5 flex flex-col gap-3 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-1">
                  {[0,1,2,3,4].map(s => (
                    <svg key={s} className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-white/60 text-sm leading-relaxed flex-1">「{r.text}」</p>
                <div className="flex items-center gap-2.5 pt-1 border-t border-white/5">
                  <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-accent/60 text-xs font-bold">{r.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-white/55 text-xs font-medium">{r.name} さん</p>
                    <p className="text-white/25 text-xs">{r.attr}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ④ 料金セクション */}
        <section ref={pricingRef} className="pb-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4">
              <span className="text-white/40 text-xs font-medium tracking-widest uppercase">Pricing</span>
            </div>
            <h2 className="text-white font-bold text-2xl sm:text-3xl mb-2">月額サブスクリプション</h2>
            <p className="text-white/35 text-sm">毎月ポイントが付与。詳細分析・AIチャット全機能に使えます</p>
            <p className="text-white/25 text-xs mt-1">登録すると 3pt 無料プレゼント · いつでも解約可能</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">

            {/* ライト */}
            <div className="relative glass-card flex flex-col overflow-hidden border border-blue-400/20"
              style={{ background: 'linear-gradient(145deg, rgba(96,165,250,0.08) 0%, rgba(8,15,40,0) 70%)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -translate-y-10 translate-x-10"
                style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />
              <div className="p-7 flex flex-col gap-6 flex-1">
                <div>
                  <p className="text-blue-300/60 text-xs font-medium tracking-widest uppercase mb-4">ライト</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-white font-bold font-mono" style={{ fontSize: '3rem', lineHeight: 1 }}>30</span>
                    <span className="text-blue-300 text-xl font-bold">pt</span>
                    <span className="text-white/30 text-sm">/月</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white/40 text-sm">¥</span>
                    <span className="text-white font-bold text-2xl">480</span>
                    <span className="text-white/30 text-sm">/月</span>
                  </div>
                  <p className="text-blue-300/50 text-xs mt-1 font-mono">1pt ≈ ¥16</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {[
                    ['詳細分析', '10回分（3pt/回）'],
                    ['AIチャット', '15回分（2pt/回）'],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between text-xs">
                      <span className="text-white/40">{k}</span>
                      <span className="text-white/60 font-medium">{v}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => user ? setShowSubModal('light') : navigate('/auth?mode=register')}
                  className="w-full py-3 rounded-xl text-sm font-semibold border border-blue-400/30 text-blue-300 hover:bg-blue-400/10 transition-all">
                  {user ? 'チャットを始める' : '登録して始める（3pt 無料）'}
                </button>
              </div>
            </div>

            {/* スタンダード（おすすめ） */}
            <div className="relative glass-card flex flex-col overflow-hidden border border-accent/40"
              style={{ background: 'linear-gradient(145deg, rgba(148,163,184,0.12) 0%, rgba(8,15,40,0) 70%)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -translate-y-10 translate-x-10"
                style={{ background: 'radial-gradient(circle, #94a3b8, transparent)' }} />
              <div className="absolute -top-px left-1/2 -translate-x-1/2">
                <span className="bg-accent text-white text-xs font-bold px-5 py-1 rounded-b-xl block">おすすめ</span>
              </div>
              <div className="p-7 pt-9 flex flex-col gap-6 flex-1">
                <div>
                  <p className="text-accent/60 text-xs font-medium tracking-widest uppercase mb-4">スタンダード</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-white font-bold font-mono" style={{ fontSize: '3rem', lineHeight: 1 }}>80</span>
                    <span className="text-accent text-xl font-bold">pt</span>
                    <span className="text-white/30 text-sm">/月</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white/40 text-sm">¥</span>
                    <span className="text-white font-bold text-2xl">980</span>
                    <span className="text-white/30 text-sm">/月</span>
                  </div>
                  <p className="text-accent/50 text-xs mt-1 font-mono">1pt ≈ ¥12 · 25%お得</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {[
                    ['詳細分析', '26回分（3pt/回）'],
                    ['AIチャット', '40回分（2pt/回）'],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between text-xs">
                      <span className="text-white/40">{k}</span>
                      <span className="text-white/70 font-medium">{v}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => user ? setShowSubModal('standard') : navigate('/auth?mode=register')}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-accent hover:bg-accent-dark text-white transition-all">
                  {user ? 'チャットを始める' : '登録して始める（3pt 無料）'}
                </button>
              </div>
            </div>

            {/* ヘビー */}
            <div className="relative glass-card flex flex-col overflow-hidden border border-violet-400/20"
              style={{ background: 'linear-gradient(145deg, rgba(167,139,250,0.08) 0%, rgba(8,15,40,0) 70%)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -translate-y-10 translate-x-10"
                style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
              <div className="p-7 flex flex-col gap-6 flex-1">
                <div>
                  <p className="text-violet-300/60 text-xs font-medium tracking-widest uppercase mb-4">ヘビー</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-white font-bold font-mono" style={{ fontSize: '3rem', lineHeight: 1 }}>200</span>
                    <span className="text-violet-300 text-xl font-bold">pt</span>
                    <span className="text-white/30 text-sm">/月</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white/40 text-sm">¥</span>
                    <span className="text-white font-bold text-2xl">1,980</span>
                    <span className="text-white/30 text-sm">/月</span>
                  </div>
                  <p className="text-violet-300/50 text-xs mt-1 font-mono">1pt ≈ ¥9.9 · 38%お得</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {[
                    ['詳細分析', '66回分（3pt/回）'],
                    ['AIチャット', '100回分（2pt/回）'],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between text-xs">
                      <span className="text-white/40">{k}</span>
                      <span className="text-white/60 font-medium">{v}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => user ? setShowSubModal('heavy') : navigate('/auth?mode=register')}
                  className="w-full py-3 rounded-xl text-sm font-semibold border border-violet-400/30 text-violet-300 hover:bg-violet-400/10 transition-all">
                  {user ? 'チャットを始める' : '登録して始める（3pt 無料）'}
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* ⑤ FAQセクション */}
        <section ref={faqRef} className="pb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.15))' }} />
            <span className="text-white/20 text-xs italic tracking-widest uppercase">FAQ</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(148,163,184,0.15))' }} />
          </div>

          <div className="space-y-3">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="glass-card p-4 space-y-2 border border-white/5">
                <p className="text-white/80 text-sm font-semibold">{q}</p>
                <p className="text-white/50 text-xs leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>


      </div>

      {/* フッター */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-3">
          <div className="flex justify-center gap-4">
            <button onClick={() => navigate('/tokushohou')} className="text-white/30 hover:text-white/50 text-xs transition-colors">
              特定商取引法に基づく表記
            </button>
          </div>
          <p className="text-white/15 text-xs italic">解析結果は意思決定の参考情報としてご活用ください</p>
        </div>
      </footer>

    </div>
  )
}
