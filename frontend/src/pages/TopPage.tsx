import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PayjpModal } from '../components/PayjpModal'
import { useAuth } from '../contexts/AuthContext'
import { calcShichu, calcDaiyun, calcRyunen } from '../lib/shichu'
import { calcNayin } from '../lib/nayin'
import { calcSanmei } from '../lib/sanmei'
import { getSukuyo } from '../lib/sukuyo'
import { calcLifePathNumber } from '../lib/numerology'
import { calcHonmeiStar, calcTsukimeiStar, KYUSEI_NAMES } from '../lib/kyusei'
import { getArchetype, getSukuyoDetail } from '../lib/archetype'

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


const FREE_ITEMS = [
  '6占術 統合解析レポート（四柱推命・算命学・宿曜・納音・数秘術・九星気学）',
  '自己分析・相性診断・組織診断・採用分析',
  '回数制限なし・登録不要',
]

const CHAT_ITEMS = [
  '命式を記憶した命術師AIに何でも相談可能',
  '仕事・恋愛・転機・対人関係など無制限',
  'いつでも解約可能',
]

const FAQS = [
  { q: '本当に無料ですか？', a: 'はい、6占術の解析はすべて無料です。登録も不要です。有料なのはAIチャット相談（¥1,980/月）のみです。' },
  { q: '6つの占術が全部出るのですか？', a: 'はい。生年月日を入力するだけで四柱推命・算命学・宿曜・納音・数秘術・九星気学の6占術を同時に解析します。' },
  { q: 'AIチャットとは何ですか？', a: 'あなたの命式データを記憶した命術師AIに、仕事・恋愛・対人関係など何でも相談できます。月額¥1,980でいつでも解約可能です。' },
  { q: 'サブスクはいつでも解約できますか？', a: 'はい、いつでも解約できます。解約後も購入した期間の終了まで引き続きご利用いただけます。' },
  { q: '解約方法を教えてください', a: 'ログイン後、トップページの料金プランセクションにある「解約する」ボタンから即座に解約できます。解約後は即時にプレミアム機能が停止します。' },
]

const YEARS    = Array.from({ length: 107 }, (_, i) => 2026 - i)  // 2026〜1920
const MONTHS   = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS     = Array.from({ length: 31 }, (_, i) => i + 1)
const HOURS    = Array.from({ length: 24 }, (_, i) => i)
const MINUTES  = Array.from({ length: 60 }, (_, i) => i)

