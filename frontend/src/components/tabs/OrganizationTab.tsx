import { useState } from 'react'
import type { FortuneData, OrgMember, OrganizationAnalysis } from '../../lib/types'
import { apiFetch, calculatePerson } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { saveAnalysis } from '../../lib/history'
import { addAnalyzedFeature } from '../../lib/analyzedFeatures'

interface Props {
  fortuneData: FortuneData
  onSaved?: (id: string) => void
}

function dynamicColor(dynamic: string) {
  if (dynamic === '補完') return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
  if (dynamic === '協力') return 'text-blue-400 border-blue-400/30 bg-blue-400/10'
  if (dynamic === '緊張') return 'text-red-400 border-red-400/30 bg-red-400/10'
  return 'text-white/40 border-white/10 bg-white/5'
}

async function calcMemberData(m: OrgMember) {
  return { ...m, ...await calculatePerson(m.birthDate, m.gender) }
}

export function OrganizationTab({ fortuneData, onSaved }: Props) {
  const { user, refreshPoints } = useAuth()
  const [selfName, setSelfName] = useState('自分')
  const [members, setMembers] = useState<OrgMember[]>([{ name: '', birthDate: '', gender: 'male' }])
  const [result, setResult] = useState<OrganizationAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addMember() {
    setMembers(prev => [...prev, { name: '', birthDate: '', gender: 'male' }])
  }

  function removeMember(i: number) {
    setMembers(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateMember(i: number, field: keyof OrgMember, value: string) {
    setMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (members.some(m => !m.name || !m.birthDate)) return

    setLoading(true)
    setError('')
    try {
      const selfData = {
        ...fortuneData,
        input: { ...fortuneData.input, selfName },
      }
      const computedMembers = await Promise.all(members.map(calcMemberData))

      const res = await apiFetch('/api/analyze/organization', {
        method: 'POST',
        body: JSON.stringify({ selfData, members: computedMembers }),
      })
      if (res.status === 402) throw new Error('ポイントが不足しています')
      if (!res.ok) throw new Error()
      const json = await res.json() as OrganizationAnalysis
      setResult(json)
      refreshPoints()
      addAnalyzedFeature(user?.id, 'org')
      if (user) {
        saveAnalysis(user.id, 'org', fortuneData.input.birthDate, `組織診断 - ${fortuneData.input.birthDate}`, { result: json })
          .then(id => { if (id) onSaved?.(id) })
          .catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '組織診断に失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="text-white/40 text-sm">組織を解析中...</p>
      <p className="text-white/20 text-xs">メンバー全員の命式を統合処理中</p>
    </div>
  )

  if (result) return (
    <div className="space-y-4 animate-fade-in">
      {/* チームスコア */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/30 text-xs tracking-widest uppercase mb-1">Organization Score</p>
            <h3 className="text-white text-xl font-bold">{result.teamType}</h3>
          </div>
          <div className="text-right">
            <p className="text-white/20 text-xs mb-1">Team Index</p>
            <span className="text-4xl font-bold font-mono text-accent">{result.teamScore}</span>
          </div>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-gradient-to-r from-accent to-emerald-400 rounded-full" style={{ width: `${result.teamScore}%` }} />
        </div>
        {result.keyPerson && (
          <div className="bg-amber-400/8 border border-amber-400/25 rounded-lg px-4 py-3 flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                <span className="text-amber-400 text-xs font-bold">{result.keyPerson.name.slice(0, 1)}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-amber-400 text-xs font-medium">キーマン</span>
                <span className="text-white font-semibold text-sm">{result.keyPerson.name}</span>
              </div>
              <p className="text-white/50 text-xs">{result.keyPerson.reason}</p>
            </div>
          </div>
        )}
      </div>

      {/* 戦い方・戦略 */}
      {result.battleStrategy && (
        <div className="glass-card border border-accent/20 p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-accent rounded-full" />
            <h3 className="text-white font-semibold">この組織の戦い方</h3>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">{result.battleStrategy}</p>
        </div>
      )}

      {/* 強み・課題 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <p className="text-emerald-400 text-xs font-medium mb-3">組織の強み</p>
          {result.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <span className="text-emerald-400 text-sm mt-0.5">+</span>
              <span className="text-white/70 text-sm">{s}</span>
            </div>
          ))}
        </div>
        <div className="glass-card p-5">
          <p className="text-amber-400 text-xs font-medium mb-3">改善課題</p>
          {result.challenges.map((c, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <span className="text-amber-400 text-sm mt-0.5">△</span>
              <span className="text-white/70 text-sm">{c}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 人間関係マトリクス */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-blue-400 rounded-full" />
          <h3 className="text-white font-semibold text-base">人間関係マトリクス</h3>
        </div>
        <div className="space-y-2">
          {result.relationships.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {r.members.map((name, j) => (
                  <span key={j} className="text-white text-sm font-medium truncate">
                    {name}{j < r.members.length - 1 && <span className="text-white/20 mx-1">×</span>}
                  </span>
                ))}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${dynamicColor(r.dynamic)}`}>
                {r.dynamic}
              </span>
              <p className="text-white/40 text-xs hidden sm:block flex-shrink-0 max-w-[180px] truncate">{r.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 最適役割提案 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-purple-400 rounded-full" />
          <h3 className="text-white font-semibold text-base">最適役割提案</h3>
        </div>
        <div className="space-y-3">
          {result.roles.map((r, i) => (
            <div key={i} className="flex items-start gap-4 py-2 border-b border-white/5 last:border-0">
              <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                {r.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-white font-medium text-sm">{r.name}</span>
                  <span className="text-accent text-xs bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">{r.suggestedRole}</span>
                </div>
                <p className="text-white/40 text-xs">{r.strength}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 戦略・アドバイス */}
      <div className="glass-card p-6 space-y-3">
        <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg p-4">
          <p className="text-blue-400 text-xs font-medium mb-1">組織戦略</p>
          <p className="text-white/80 text-sm">{result.strategy}</p>
        </div>
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <p className="text-accent text-xs font-medium mb-1">最重要アドバイス</p>
          <p className="text-white/80 text-sm">{result.advice}</p>
        </div>
      </div>

      <button
        onClick={() => setResult(null)}
        className="w-full py-2 text-white/30 hover:text-white/50 text-sm transition-colors"
      >
        ← メンバーを変更して再診断
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <p className="text-white/50 text-sm leading-relaxed">
          メンバーの生年月日を入力することで、組織全体の特性・相関関係・最適な役割分担を解析します。
        </p>
      </div>

      {error && (
        <div className="glass-card p-4 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 自分の名前 */}
        <div className="glass-card p-5">
          <p className="text-white/40 text-xs mb-3">あなたの表示名</p>
          <input
            type="text"
            value={selfName}
            onChange={e => setSelfName(e.target.value)}
            placeholder="自分"
            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/60"
          />
        </div>

        {/* メンバー入力 */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-accent rounded-full" />
            <h3 className="text-white font-semibold text-base">メンバー情報</h3>
            <span className="text-white/20 text-xs ml-auto">{members.length}名</span>
          </div>

          {members.map((m, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">メンバー {i + 1}</span>
                {members.length > 1 && (
                  <button type="button" onClick={() => removeMember(i)} className="text-white/20 hover:text-red-400 text-xs transition-colors">
                    削除
                  </button>
                )}
              </div>
              <input
                type="text"
                value={m.name}
                onChange={e => updateMember(i, 'name', e.target.value)}
                placeholder="名前（例: 田中さん）"
                required
                className="w-full bg-deep-navy/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/40"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={m.birthDate}
                  onChange={e => updateMember(i, 'birthDate', e.target.value)}
                  required
                  className="bg-deep-navy/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/40"
                />
                <div className="flex gap-2">
                  {(['male', 'female'] as const).map(g => (
                    <button
                      key={g} type="button"
                      onClick={() => updateMember(i, 'gender', g)}
                      className={`flex-1 py-2 rounded-lg text-xs border transition-all ${m.gender === g ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-white/40'}`}
                    >
                      {g === 'male' ? '男' : '女'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addMember}
            className="w-full py-2.5 border border-dashed border-white/20 rounded-lg text-white/40 hover:text-white/60 hover:border-white/30 text-sm transition-all"
          >
            + メンバーを追加
          </button>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg transition-all text-sm"
        >
          組織を診断する
        </button>
      </form>
    </div>
  )
}
