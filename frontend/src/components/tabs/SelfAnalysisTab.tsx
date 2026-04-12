import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FortuneData, SelfAnalysis } from '../../lib/types'
import { apiFetch } from '../../lib/api'
import { ShareButton } from '../ShareButton'
import { useAuth } from '../../contexts/AuthContext'
import { saveAnalysis } from '../../lib/history'
import { addAnalyzedFeature } from '../../lib/analyzedFeatures'

interface Props {
  fortuneData: FortuneData
  onSaved?: (id: string) => void
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono w-6 text-right" style={{ color: 'inherit' }}>{score}</span>
    </div>
  )
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 65) return 'bg-blue-400'
  return 'bg-amber-400'
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 65) return 'text-blue-400'
  return 'text-amber-400'
}

function typeConfig(type: string) {
  if (type === 'opportunity') return { label: '機会', color: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-400/30' }
  if (type === 'challenge') return { label: '試練', color: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-400/30' }
  return { label: '変革', color: 'text-purple-400', dot: 'bg-purple-400', border: 'border-purple-400/30' }
}

function AnalysisLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="text-white/40 text-sm">命式データを解析中...</p>
      <p className="text-white/20 text-xs">四柱推命 × 算命学 × 宿曜 × 納音</p>
    </div>
  )
}

export function SelfAnalysisTab({ fortuneData, onSaved }: Props) {
  const navigate = useNavigate()
  const { user, refreshPoints } = useAuth()
  const [data, setData] = useState<SelfAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPointInsufficient, setIsPointInsufficient] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    setIsPointInsufficient(false)
    console.log('[SelfAnalysisTab] Starting analysis with fortuneData:', fortuneData)

    apiFetch('/api/analyze/self', {
      method: 'POST',
      body: JSON.stringify({ fortuneData }),
    })
      .then(async r => {
        console.log('[SelfAnalysisTab] Response status:', r.status)
        if (r.status === 402) {
          setIsPointInsufficient(true)
          throw new Error('ポイントが不足しています')
        }
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}))
          console.error('[SelfAnalysisTab] Error response:', errData)
          throw new Error(errData.error || `解析に失敗しました（ステータス: ${r.status}）`)
        }
        return r.json()
      })
      .then((json: SelfAnalysis) => {
        console.log('[SelfAnalysisTab] Analysis result received:', json)
        setData(json)
        refreshPoints()
        // 鑑定済みフラグを保存（ユーザー別）
        addAnalyzedFeature(user?.id, 'self')
        if (user) {
          saveAnalysis(
            user.id,
            'self',
            fortuneData.input.birthDate,
            `自己分析 - ${fortuneData.input.birthDate}`,
            { result: json }
          ).then(id => { if (id) onSaved?.(id) })
            .catch(err => console.error('[SelfAnalysisTab] Failed to save analysis:', err))
        }
      })
      .catch((e: Error) => {
        console.error('[SelfAnalysisTab] Error:', e)
        setError(e.message || '解析に失敗しました。再度お試しください。')
      })
      .finally(() => setLoading(false))
  }, [fortuneData.input.birthDate])

  if (loading) return <AnalysisLoader />
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
      <div className="glass-card p-6 text-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="space-y-4 animate-fade-in">

      {/* コアプロファイル */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/30 text-xs tracking-widest uppercase mb-1">Core Profile</p>
            <h3 className="text-white text-xl font-bold">{data.corePersonality}</h3>
          </div>
          <ShareButton text={`命式解析で「${data.corePersonality}」と診断されました。\n人生テーマ：${data.lifeTheme}`} />
          <div className="text-right">
            <p className="text-white/20 text-xs mb-1">Data Sources</p>
            <div className="flex gap-1 flex-wrap justify-end">
              {['四柱推命', '算命学', '宿曜', '納音'].map(s => (
                <span key={s} className="text-xs text-white/40 border border-white/10 rounded px-1.5 py-0.5">{s}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
          <p className="text-white/50 text-xs mb-0.5">Life Theme</p>
          <p className="text-accent font-semibold text-sm">{data.lifeTheme}</p>
        </div>
      </div>

      {/* 強み分析 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-emerald-400 rounded-full" />
          <h3 className="text-white font-semibold text-base">強み分析</h3>
          <span className="ml-auto text-white/20 text-xs">Strength Index</span>
        </div>
        <div className="space-y-4">
          {data.strengths.map((s, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono ${scoreTextColor(s.score)}`}>S{i + 1}</span>
                  <span className="text-white text-sm font-medium">{s.name}</span>
                </div>
                <span className={`text-lg font-bold font-mono ${scoreTextColor(s.score)}`}>{s.score}</span>
              </div>
              <ScoreBar score={s.score} color={scoreColor(s.score)} />
              <p className="text-white/40 text-xs mt-1.5 pl-6">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 弱み・成長領域 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-amber-400 rounded-full" />
          <h3 className="text-white font-semibold text-base">成長領域</h3>
          <span className="ml-auto text-white/20 text-xs">Growth Areas</span>
        </div>
        <div className="space-y-4">
          {data.weaknesses.map((w, i) => (
            <div key={i} className="bg-amber-400/5 border border-amber-400/15 rounded-lg p-4">
              <p className="text-amber-300 font-semibold text-sm mb-1">{w.name}</p>
              <p className="text-white/50 text-xs mb-2">{w.description}</p>
              <div className="flex items-start gap-2">
                <span className="text-white/20 text-xs mt-0.5">▶</span>
                <p className="text-white/60 text-xs">{w.advice}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 適職マッチ */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-blue-400 rounded-full" />
          <h3 className="text-white font-semibold text-base">適職マッチ分析</h3>
          <span className="ml-auto text-white/20 text-xs">Career Match</span>
        </div>
        <div className="space-y-3">
          {data.careers.map((c, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-8 text-center">
                <span className="text-white/20 text-xs font-mono">#{i + 1}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium">{c.title}</span>
                  <span className={`text-sm font-bold font-mono ${scoreTextColor(c.match)}`}>{c.match}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${scoreColor(c.match)}`} style={{ width: `${c.match}%` }} />
                </div>
                <p className="text-white/30 text-xs">{c.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 転換期予測タイムライン */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-purple-400 rounded-full" />
          <h3 className="text-white font-semibold text-base">人生転換期予測</h3>
          <span className="ml-auto text-white/20 text-xs">Life Turning Points</span>
        </div>
        <div className="relative pl-4">
          <div className="absolute left-0 top-2 bottom-2 w-px bg-white/10" />
          <div className="space-y-5">
            {data.turningPoints.map((tp, i) => {
              const cfg = typeConfig(tp.type)
              return (
                <div key={i} className="relative pl-5">
                  <div className={`absolute -left-[13px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-deep-navy ${cfg.dot}`} />
                  <div className={`glass-card border ${cfg.border} p-3`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">{tp.year}</span>
                        <span className="text-white/30 text-xs">({tp.age}歳)</span>
                      </div>
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-white/80 text-sm font-medium mb-1">{tp.theme}</p>
                    <p className="text-white/40 text-xs">{tp.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}
