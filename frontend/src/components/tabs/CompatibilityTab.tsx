import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FortuneData, CompatibilityAnalysis, PartnerData } from '../../lib/types'
import { apiFetch } from '../../lib/api'
import { calcShichu } from '../../lib/shichu'
import { calcNayin } from '../../lib/nayin'
import { calcSanmei } from '../../lib/sanmei'
import { getSukuyo } from '../../lib/sukuyo'
import { useAuth } from '../../contexts/AuthContext'
import { saveAnalysis } from '../../lib/history'
import { addAnalyzedFeature } from '../../lib/analyzedFeatures'

interface Props {
  fortuneData: FortuneData
}

type SubTab = 'work' | 'romantic'

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? '#34d399' : score >= 65 ? '#60a5fa' : '#fbbf24'
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 32}`}
            strokeDashoffset={`${2 * Math.PI * 32 * (1 - score / 100)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold font-mono text-white">{score}</span>
        </div>
      </div>
      <span className="text-white/40 text-xs">{label}</span>
    </div>
  )
}

function CompatResult({ data, sub }: { data: CompatibilityAnalysis; sub: SubTab }) {
  const section = sub === 'work' ? data.work : data.romantic
  const label = sub === 'work' ? '仕事相性' : '恋愛相性'

  return (
    <div className="space-y-4 animate-fade-in">
      {/* スコア表示 */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-around mb-4">
          <ScoreRing score={data.overall} label="総合スコア" />
          <ScoreRing score={data.work.score} label="仕事相性" />
          <ScoreRing score={data.romantic.score} label="恋愛相性" />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-center">
          <p className="text-white/40 text-xs mb-1">関係性タイプ</p>
          <p className="text-white font-semibold text-sm">{data.dynamic}</p>
        </div>
      </div>

      {/* 詳細 */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-1 h-5 rounded-full ${sub === 'work' ? 'bg-blue-400' : 'bg-pink-400'}`} />
          <h3 className="text-white font-semibold text-base">{label}詳細</h3>
          <span className="ml-auto text-white/20 font-bold font-mono text-lg">{section.score}</span>
        </div>

        <p className="text-white/70 text-sm leading-relaxed">{section.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-emerald-400 text-xs font-medium mb-2">強み</p>
            {section.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <span className="text-emerald-400 text-xs mt-0.5">+</span>
                <span className="text-white/60 text-xs">{s}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-amber-400 text-xs font-medium mb-2">注意点</p>
            {section.challenges.map((c, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <span className="text-amber-400 text-xs mt-0.5">△</span>
                <span className="text-white/60 text-xs">{c}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
          <p className="text-white/40 text-xs mb-1">アドバイス</p>
          <p className="text-white/80 text-sm">{section.advice}</p>
        </div>
      </div>
    </div>
  )
}

function PartnerForm({ onSubmit }: { onSubmit: (partner: PartnerData & { birthDate: string; gender: string }) => void }) {
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('female')

  const YEARS = Array.from({ length: 107 }, (_, i) => 2026 - i)
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
  const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !month || !day) return
    const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const [y, m, d] = [Number(year), Number(month), Number(day)]
    const shichu = calcShichu(y, m, d, undefined)
    const nayin = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    onSubmit({ shichu, nayin, sanmei, sukuyo, birthDate, gender })
  }

  return (
    <div className="glass-card p-6 border border-accent/15">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 bg-accent rounded-full" />
        <h3 className="text-white font-semibold text-base">相手の情報を入力</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-white/50 text-xs mb-2 block">相手の生年月日 <span className="text-accent">*</span></label>
          <div className="grid grid-cols-3 gap-2">
            <select value={year} onChange={e => setYear(e.target.value)}
              className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none">
              <option value="">年</option>
              {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none">
              <option value="">月</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
            <select value={day} onChange={e => setDay(e.target.value)}
              className="bg-navy-light border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 appearance-none">
              <option value="">日</option>
              {DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-white/50 text-xs mb-2 block">相手の性別 <span className="text-accent">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {(['female', 'male'] as const).map(g => (
              <button
                key={g} type="button"
                onClick={() => setGender(g)}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${gender === g ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/10 text-white/40 hover:text-white/60'}`}
              >
                {g === 'female' ? '女性' : '男性'}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={!year || !month || !day}
          className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-bold rounded-lg transition-all text-sm disabled:opacity-40"
        >
          ✦ 相性を診断する
        </button>
      </form>
    </div>
  )
}

export function CompatibilityTab({ fortuneData }: Props) {
  const navigate = useNavigate()
  const { user, refreshPoints } = useAuth()
  const [result, setResult] = useState<CompatibilityAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPointInsufficient, setIsPointInsufficient] = useState(false)
  const [subTab, setSubTab] = useState<SubTab>('work')
  const [partnerBirthDate, setPartnerBirthDate] = useState('')
  const [partnerGender, setPartnerGender] = useState<'male' | 'female'>('female')
  const [submittedPartnerBlock, setSubmittedPartnerBlock] = useState<PartnerData & { birthDate: string; gender: string } | null>(null)

  function saveAndOpenReport(r: CompatibilityAnalysis, pBirthDate: string, pGender: string) {
    const reportData = {
      result: r,
      self: {
        birthDate: fortuneData.input.birthDate,
        gender: fortuneData.input.gender,
        shichuDay: fortuneData.shichu.day.kanshi,
      },
      partner: {
        birthDate: pBirthDate,
        gender: pGender,
        shichuDay: '', // partnerブロックから取得
      },
      generatedAt: new Date().toISOString(),
    }
    // partnerの日柱を取得
    if (fortuneData.partner) {
      reportData.partner.shichuDay = fortuneData.partner.shichu.day.kanshi
    } else if (pBirthDate) {
      const [y, m, d] = pBirthDate.split('-').map(Number)
      const shichu = calcShichu(y, m, d, undefined)
      reportData.partner.shichuDay = shichu.day.kanshi
    }
    localStorage.setItem('compat_report_data', JSON.stringify(reportData))
    navigate('/compat-report')
  }

  async function runAnalysis(partnerBlock?: PartnerData & { birthDate: string; gender: string }) {
    setLoading(true)
    setError('')
    setIsPointInsufficient(false)
    if (partnerBlock) {
      setPartnerBirthDate(partnerBlock.birthDate)
      setPartnerGender(partnerBlock.gender as 'male' | 'female')
      setSubmittedPartnerBlock(partnerBlock)
    }
    try {
      console.log('[CompatibilityTab] Starting analysis with partnerBlock:', partnerBlock)
      const res = await apiFetch('/api/analyze/compatibility', {
        method: 'POST',
        body: JSON.stringify({ fortuneData, partnerBlock }),
      })
      console.log('[CompatibilityTab] Response status:', res.status)
      if (res.status === 402) {
        setIsPointInsufficient(true)
        throw new Error('ポイントが不足しています')
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('[CompatibilityTab] Error response:', errData)
        throw new Error(errData.error || `相性診断に失敗しました（ステータス: ${res.status}）`)
      }
      const analysisResult = await res.json() as CompatibilityAnalysis
      console.log('[CompatibilityTab] Analysis result received')
      setResult(analysisResult)
      refreshPoints()
      // 鑑定済みフラグを保存
      addAnalyzedFeature(user?.id, 'compat')
      if (user && partnerBlock) {
        saveAnalysis(
          user.id,
          'compat',
          fortuneData.input.birthDate,
          `相性診断 - ${fortuneData.input.birthDate} × ${partnerBlock.birthDate}`,
          analysisResult
        ).catch(err => console.error('[CompatibilityTab] Failed to save analysis:', err))
      }
    } catch (e) {
      console.error('[CompatibilityTab] Error:', e)
      setError(e instanceof Error ? e.message : '相性診断に失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  // 既存のパートナーデータがあれば自動実行
  const [autoRan, setAutoRan] = useState(false)
  if (fortuneData.partner && !autoRan && !loading && !result) {
    setAutoRan(true)
    runAnalysis()
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="text-white/40 text-sm">相性を解析中...</p>
    </div>
  )

  if (error) {
    if (isPointInsufficient) {
      return (
        <div className="glass-card border border-amber-400/20 p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-amber-400/30 bg-amber-400/10 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-amber-400 font-semibold text-base mb-2">ポイントが不足しています</p>
            <p className="text-white/60 text-sm mb-1">この分析には <span className="text-accent font-semibold">3ポイント</span> が必要です</p>
            <p className="text-white/40 text-xs">ポイントを購入してご利用ください</p>
          </div>
          <button
            onClick={() => navigate('/?section=pricing')}
            className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all"
          >
            ポイントを購入する
          </button>
        </div>
      )
    }
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={() => runAnalysis(submittedPartnerBlock || undefined)} className="text-accent text-xs underline">再試行する</button>
      </div>
    )
  }

  if (!result && !fortuneData.partner) {
    return <PartnerForm onSubmit={runAnalysis} />
  }

  if (!result) return null

  return (
    <div className="space-y-4 animate-fade-in">
      {/* サブタブ */}
      <div className="flex border-b border-navy-light">
        {([['work', '仕事の相性'], ['romantic', '恋愛・プライベート']] as [SubTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${subTab === id ? 'border-accent text-accent' : 'border-transparent text-white/40 hover:text-white/60'}`}
          >
            {label}
          </button>
        ))}
        {!fortuneData.partner && (
          <button
            onClick={() => { setResult(null); setAutoRan(false) }}
            className="ml-auto text-white/20 text-xs hover:text-white/40 pr-1"
          >
            再入力
          </button>
        )}
      </div>

      <CompatResult data={result} sub={subTab} />

      {/* レポート保存ボタン */}
      <div className="pt-2">
        <button
          onClick={() => {
            const pDate = fortuneData.input.partnerBirthDate || partnerBirthDate
            const pGender = fortuneData.input.partnerGender || partnerGender
            saveAndOpenReport(result, pDate, pGender)
          }}
          className="w-full py-3 rounded-xl text-sm font-semibold border border-pink-400/30 text-pink-300 hover:bg-pink-400/10 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          レポートをPDFで保存する
        </button>
      </div>
    </div>
  )
}
