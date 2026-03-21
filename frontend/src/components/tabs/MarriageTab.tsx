import { useState } from 'react'
import type { FortuneData, MarriageAnalysis, PartnerData } from '../../lib/types'
import { calcShichu } from '../../lib/shichu'
import { calcNayin } from '../../lib/nayin'
import { calcSanmei } from '../../lib/sanmei'
import { getSukuyo } from '../../lib/sukuyo'

interface Props { fortuneData: FortuneData }

const currentYear = new Date().getFullYear()
const YEARS  = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
function daysInMonth(y: number, m: number) { return (!y || !m) ? 31 : new Date(y, m, 0).getDate() }
const sc = "bg-white/5 border border-white/15 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-pink-400/60 transition-all font-sans cursor-pointer appearance-none"

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 26}`}
            strokeDashoffset={`${2 * Math.PI * 26 * (1 - score / 100)}`}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold font-mono text-white">{score}</span>
        </div>
      </div>
      <span className="text-white/35 text-xs text-center">{label}</span>
    </div>
  )
}

function PartnerForm({ onSubmit }: { onSubmit: (p: PartnerData & { birthDate: string; gender: string; mbti: string }) => void }) {
  const [year,   setYear]   = useState<number | ''>('')
  const [month,  setMonth]  = useState<number | ''>('')
  const [day,    setDay]    = useState<number | ''>('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [mbti,   setMbti]   = useState('')
  const days = Array.from({ length: daysInMonth(Number(year), Number(month)) }, (_, i) => i + 1)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !month || !day) return
    const y = Number(year), m = Number(month), d = Number(day)
    const shichu = calcShichu(y, m, d, undefined)
    const nayin  = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    const birthDate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    onSubmit({ shichu, nayin, sanmei, sukuyo, birthDate, gender, mbti })
  }

  return (
    <div className="glass-card border border-pink-500/20 p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 bg-pink-400 rounded-full" />
        <h3 className="text-white font-semibold">お相手の情報を入力</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-white/40 text-xs mb-2">生年月日</p>
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
        <div className="flex gap-2">
          {(['male', 'female'] as const).map(g => (
            <button key={g} type="button" onClick={() => setGender(g)}
              className={`px-4 py-1.5 rounded-lg text-sm border transition-all ${gender === g ? 'border-pink-400 bg-pink-400/10 text-pink-300' : 'border-white/15 text-white/40'}`}>
              {g === 'male' ? '男性' : '女性'}
            </button>
          ))}
        </div>
        <div>
          <p className="text-white/40 text-xs mb-2">MBTI（任意）</p>
          <input type="text" value={mbti} onChange={e => setMbti(e.target.value.toUpperCase())}
            placeholder="例: ENFJ" maxLength={4}
            className="w-28 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-pink-400/60" />
        </div>
        <button type="submit" className="w-full py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-lg text-sm transition-all">
          結婚相性を診断する
        </button>
      </form>
    </div>
  )
}

export function MarriageTab({ fortuneData }: Props) {
  const [result,  setResult]  = useState<MarriageAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [, setPartner] = useState<(PartnerData & { birthDate: string; gender: string; mbti: string }) | null>(null)

  async function runAnalysis(p: PartnerData & { birthDate: string; gender: string; mbti: string }) {
    setPartner(p)
    setLoading(true)
    setError('')
    try {
      const { input, shichu, nayin, sanmei, sukuyo } = fortuneData
      const res = await fetch('/api/analyze/marriage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfData:    { shichu, nayin, sanmei, sukuyo, birthDate: input.birthDate, gender: input.gender, mbti: input.mbti },
          partnerData: { shichu: p.shichu, nayin: p.nayin, sanmei: p.sanmei, sukuyo: p.sukuyo, birthDate: p.birthDate, gender: p.gender, mbti: p.mbti },
        }),
      })
      if (!res.ok) throw new Error()
      setResult(await res.json() as MarriageAnalysis)
    } catch {
      setError('結婚相性診断に失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex gap-1.5">{[0,1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
      <p className="text-white/40 text-sm">命式を照合中...</p>
    </div>
  )
  if (error) return (
    <div className="glass-card p-6 text-center space-y-3">
      <p className="text-red-400 text-sm">{error}</p>
      <button onClick={() => { setError(''); setPartner(null) }} className="text-pink-400 text-xs underline">再入力する</button>
    </div>
  )
  if (!result) return <PartnerForm onSubmit={runAnalysis} />

  const balanceLabel = result.powerDynamic.balance === '対等' ? '対等' : result.powerDynamic.balance === 'あなた主導' ? 'あなた主導' : '相手主導'
  const compatEntries: [string, number][] = [['日常生活', result.compatibility.daily], ['危機対応', result.compatibility.crisis], ['成長・向上', result.compatibility.growth], ['情熱・魅力', result.compatibility.passion]]

  return (
    <div className="space-y-4 animate-fade-in">

      {/* スコア概要 */}
      <div className="glass-card border border-pink-500/15 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-white/25 text-xs font-garamond italic mb-1">Marriage Analysis</p>
            <h3 className="text-white text-xl font-bold">{result.marriageType}</h3>
          </div>
          <div className="text-right">
            <p className="text-white/20 text-xs mb-1">総合スコア</p>
            <span className="text-4xl font-bold font-mono text-pink-400">{result.overallScore}</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {compatEntries.map(([label, score]) => (
            <ScoreRing key={label} score={score} label={label} color={score >= 80 ? '#34d399' : score >= 65 ? '#f472b6' : '#fbbf24'} />
          ))}
        </div>
        <div className="bg-pink-400/8 border border-pink-400/20 rounded-lg px-4 py-3">
          <p className="text-white/80 text-sm leading-relaxed">{result.lifeDescription}</p>
        </div>
      </div>

      {/* 力関係 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-amber-400 rounded-full" />
          <h3 className="text-white font-semibold">力関係・主導権</h3>
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded border ${result.powerDynamic.balance === '対等' ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' : 'text-amber-400 border-amber-400/30 bg-amber-400/10'}`}>{balanceLabel}</span>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-lg p-4">
          {result.powerDynamic.balance !== '対等' && (
            <p className="text-amber-300 font-medium text-sm mb-2">リード役：{result.powerDynamic.leader}</p>
          )}
          <p className="text-white/60 text-sm leading-relaxed">{result.powerDynamic.description}</p>
        </div>
      </div>

      {/* うまくいくコツ */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-emerald-400 rounded-full" />
          <h3 className="text-white font-semibold">うまくいくコツ</h3>
        </div>
        <div className="space-y-3">
          {result.successKeys.map((k, i) => (
            <div key={i} className="bg-emerald-400/5 border border-emerald-400/15 rounded-lg p-4">
              <p className="text-emerald-300 font-semibold text-sm mb-1.5">{k.key}</p>
              <p className="text-white/55 text-xs leading-relaxed">{k.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 注意点 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-red-400 rounded-full" />
          <h3 className="text-white font-semibold">乗り越えるべき壁</h3>
        </div>
        <div className="space-y-3">
          {result.challenges.map((c, i) => (
            <div key={i} className="border border-white/8 rounded-lg p-4">
              <p className="text-white font-medium text-sm mb-1">{c.issue}</p>
              <p className="text-white/45 text-xs mb-2">{c.description}</p>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 text-xs mt-0.5">→</span>
                <p className="text-emerald-300/80 text-xs">{c.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 総括メッセージ */}
      <div className="glass-card border border-pink-400/20 p-6">
        <p className="text-white/30 text-xs mb-2 font-garamond italic">命術師より</p>
        <p className="text-white/80 text-sm leading-relaxed">{result.advice}</p>
      </div>

      <button onClick={() => { setResult(null); setPartner(null) }} className="w-full py-2 text-white/20 hover:text-white/40 text-sm transition-colors">
        ← 相手を変えて再診断
      </button>
    </div>
  )
}
