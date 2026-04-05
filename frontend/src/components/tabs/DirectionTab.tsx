import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FortuneData, DirectionAnalysis } from '../../lib/types'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { saveAnalysis } from '../../lib/history'
import { addAnalyzedFeature } from '../../lib/analyzedFeatures'

interface Props { fortuneData: FortuneData }

function DirectionLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="text-white/40 text-sm">方位を解析中...</p>
      <p className="text-white/20 text-xs">九星気学 × 四柱推命</p>
    </div>
  )
}

const DIRECTION_COLORS: Record<string, string> = {
  '北': 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  '南': 'text-red-400 border-red-400/30 bg-red-400/10',
  '東': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  '西': 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  '北東': 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  '南東': 'text-green-400 border-green-400/30 bg-green-400/10',
  '南西': 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  '北西': 'text-slate-400 border-slate-400/30 bg-slate-400/10',
}

function getDirectionColor(direction: string): string {
  return DIRECTION_COLORS[direction] || 'text-white/60 border-white/20 bg-white/5'
}

export function DirectionTab({ fortuneData }: Props) {
  const navigate = useNavigate()
  const { user, refreshPoints } = useAuth()
  const [data, setData] = useState<DirectionAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPointInsufficient, setIsPointInsufficient] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    setIsPointInsufficient(false)
    console.log('[DirectionTab] Starting analysis with fortuneData:', fortuneData)

    apiFetch('/api/analyze/direction', {
      method: 'POST',
      body: JSON.stringify({ fortuneData }),
    })
      .then(async r => {
        console.log('[DirectionTab] Response status:', r.status)
        if (r.status === 402) {
          setIsPointInsufficient(true)
          throw new Error('ポイントが不足しています')
        }
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}))
          console.error('[DirectionTab] Error response:', errData)
          throw new Error(errData.error || `方位診断に失敗しました（ステータス: ${r.status}）`)
        }
        return r.json()
      })
      .then((json: DirectionAnalysis) => {
        console.log('[DirectionTab] Analysis result received:', json)
        setData(json)
        refreshPoints()
        // 鑑定済みフラグを保存
        addAnalyzedFeature(user?.id, 'direction')
        if (user) {
          saveAnalysis(
            user.id,
            'direction',
            fortuneData.input.birthDate,
            `方位診断 - ${fortuneData.input.birthDate}`,
            json
          ).catch(err => console.error('[DirectionTab] Failed to save analysis:', err))
        }
      })
      .catch((e: Error) => {
        console.error('[DirectionTab] Error:', e)
        setError(e.message || '方位診断に失敗しました。再度お試しください。')
      })
      .finally(() => setLoading(false))
  }, [fortuneData.input.birthDate])

  if (loading) return <DirectionLoader />
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
            <p className="text-white/60 text-sm mb-1">この分析には <span className="text-accent font-semibold">2ポイント</span> が必要です</p>
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

      {/* 吉方位 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-emerald-400 rounded-full" />
          <h3 className="text-white font-semibold">吉方位</h3>
          <span className="ml-auto text-white/20 text-xs">Lucky Directions</span>
        </div>
        <div className="space-y-4">
          {data.luckyDirections.map((d, i) => (
            <div key={i} className="bg-emerald-400/5 border border-emerald-400/15 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-3 py-1 rounded-lg border text-sm font-semibold ${getDirectionColor(d.direction)}`}>
                  {d.direction}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-emerald-400 text-xs font-medium mb-1">効果</p>
                  <p className="text-white/70 text-sm">{d.effect}</p>
                </div>
                <div>
                  <p className="text-blue-400 text-xs font-medium mb-1">活用方法</p>
                  <p className="text-white/60 text-sm">{d.usage}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 凶方位 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-red-400 rounded-full" />
          <h3 className="text-white font-semibold">凶方位</h3>
          <span className="ml-auto text-white/20 text-xs">Unlucky Directions</span>
        </div>
        <div className="space-y-4">
          {data.unluckyDirections.map((d, i) => (
            <div key={i} className="bg-red-400/5 border border-red-400/15 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-3 py-1 rounded-lg border text-sm font-semibold ${getDirectionColor(d.direction)}`}>
                  {d.direction}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-red-400 text-xs font-medium mb-1">理由</p>
                  <p className="text-white/70 text-sm">{d.reason}</p>
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-medium mb-1">対策</p>
                  <p className="text-white/60 text-sm">{d.mitigation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 今月の最吉方位 */}
      <div className="glass-card border border-cyan-400/20 p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-cyan-400 rounded-full" />
          <h3 className="text-white font-semibold">今月の最吉方位</h3>
        </div>
        <p className="text-white/80 text-sm leading-relaxed">{data.monthlyBest}</p>
      </div>

      {/* 引越し・移転アドバイス */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-purple-400 rounded-full" />
          <h3 className="text-white font-semibold">引越し・移転アドバイス</h3>
        </div>
        <p className="text-white/70 text-sm leading-relaxed">{data.relocationAdvice}</p>
      </div>

      {/* 出張・旅行 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-blue-400 rounded-full" />
          <h3 className="text-white font-semibold">出張・旅行の方位選び</h3>
        </div>
        <p className="text-white/70 text-sm leading-relaxed">{data.travelTips}</p>
      </div>

      {/* オフィス・自宅配置 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-amber-400 rounded-full" />
          <h3 className="text-white font-semibold">デスク・オフィス配置</h3>
        </div>
        <p className="text-white/70 text-sm leading-relaxed">{data.officeLayout}</p>
      </div>

    </div>
  )
}
