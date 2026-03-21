import { useState } from 'react'
import type { FortuneData, CompatibilityAnalysis, PartnerData } from '../../lib/types'
import { calcShichu } from '../../lib/shichu'
import { calcNayin } from '../../lib/nayin'
import { calcSanmei } from '../../lib/sanmei'
import { getSukuyo } from '../../lib/sukuyo'

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

function PartnerForm({ onSubmit }: { onSubmit: (partner: PartnerData & { birthDate: string; gender: string; mbti: string }) => void }) {
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [mbti, setMbti] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!birthDate) return
    const [y, m, d] = birthDate.split('-').map(Number)
    const shichu = calcShichu(y, m, d, undefined)
    const nayin = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    onSubmit({ shichu, nayin, sanmei, sukuyo, birthDate, gender, mbti })
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 bg-pink-400 rounded-full" />
        <h3 className="text-white font-semibold text-base">相手の情報を入力</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-white/50 text-xs mb-1 block">生年月日</label>
          <input
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/60"
          />
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1 block">性別</label>
          <div className="flex gap-3">
            {(['male', 'female'] as const).map(g => (
              <button
                key={g} type="button"
                onClick={() => setGender(g)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${gender === g ? 'border-accent bg-accent/10 text-accent' : 'border-white/20 text-white/50'}`}
              >
                {g === 'male' ? '男性' : '女性'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1 block">MBTI（任意）</label>
          <input
            type="text"
            value={mbti}
            onChange={e => setMbti(e.target.value.toUpperCase())}
            placeholder="例: ENFJ"
            maxLength={4}
            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/60"
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg transition-all text-sm"
        >
          相性を診断する
        </button>
      </form>
    </div>
  )
}

export function CompatibilityTab({ fortuneData }: Props) {
  const [result, setResult] = useState<CompatibilityAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subTab, setSubTab] = useState<SubTab>('work')

  async function runAnalysis(partnerBlock?: PartnerData & { birthDate: string; gender: string; mbti: string }) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/analyze/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fortuneData, partnerBlock }),
      })
      const json = await res.json() as CompatibilityAnalysis
      if (!res.ok) throw new Error()
      setResult(json)
    } catch {
      setError('相性診断に失敗しました。再度お試しください。')
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

  if (error) return (
    <div className="glass-card p-6 text-center space-y-3">
      <p className="text-red-400 text-sm">{error}</p>
      <button onClick={() => runAnalysis()} className="text-accent text-xs underline">再試行する</button>
    </div>
  )

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
    </div>
  )
}
