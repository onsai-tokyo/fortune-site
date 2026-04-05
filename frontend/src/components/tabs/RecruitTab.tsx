import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FortuneData, RecruitAnalysis } from '../../lib/types'
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

function scoreColor(s: number) { return s >= 80 ? 'bg-emerald-400' : s >= 65 ? 'bg-blue-400' : 'bg-amber-400' }
function scoreText(s: number)  { return s >= 80 ? 'text-emerald-400' : s >= 65 ? 'text-blue-400' : 'text-amber-400' }

export function RecruitTab({ fortuneData }: Props) {
  const navigate = useNavigate()
  const { user, refreshPoints } = useAuth()
  const [year,   setYear]   = useState('')
  const [month,  setMonth]  = useState('')
  const [day,    setDay]    = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [result,  setResult]  = useState<RecruitAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [isPointInsufficient, setIsPointInsufficient] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !month || !day) return
    setLoading(true)
    setError('')
    setIsPointInsufficient(false)
    try {
      const y = Number(year), m = Number(month), d = Number(day)
      const shichu = calcShichu(y, m, d, undefined)
      const nayin  = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
      const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
      const sukuyo = getSukuyo(y, m, d)
      const birthDate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`

      console.log('[RecruitTab] Starting analysis for candidate:', birthDate)
      const { input, shichu: sShichu, nayin: sNayin, sanmei: sSanmei, sukuyo: sSukuyo } = fortuneData
      const res = await apiFetch('/api/analyze/recruit', {
        method: 'POST',
        body: JSON.stringify({
          selfData:      { shichu: sShichu, nayin: sNayin, sanmei: sSanmei, sukuyo: sSukuyo, birthDate: input.birthDate, gender: input.gender },
          candidateData: { shichu, nayin, sanmei, sukuyo, birthDate, gender },
        }),
      })
      console.log('[RecruitTab] Response status:', res.status)
      if (res.status === 402) {
        setIsPointInsufficient(true)
        throw new Error('ポイントが不足しています')
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('[RecruitTab] Error response:', errData)
        throw new Error(errData.error || `採用分析に失敗しました（ステータス: ${res.status}）`)
      }
      const analysisResult = await res.json() as RecruitAnalysis
      console.log('[RecruitTab] Analysis result received')
      setResult(analysisResult)
      refreshPoints()
      // 鑑定済みフラグを保存
      addAnalyzedFeature(user?.id, 'recruit')
      if (user) {
        saveAnalysis(
          user.id,
          'recruit',
          input.birthDate,
          `採用分析 - 候補者 ${birthDate}`,
          analysisResult
        ).catch(err => console.error('[RecruitTab] Failed to save analysis:', err))
      }
    } catch (e) {
      console.error('[RecruitTab] Error:', e)
      setError(e instanceof Error ? e.message : '採用分析に失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex gap-1.5">{[0,1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
      <p className="text-white/40 text-sm">候補者の命式を解析中...</p>
    </div>
  )

  if (result) return (
    <div className="space-y-4 animate-fade-in">

      {/* 候補者プロファイル */}
      <div className="glass-card border border-accent/20 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/25 text-xs italic mb-1">Candidate Profile</p>
            <h3 className="text-white text-xl font-bold">{result.candidateType}</h3>
          </div>
          <div className="text-right">
            <p className="text-white/20 text-xs mb-1">適合スコア</p>
            <span className={`text-4xl font-bold font-mono ${scoreText(result.fitScore)}`}>{result.fitScore}</span>
          </div>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-lg px-4 py-3">
          <p className="text-white/50 text-xs mb-0.5">ワークスタイル</p>
          <p className="text-white/80 text-sm leading-relaxed">{result.workStyle}</p>
        </div>
      </div>

      {/* 強み分析 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-emerald-400 rounded-full" />
          <h3 className="text-white font-semibold">強み分析</h3>
          <span className="ml-auto text-white/20 text-xs">Strength Index</span>
        </div>
        <div className="space-y-4">
          {result.strengths.map((s, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono ${scoreText(s.score)}`}>S{i+1}</span>
                  <span className="text-white text-sm font-medium">{s.name}</span>
                </div>
                <span className={`text-lg font-bold font-mono ${scoreText(s.score)}`}>{s.score}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${scoreColor(s.score)}`} style={{ width: `${s.score}%` }} />
                </div>
              </div>
              <p className="text-white/40 text-xs mt-1.5 pl-6">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 注意点 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-amber-400 rounded-full" />
          <h3 className="text-white font-semibold">マネジメント注意点</h3>
        </div>
        <div className="space-y-3">
          {result.weaknesses.map((w, i) => (
            <div key={i} className="bg-amber-400/5 border border-amber-400/15 rounded-lg p-4">
              <p className="text-amber-300 font-semibold text-sm mb-1">{w.name}</p>
              <p className="text-white/50 text-xs mb-2">{w.description}</p>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 text-xs mt-0.5">→</span>
                <p className="text-blue-300/80 text-xs">{w.mitigation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* あなたとの相性 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-blue-400 rounded-full" />
          <h3 className="text-white font-semibold">あなたとの相性</h3>
          <span className={`ml-auto text-lg font-bold font-mono ${scoreText(result.chemistryWithYou.score)}`}>{result.chemistryWithYou.score}</span>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-lg p-4">
          <p className="text-accent font-medium text-sm mb-2">{result.chemistryWithYou.dynamic}</p>
          <p className="text-white/55 text-sm leading-relaxed">{result.chemistryWithYou.description}</p>
        </div>
      </div>

      {/* 面接で聞くべき質問 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-purple-400 rounded-full" />
          <h3 className="text-white font-semibold">命式から引き出す面接質問</h3>
        </div>
        <div className="space-y-2">
          {result.interviewQuestions.map((q, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
              <span className="text-purple-400/60 text-xs font-mono mt-0.5">Q{i+1}</span>
              <p className="text-white/70 text-sm">{q}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 採用判断 */}
      <div className="glass-card border border-accent/20 p-6">
        <p className="text-white/30 text-xs mb-2 italic">採用判断のポイント</p>
        <p className="text-white/80 text-sm leading-relaxed">{result.hiringAdvice}</p>
      </div>

      <button onClick={() => setResult(null)} className="w-full py-2 text-white/20 hover:text-white/40 text-sm transition-colors">
        ← 別の候補者を分析
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {error && !isPointInsufficient && <div className="glass-card p-4 border border-red-500/20"><p className="text-red-400 text-sm">{error}</p></div>}
      {isPointInsufficient && (
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
      )}
      <div className="glass-card border border-accent/15 p-5">
        <p className="text-white/40 text-sm leading-relaxed">
          候補者の生年月日を入力することで、命式から強み・適性・あなたとの相性を分析します。面接前の事前把握や採用判断の参考にご活用ください。
        </p>
      </div>
      <form onSubmit={handleSubmit} className="glass-card border border-accent/15 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-5 bg-accent rounded-full" />
          <h3 className="text-white font-semibold text-base">候補者の情報</h3>
        </div>
        <div>
          <label className="text-white/50 text-xs mb-2 block">候補者の生年月日 <span className="text-accent">*</span></label>
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
          <label className="text-white/50 text-xs mb-2 block">候補者の性別 <span className="text-accent">*</span></label>
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
          ✦ 候補者を分析する
        </button>
      </form>
    </div>
  )
}