export function TopPage() {
  const navigate = useNavigate()
  const { user, session, isPremium, signOut, refreshSubscription } = useAuth()
  const inputRef    = useRef<HTMLDivElement>(null)
  const previewRef  = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const chatRef     = useRef<HTMLDivElement>(null)
  const pricingRef  = useRef<HTMLDivElement>(null)
  const faqRef      = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

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

  // サブスク課金フロー
  const [showSubModal, setShowSubModal] = useState(false)
  const [isProcessingSub, setIsProcessingSub] = useState(false)
  const [subError, setSubError] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // 鑑定済みフラグ（localStorage）
  const [analyzedFeatures] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('analyzed_features') ?? '[]') } catch { return [] }
  })

  async function handleCancelSubscription() {
    setShowCancelConfirm(false)
    setIsCancelling(true)
    try {
      const res = await fetch('/api/payment/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      })
      if (!res.ok) throw new Error('解約に失敗しました')
      await refreshSubscription()
    } catch (err) {
      alert(err instanceof Error ? err.message : '解約に失敗しました')
    } finally { setIsCancelling(false) }
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

    // キャッシュヒット → API不要
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      setPreviewContent(cached)
      setPreviewError('')
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
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
        const err = await res.json() as { error?: string }
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
              fullContent += parsed.delta.text
              setPreviewContent(prev => prev + parsed.delta!.text!)
              if (firstChunk) {
                firstChunk = false
                setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // 生成完了 → キャッシュ保存
      if (fullContent) {
        try { localStorage.setItem(cacheKey, fullContent) } catch { /* localStorage 容量超過時は無視 */ }
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setIsStreaming(false)
    }
  }

  async function handleSubscriptionPayment(payjpToken: string) {
    setIsProcessingSub(true); setSubError('')
    try {
      const res = await fetch('/api/payment/subscribe-monthly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ payjpToken }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? '決済に失敗しました')
      setShowSubModal(false)
      await refreshSubscription()
      navigate('/payment/success')
    } catch (err) {
      setSubError(err instanceof Error ? err.message : '決済に失敗しました')
    } finally { setIsProcessingSub(false) }
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

      {showSubModal && (
        <PayjpModal
          mode="subscription"
          title="AIに何でも相談 — 月額プラン"
          amount={1980}
          isProcessing={isProcessingSub}
          error={subError}
          onToken={handleSubscriptionPayment}
          onClose={() => { setShowSubModal(false); setSubError('') }}
        />
      )}

      {/* ナビゲーションバー */}
      <nav className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-20" style={{ background: 'rgba(8,15,40,0.95)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                {isPremium && (
                  <span className="text-xs bg-accent/20 text-accent rounded-full px-2 py-0.5 font-medium hidden sm:block">Premium</span>
                )}
                <button onClick={() => navigate('/mypage')} className="text-white/30 hover:text-white/60 text-xs transition-colors hidden sm:block">
                  マイページ
                </button>
                <button onClick={() => signOut()} className="text-white/30 hover:text-white/60 text-xs transition-colors">
                  ログアウト
                </button>
              </div>
            ) : (
              <button onClick={() => navigate('/auth')} className="text-white/50 hover:text-white/80 text-xs transition-colors">
                ログイン
              </button>
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
                { label: 'プランを購入する',      sub: '月額¥1,980 相談し放題', action: () => { pricingRef.current?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false) } },
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
        <section className="py-20 text-center">
          <div className="inline-flex items-center gap-2 border border-accent/20 rounded-full px-4 py-1.5 mb-8 bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-accent text-xs font-medium tracking-wider">6占術 統合解析 · すべて無料</span>
          </div>

          <h1
            className="text-4xl sm:text-6xl font-bold tracking-tight mb-5 font-serif leading-tight"
            style={{ background: 'linear-gradient(135deg, #fff 40%, #93c5fd 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            6つの占術を掛け合わせた、<br />統計学鑑定の決定版。
          </h1>
          <p className="text-white/50 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-3">
            四柱推命・算命学・宿曜・納音・数秘術・九星気学——<br />
            6つの占術をAIが同時解析し、交差する答えだけを抽出する。
          </p>
          <p className="text-white/30 text-sm leading-relaxed max-w-xl mx-auto mb-10">
            ひとつの占術では「たまたま」かもしれない。<br />
            6つが同じことを指すとき、それはもう偶然ではない。
          </p>

        </section>

        {/* ★ 指南書プレビューセクション */}
        <section ref={inputRef} className="pb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.3))' }} />
            <span className="text-accent/60 text-xs font-garamond italic tracking-widest uppercase">Preview — Page 1</span>
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
                  placeholder="例：転職のタイミングは？　仕事と家庭の両立について　今の恋愛はうまくいく？"
                  rows={3}
                  className="w-full bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 placeholder:text-white/20 resize-none leading-relaxed"
                />
              </div>

              {previewError && <p className="text-red-400 text-xs">{previewError}</p>}

              <button type="submit" disabled={!form.year || !form.month || !form.day || isStreaming}
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
              <span className="text-accent/60 text-xs font-garamond italic tracking-widest">命式鑑定書</span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(201,168,76,0.3))' }} />
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="rounded-xl overflow-hidden border border-accent/20 shadow-2xl" style={{ background: '#0d1a3a' }}>

                {/* ── 表紙 ── */}
                <div className="px-8 pt-10 pb-8 text-center border-b border-white/5" style={{ background: 'linear-gradient(135deg, #0a1428 0%, #0d1a3a 100%)' }}>
                  <p className="text-accent/50 text-xs font-garamond italic tracking-widest mb-4">MEISHIKI ANALYSIS — Confidential</p>
                  <h3 className="text-white font-bold text-2xl sm:text-3xl font-serif mb-2">命式鑑定書</h3>
                  <p className="text-accent/60 text-xs font-garamond italic mb-6">Personal Fortune Analysis Report</p>
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
                    <p className="text-accent/60 text-xs font-garamond italic mb-4 border-l-2 border-accent/30 pl-3">命式データ — Fortune Data</p>
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
                              <p className="text-white font-bold text-base font-serif">{val}</p>
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
                  <p className="text-accent/60 text-xs font-garamond italic mb-4 border-l-2 border-accent/30 pl-3">目次 — Contents</p>
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
                      <p className="text-accent/70 text-xs font-garamond italic mb-3 border-l-2 border-accent/30 pl-3">{title}</p>
                    )}
                    {body && (
                      <div className="text-white/75 text-sm leading-loose font-serif whitespace-pre-wrap">
                        {renderBold(body)}
                      </div>
                    )}
                  </div>
                ))}

                {/* ── 質問詳細回答（課金ロック / 表示） ── */}
                {submittedQuestion && !questionAnswer && !isAnswering && previewContent && !isStreaming && (
                  <div className="px-8 py-8 border-b border-white/5">
                    <p className="text-accent/70 text-xs font-garamond italic mb-3 border-l-2 border-accent/30 pl-3">特に確認したいことへの回答</p>
                    <div className="rounded-lg p-5 border border-accent/15 text-center space-y-3" style={{ background: 'rgba(201,168,76,0.03)' }}>
                      <p className="text-white/50 text-sm">「{submittedQuestion.slice(0, 40)}{submittedQuestion.length > 40 ? '...' : ''}」</p>
                      <p className="text-white/35 text-xs">命式データをもとに600〜900文字の詳細回答を生成します</p>
                      <button
                        onClick={() => user ? setShowQuestionModal(true) : navigate('/auth?mode=register')}
                        className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-bold rounded-lg text-sm transition-all"
                      >
                        {user ? '¥500 で詳細回答を見る（1回限り）' : 'ログインして詳細回答を見る'}
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-white/25 text-xs">または</span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                      {isPremium ? (
                        <p className="text-accent text-sm font-semibold text-center py-2">✓ プレミアム会員として登録済みです</p>
                      ) : (
                        <>
                          <button
                            onClick={() => user ? setShowSubModal(true) : navigate('/auth?mode=register')}
                            className="w-full py-3 border border-accent/30 text-accent hover:border-accent/60 rounded-lg text-sm font-semibold transition-all"
                          >
                            {user ? '月額プランを購入する（¥1,980/月）' : 'ログインして月額プランを購入する'}
                          </button>
                          <p className="text-white/25 text-xs">仕事・恋愛・転機など何でも何度でも相談できる月額プラン</p>
                        </>
                      )}
                    </div>
                    {qPaymentError && <p className="text-red-400 text-xs mt-2">{qPaymentError}</p>}
                  </div>
                )}

                {(questionAnswer || isAnswering) && (
                  <div className="px-8 py-6 border-b border-white/5">
                    <p className="text-accent/70 text-xs font-garamond italic mb-3 border-l-2 border-accent/30 pl-3">特に確認したいことへの回答</p>
                    <div className="text-white/75 text-sm leading-loose font-serif whitespace-pre-wrap">
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
        <section ref={featuresRef} className="pb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.15))' }} />
            <span className="text-white/20 text-xs font-garamond italic tracking-widest uppercase">More Features</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(148,163,184,0.15))' }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: 'chat',     label: 'AIに何でも相談', sub: '月額¥1,980 · 鑑定し放題',    dot: 'bg-accent',      border: 'border-accent/20',      bg: 'from-accent/10',      btn: 'bg-accent/20 hover:bg-accent/30 text-accent',               description: 'テーマ自由。恋愛・仕事・転機・人間関係など気になることを命術師AIに相談。月額¥1,980で何度でも。', items: ['テーマ・質問は何でもOK', '命式を踏まえた深い洞察', 'いつでも解約可能'] },
              { id: 'self',     label: '自己分析',       sub: 'Self Analysis',        dot: 'bg-blue-400',    border: 'border-blue-500/20',    bg: 'from-blue-500/10',    btn: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300',         description: '強み・弱み・適職・人生転換期を5つの占術から解析。',         items: ['強み指数スコア', '適職マッチ分析', '人生転換期予測'] },
              { id: 'compat',   label: '相性診断',       sub: 'Compatibility',        dot: 'bg-pink-400',    border: 'border-pink-500/20',    bg: 'from-pink-500/10',    btn: 'bg-pink-500/20 hover:bg-pink-500/30 text-pink-300',         description: '仕事・恋愛それぞれの相性スコアと関係性タイプを解析。',       items: ['仕事相性スコア', '恋愛相性スコア', '関係改善アドバイス'] },
              { id: 'marriage', label: '結婚相性',       sub: 'Marriage',             dot: 'bg-rose-400',    border: 'border-rose-500/20',    bg: 'from-rose-500/10',    btn: 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300',         description: '結婚生活の実態・力関係・うまくいくコツを命式から解析。',   items: ['結婚生活スタイル', '力関係・主導権', 'うまくいくコツ'] },
              { id: 'org',      label: '組織診断',       sub: 'Organization',         dot: 'bg-emerald-400', border: 'border-emerald-500/20', bg: 'from-emerald-500/10', btn: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300', description: 'キーマン特定・戦い方・人間関係マトリクスを一括解析。',      items: ['キーマン特定', '組織の戦い方', '人間関係マトリクス'] },
              { id: 'recruit',  label: '採用・他己分析', sub: 'Recruitment Analysis', dot: 'bg-violet-400',  border: 'border-violet-500/20',  bg: 'from-violet-500/10',  btn: 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300',   description: '候補者の命式から強み・適性・面接官との相性を解析。',         items: ['候補者強み分析', '面接質問提案', 'あなたとの相性'] },
            ].map((f, i) => (
              <div key={f.id} ref={f.id === 'chat' ? chatRef : undefined} className={`glass-card border ${f.border} bg-gradient-to-br ${f.bg} to-transparent p-6 flex flex-col gap-4`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-1 h-5 rounded-full ${f.dot}`} />
                    <div>
                      <p className="text-white/25 text-xs font-garamond italic">{f.sub}</p>
                      <h3 className="text-white font-bold text-base">{f.label}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.id !== 'chat' && analyzedFeatures.includes(f.id) && (
                      <span className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">鑑定済</span>
                    )}
                    <span className="text-white/10 font-mono text-xs">0{i + 1}</span>
                  </div>
                </div>
                <p className="text-white/40 text-xs leading-relaxed flex-1">{f.description}</p>
                <div className="space-y-1 mb-1">
                  {f.items.map(item => (
                    <div key={item} className="flex items-center gap-1.5">
                      <div className={`w-1 h-1 rounded-full ${f.dot} opacity-50`} />
                      <span className="text-white/35 text-xs">{item}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => f.id === 'chat'
                    ? (isPremium ? navigate('/chat') : (user ? setShowSubModal(true) : navigate('/auth?mode=register')))
                    : navigate(`/feature/${f.id}`)
                  }
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold border border-white/10 transition-all ${f.btn}`}
                >
                  {f.id === 'chat' ? (isPremium ? '命術師に相談する →' : '購入する') : `${f.label}を試す →`}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* なぜ当たるか */}
        <section className="pb-16">
          <div className="glass-card p-8 border border-accent/15" style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.05) 0%, rgba(8,15,40,0.8) 100%)' }}>
            <h2 className="text-white font-bold text-xl sm:text-2xl font-serif mb-5 leading-snug">
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
        <section className="pb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.15))' }} />
            <span className="text-white/20 text-xs font-garamond italic tracking-widest uppercase">Reviews</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(148,163,184,0.15))' }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { name: 'M.K さん', attr: '30代・女性', text: 'めちゃくちゃ当たってて鳥肌立ちました。転職を迷ってた時期がちゃんと「転機の年」として出ていて、背中を押してもらえた感じ。' },
              { name: 'T.N さん', attr: '20代・男性', text: '人生の転換期のところを読んで震えた。去年の出来事がそのまま書いてあって、もう信じるしかない状態です笑' },
              { name: 'A.S さん', attr: '30代・女性', text: '結婚相手の特徴が今の彼氏にドンピシャすぎて怖い。占いって曖昧なものだと思ってたけど、ここまで具体的だと話が違う。' },
              { name: 'R.H さん', attr: '40代・女性', text: '自分でも気づいてなかった「外面と内面のギャップ」の章が刺さりすぎて泣きました。人に見せたくなる内容。' },
              { name: 'K.O さん', attr: '20代・女性', text: '相性診断を彼と二人でやったら、「なぜ喧嘩になるか」がそのまま書いてあって二人で笑いながら納得。関係が少し楽になった気がします。' },
              { name: 'Y.M さん', attr: '30代・男性', text: '適職の部分が今の仕事と全然合ってなくて、転職を真剣に考え始めました。これだけで元が取れる内容だと思う。' },
            ].map((r, i) => (
              <div key={i} className="glass-card p-5 border border-white/5 flex flex-col gap-3">
                <div className="flex gap-1">
                  {[0,1,2,3,4].map(s => <span key={s} className="text-accent text-xs">★</span>)}
                </div>
                <p className="text-white/65 text-sm leading-relaxed flex-1">「{r.text}」</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-white/30 text-xs">{r.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs font-medium">{r.name}</p>
                    <p className="text-white/25 text-xs">{r.attr}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ④ 料金セクション */}
        <section ref={pricingRef} className="pb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.15))' }} />
            <span className="text-white/20 text-xs font-garamond italic tracking-widest uppercase">Pricing</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(148,163,184,0.15))' }} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* 無料プラン */}
            <div className="glass-card p-6 flex flex-col gap-4 border border-white/5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs bg-white/10 text-white/50 rounded-full px-2 py-0.5 font-medium">完全無料</span>
                  <p className="text-white font-bold text-base mt-2">全占術 解析</p>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className="text-white font-bold text-3xl">¥0</span>
                  </div>
                  <p className="text-white/30 text-xs">登録不要</p>
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {FREE_ITEMS.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-white/40 mt-1.5 flex-shrink-0" />
                    <span className="text-white/60 text-xs leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <button onClick={scrollToInput}
                className="w-full py-3 border border-white/15 text-white/60 hover:text-white/80 rounded-lg text-sm font-semibold transition-all">
                無料で今すぐ診断する →
              </button>
            </div>

            {/* チャットプラン */}
            <div className="glass-card p-6 flex flex-col gap-4 border border-accent/30" style={{ background: 'rgba(148,163,184,0.07)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs bg-accent/20 text-accent rounded-full px-2 py-0.5 font-medium">AIチャット</span>
                  <p className="text-white font-bold text-base mt-2">命術師AI 相談プラン</p>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className="text-white/40 text-sm">¥</span>
                    <span className="text-white font-bold text-3xl">1,980</span>
                  </div>
                  <p className="text-white/30 text-xs">/月（税込）</p>
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {CHAT_ITEMS.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                    <span className="text-white/60 text-xs leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              {isPremium ? (
                <div className="space-y-2">
                  <button onClick={scrollToInput}
                    className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all">
                    今すぐ鑑定する →
                  </button>
                  {showCancelConfirm ? (
                    <div className="border border-red-500/30 rounded-lg p-3 space-y-2 bg-red-500/5">
                      <p className="text-white/60 text-xs leading-relaxed">解約するとプレミアム機能が即座に停止します。本当に解約しますか？</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowCancelConfirm(false)}
                          className="flex-1 py-1.5 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-lg transition-colors">
                          キャンセル
                        </button>
                        <button onClick={handleCancelSubscription} disabled={isCancelling}
                          className="flex-1 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg transition-colors disabled:opacity-40">
                          {isCancelling ? '処理中...' : '解約を確定する'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowCancelConfirm(true)} disabled={isCancelling}
                      className="w-full py-2 text-white/20 hover:text-white/40 text-xs transition-colors">
                      解約する
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => user ? setShowSubModal(true) : navigate('/auth?mode=register')}
                  className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all">
                  {user ? '購入する' : 'ログインして購入する'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ⑤ FAQセクション */}
        <section ref={faqRef} className="pb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.15))' }} />
            <span className="text-white/20 text-xs font-garamond italic tracking-widest uppercase">FAQ</span>
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
        <div className="max-w-5xl mx-auto px-4 text-center text-white/15 text-xs font-garamond italic">
          <p>解析結果は意思決定の参考情報としてご活用ください</p>
        </div>
      </footer>

    </div>
  )
}
