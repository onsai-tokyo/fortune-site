import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FortuneData, ClientAnalysis, PartnerData } from '../../lib/types'
import { apiFetch } from '../../lib/api'
import { calcShichu } from '../../lib/shichu'
import { calcNayin } from '../../lib/nayin'
import { calcSanmei } from '../../lib/sanmei'
import { getSukuyo } from '../../lib/sukuyo'
import { useAuth } from '../../contexts/AuthContext'
import { saveAnalysis } from '../../lib/history'
import { addAnalyzedFeature } from '../../lib/analyzedFeatures'

interface Props { fortuneData: FortuneData }

const YEARS  = Array.from({ length: 107 }, (_, i) => 2026 - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1)

function ClientForm({ onSubmit }: { onSubmit: (p: PartnerData & { birthDate: string; gender: string }) => void }) {
  const [year,   setYear]   = useState('')
  const [month,  setMonth]  = useState('')
  const [day,    setDay]    = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !month || !day) return
    const y = Number(year), m = Number(month), d = Number(day)
    const shichu = calcShichu(y, m, d, undefined)
    const nayin  = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    const birthDate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    onSubmit({ shichu, nayin, sanmei, sukuyo, birthDate, gender })
  }

  return (
    <div className="glass-card border border-accent/15 p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 bg-accent rounded-full" />
        <h3 className="text-white font-semibold text-base">取引先担当者の情報を入力</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-white/50 text-xs mb-2 block">担当者の生年月日 <span className="text-accent">*</span></label>
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
          <label className="text-white/50 text-xs mb-2 block">担当者の性別 <span className="text-accent">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {(['female', 'male'] as const).map(g => (
              <button key={g} type="button" onClick={() => setGender(g)}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${gender === g ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/10 text-white/40 hover:text-white/60'}`}>
                {g === 'female' ? '女性' : '男性'}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={!year || !month || !day}
          className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-bold rounded-lg transition-all text-sm disabled:opacity-40">
          ✦ 取引先担当者を分析する
        </button>
      </form>
    </div>
  )
}

export function ClientTab({ fortuneData }: Props) {
  const navigate = useNavigate()
  const { user, refreshPoints } = useAuth()
  const [result,  setResult]  = useState<ClientAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [isPointInsufficient, setIsPointInsufficient] = useState(false)
  const [client, setClient] = useState<(PartnerData & { birthDate: string; gender: string }) | null>(null)

  async function runAnalysis(p: PartnerData & { birthDate: string; gender: string }) {
    setClient(p)
    setLoading(true)
    setError('')
    setIsPointInsufficient(false)
    try {
      console.log('[ClientTab] Starting analysis with client:', p)
      const { input, shichu, nayin, sanmei, sukuyo } = fortuneData
      const res = await apiFetch('/api/analyze/client', {
        method: 'POST',
        body: JSON.stringify({
          selfData:   { shichu, nayin, sanmei, sukuyo, birthDate: input.birthDate, gender: input.gender },
          clientData: { shichu: p.shichu, nayin: p.nayin, sanmei: p.sanmei, sukuyo: p.sukuyo, birthDate: p.birthDate, gender: p.gender },
        }),
      })
      console.log('[ClientTab] Response status:', res.status)
      if (res.status === 402) {
        setIsPointInsufficient(true)
        throw new Error('ポイントが不足しています')
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('[ClientTab] Error response:', errData)
        throw new Error(errData.error || `取引先分析に失敗しました（ステータス: ${res.status}）`)
      }
      const analysisResult = await res.json() as ClientAnalysis
      console.log('[ClientTab] Analysis result received')
      setResult(analysisResult)
      refreshPoints()
      // 鑑定済みフラグを保存
      addAnalyzedFeature(user?.id, 'client')
      if (user) {
        saveAnalysis(
          user.id,
          'client',
          fortuneData.input.birthDate,
          `取引先占い - ${fortuneData.input.birthDate} × ${p.birthDate}`,
          analysisResult
        ).catch(err => console.error('[ClientTab] Failed to save analysis:', err))
      }
    } catch (e) {
      console.error('[ClientTab] Error:', e)
      setError(e instanceof Error ? e.message : '取引先分析に失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex gap-1.5">{[0,1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
      <p className="text-white/40 text-sm">命式を照合中...</p>
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
        {client && <button onClick={() => runAnalysis(client)} className="text-purple-400 text-xs underline mr-4">再試行する</button>}
        <button onClick={() => { setError(''); setClient(null); setResult(null) }} className="text-purple-400 text-xs underline">再入力する</button>
      </div>
    )
  }
  if (!result) return <ClientForm onSubmit={runAnalysis} />

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 取引先タイプ */}
      <div className="glass-card border border-purple-500/15 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/25 text-xs italic mb-1">Client Analysis</p>
            <h3 className="text-white text-xl font-bold">{result.clientType}</h3>
          </div>
          <div className="text-right">
            <p className="text-white/20 text-xs mb-1">相性スコア</p>
            <span className="text-4xl font-bold font-mono text-purple-400">{result.chemistryWithYou.score}</span>
          </div>
        </div>
        <div className="bg-purple-400/8 border border-purple-400/20 rounded-lg px-4 py-3">
          <p className="text-white/50 text-xs mb-0.5">意思決定スタイル</p>
          <p className="text-white/80 text-sm leading-relaxed">{result.decisionStyle}</p>
        </div>
      </div>

      {/* 信頼を得るポイント */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-emerald-400 rounded-full" />
          <h3 className="text-white font-semibold">信頼を得るポイント</h3>
        </div>
        <div className="space-y-2">
          {result.trustFactors.map((t, i) => (
            <div key={i} className="flex items-start gap-2 bg-emerald-400/5 border border-emerald-400/15 rounded-lg p-3">
              <span className="text-emerald-400 text-xs mt-0.5">✓</span>
              <span className="text-white/70 text-sm">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* コミュニケーション傾向 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-blue-400 rounded-full" />
          <h3 className="text-white font-semibold">コミュニケーション傾向</h3>
        </div>
        <div className="space-y-3">
          {result.communicationPreferences.map((c, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-blue-300 font-semibold text-sm mb-2">{c.channel}</p>
              <p className="text-white/60 text-xs">{c.style}</p>
            </div>
          ))}
        </div>
      </div>

      {/* アプローチ戦略 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-purple-400 rounded-full" />
          <h3 className="text-white font-semibold">フェーズ別アプローチ戦略</h3>
        </div>
        <div className="space-y-3">
          {result.approachStrategies.map((a, i) => (
            <div key={i} className="bg-purple-400/5 border border-purple-400/15 rounded-lg p-4">
              <p className="text-purple-300 font-semibold text-sm mb-2">{a.phase}</p>
              <p className="text-white/60 text-xs">{a.strategy}</p>
            </div>
          ))}
        </div>
      </div>

      {/* タブー */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-red-400 rounded-full" />
          <h3 className="text-white font-semibold">避けるべきこと</h3>
        </div>
        <div className="space-y-2">
          {result.taboos.map((t, i) => (
            <div key={i} className="flex items-start gap-2 bg-red-400/5 border border-red-400/15 rounded-lg p-3">
              <span className="text-red-400 text-xs mt-0.5">✕</span>
              <span className="text-white/70 text-sm">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* あなたとの相性 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-amber-400 rounded-full" />
          <h3 className="text-white font-semibold">あなたとのシナジー</h3>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-lg p-4">
          <p className="text-white/70 text-sm leading-relaxed">{result.chemistryWithYou.description}</p>
        </div>
      </div>

      {/* 次のアクション */}
      <div className="glass-card border border-purple-400/20 p-6">
        <p className="text-purple-400 font-semibold text-sm mb-2">📌 次に取るべきアクション</p>
        <p className="text-white/80 text-sm leading-relaxed">{result.nextAction}</p>
      </div>

      <button onClick={() => { setResult(null); setClient(null) }} className="w-full py-2 text-white/20 hover:text-white/40 text-sm transition-colors">
        ← 別の取引先を分析
      </button>
    </div>
  )
}
