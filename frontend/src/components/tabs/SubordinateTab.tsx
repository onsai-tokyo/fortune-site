import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FortuneData, SubordinateAnalysis, PartnerData } from '../../lib/types'
import { apiFetch, calculatePerson } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { saveAnalysis } from '../../lib/history'
import { addAnalyzedFeature } from '../../lib/analyzedFeatures'

interface Props { fortuneData: FortuneData; onSaved?: (id: string) => void }

const YEARS  = Array.from({ length: 107 }, (_, i) => 2026 - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1)

function SubordinateForm({ onSubmit }: { onSubmit: (p: PartnerData & { birthDate: string; gender: string }) => void }) {
  const [year,   setYear]   = useState('')
  const [month,  setMonth]  = useState('')
  const [day,    setDay]    = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !month || !day) return
    const y = Number(year), m = Number(month), d = Number(day)
    const birthDate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    onSubmit({ ...await calculatePerson(birthDate, gender), birthDate, gender })
  }

  return (
    <div className="glass-card border border-accent/15 p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 bg-accent rounded-full" />
        <h3 className="text-white font-semibold text-base">部下の情報を入力</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-white/50 text-xs mb-2 block">部下の生年月日 <span className="text-accent">*</span></label>
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
          <label className="text-white/50 text-xs mb-2 block">部下の性別 <span className="text-accent">*</span></label>
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
          ✦ 部下の特性を診断する
        </button>
      </form>
    </div>
  )
}

export function SubordinateTab({ fortuneData, onSaved }: Props) {
  const navigate = useNavigate()
  const { user, refreshPoints } = useAuth()
  const [result,  setResult]  = useState<SubordinateAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [isPointInsufficient, setIsPointInsufficient] = useState(false)
  const [subordinate, setSubordinate] = useState<(PartnerData & { birthDate: string; gender: string }) | null>(null)

  async function runAnalysis(p: PartnerData & { birthDate: string; gender: string }) {
    setSubordinate(p)
    setLoading(true)
    setError('')
    setIsPointInsufficient(false)
    try {
      console.log('[SubordinateTab] Starting analysis with subordinate:', p)
      const { input, shichu, nayin, sanmei, sukuyo } = fortuneData
      const res = await apiFetch('/api/analyze/subordinate', {
        method: 'POST',
        body: JSON.stringify({
          selfData:        { shichu, nayin, sanmei, sukuyo, birthDate: input.birthDate, gender: input.gender },
          subordinateData: { shichu: p.shichu, nayin: p.nayin, sanmei: p.sanmei, sukuyo: p.sukuyo, birthDate: p.birthDate, gender: p.gender },
        }),
      })
      console.log('[SubordinateTab] Response status:', res.status)
      if (res.status === 402) {
        setIsPointInsufficient(true)
        throw new Error('ポイントが不足しています')
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('[SubordinateTab] Error response:', errData)
        throw new Error(errData.error || `部下分析に失敗しました（ステータス: ${res.status}）`)
      }
      const analysisResult = await res.json() as SubordinateAnalysis
      console.log('[SubordinateTab] Analysis result received')
      setResult(analysisResult)
      refreshPoints()
      // 鑑定済みフラグを保存
      addAnalyzedFeature(user?.id, 'subordinate')
      if (user) {
        saveAnalysis(
          user.id,
          'subordinate',
          fortuneData.input.birthDate,
          `部下占い - ${fortuneData.input.birthDate} × ${p.birthDate}`,
          { result: analysisResult }
        ).then(id => { if (id) onSaved?.(id) })
          .catch(err => console.error('[SubordinateTab] Failed to save analysis:', err))
      }
    } catch (e) {
      console.error('[SubordinateTab] Error:', e)
      setError(e instanceof Error ? e.message : '部下分析に失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex gap-1.5">{[0,1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
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
        {subordinate && <button onClick={() => runAnalysis(subordinate)} className="text-green-400 text-xs underline mr-4">再試行する</button>}
        <button onClick={() => { setError(''); setSubordinate(null); setResult(null) }} className="text-green-400 text-xs underline">再入力する</button>
      </div>
    )
  }
  if (!result) return <SubordinateForm onSubmit={runAnalysis} />

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 部下タイプ */}
      <div className="glass-card border border-green-500/15 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/25 text-xs italic mb-1">Subordinate Analysis</p>
            <h3 className="text-white text-xl font-bold">{result.subordinateType}</h3>
          </div>
          <div className="text-right">
            <p className="text-white/20 text-xs mb-1">相性スコア</p>
            <span className="text-4xl font-bold font-mono text-green-400">{result.chemistryWithYou.score}</span>
          </div>
        </div>
        <div className="bg-green-400/8 border border-green-400/20 rounded-lg px-4 py-3">
          <p className="text-white/80 text-sm leading-relaxed">{result.workStyle}</p>
        </div>
      </div>

      {/* モチベーションの源泉 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-yellow-400 rounded-full" />
          <h3 className="text-white font-semibold">モチベーションの源泉</h3>
        </div>
        <div className="space-y-2">
          {result.motivators.map((m, i) => (
            <div key={i} className="flex items-start gap-2 bg-yellow-400/5 border border-yellow-400/15 rounded-lg p-3">
              <span className="text-yellow-400 text-xs mt-0.5">⚡</span>
              <span className="text-white/70 text-sm">{m}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 強み */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-emerald-400 rounded-full" />
          <h3 className="text-white font-semibold">強み・活かし方</h3>
        </div>
        <div className="space-y-3">
          {result.strengths.map((s, i) => (
            <div key={i} className="bg-emerald-400/5 border border-emerald-400/15 rounded-lg p-4">
              <p className="text-emerald-300 font-semibold text-sm mb-1.5">{s.name}</p>
              <p className="text-white/55 text-xs leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 成長が必要な領域 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-blue-400 rounded-full" />
          <h3 className="text-white font-semibold">成長が必要な領域</h3>
        </div>
        <div className="space-y-3">
          {result.growthAreas.map((g, i) => (
            <div key={i} className="border border-white/8 rounded-lg p-4">
              <p className="text-white font-medium text-sm mb-1">{g.area}</p>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 text-xs mt-0.5">→</span>
                <p className="text-blue-300/80 text-xs">{g.approach}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* マネジメントのコツ */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-purple-400 rounded-full" />
          <h3 className="text-white font-semibold">マネジメントのコツ</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {result.managementTips.map((tip, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-purple-300 font-semibold text-sm mb-2">{tip.situation}</p>
              <p className="text-white/60 text-xs">{tip.advice}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 最重要注意点 */}
      <div className="glass-card border border-amber-400/20 p-6">
        <p className="text-amber-400 font-semibold text-sm mb-2">⚠️ マネジメント上の最重要注意点</p>
        <p className="text-white/80 text-sm leading-relaxed">{result.caution}</p>
      </div>

      <button onClick={() => { setResult(null); setSubordinate(null) }} className="w-full py-2 text-white/20 hover:text-white/40 text-sm transition-colors">
        ← 別の部下を分析
      </button>
    </div>
  )
}
