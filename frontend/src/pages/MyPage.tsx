import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAnalyses, type AnalysisRecord } from '../lib/history'

const FEATURE_META: Record<string, { label: string; dot: string; path: string }> = {
  preview:  { label: '命式鑑定書',     dot: 'bg-amber-400',   path: '/' },
  self:     { label: '自己分析',       dot: 'bg-blue-400',    path: '/feature/self' },
  compat:   { label: '相性診断',       dot: 'bg-pink-400',    path: '/feature/compat' },
  marriage: { label: '結婚相性',       dot: 'bg-rose-400',    path: '/feature/marriage' },
  org:      { label: '組織診断',       dot: 'bg-emerald-400', path: '/feature/org' },
  recruit:  { label: '採用分析',       dot: 'bg-violet-400',  path: '/feature/recruit' },
  chat:     { label: 'AIチャット',     dot: 'bg-accent',      path: '/chat' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function ChatPreview({ content }: { content: unknown }) {
  if (!Array.isArray(content)) return null
  const msgs = content as { role: string; content: string }[]
  const userMsgs = msgs.filter(m => m.role === 'user')
  if (userMsgs.length === 0) return null
  return (
    <p className="text-white/30 text-xs mt-1 truncate">
      「{userMsgs[0].content.slice(0, 50)}{userMsgs[0].content.length > 50 ? '…' : ''}」ほか{userMsgs.length}件
    </p>
  )
}

export default function MyPage() {
  const navigate = useNavigate()
  const { user, isLoading, isPremium, points } = useAuth()
  const [records, setRecords] = useState<AnalysisRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getAnalyses(user.id).then(data => { setRecords(data); setLoading(false) })
  }, [user])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center p-4">
        <div className="glass-card max-w-sm w-full p-8 text-center space-y-4">
          <h2 className="text-white font-bold text-xl">ログインが必要です</h2>
          <button onClick={() => navigate('/auth')} className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm">
            ログイン / 新規登録
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-deep-navy">
      <nav className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-20" style={{ background: 'rgba(8,15,40,0.95)' }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/60 transition-colors text-sm">
            ← トップ
          </button>
          <span className="text-white/60 text-sm font-medium">マイページ</span>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* プロフィール・ポイント */}
        <div className="glass-card p-5 flex items-center justify-between border border-white/5">
          <div>
            <p className="text-white/60 text-sm">{user.email}</p>
            {isPremium && <span className="text-xs bg-accent/20 text-accent rounded-full px-2 py-0.5 mt-1 inline-block">Premium</span>}
          </div>
          {!isPremium && (
            <div className="text-right">
              <p className="text-white font-bold text-2xl font-mono">{points} <span className="text-white/40 text-sm font-sans">pt</span></p>
              <p className="text-white/30 text-xs mt-0.5">残ポイント</p>
              <button onClick={() => navigate('/?section=pricing')} className="text-accent text-xs hover:underline mt-1">
                ポイントを購入 →
              </button>
            </div>
          )}
        </div>

        <div>
          <h1 className="text-white font-bold text-xl mb-1">鑑定履歴</h1>
        </div>

        {records.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-white/30 text-sm">鑑定履歴はまだありません</p>
            <button onClick={() => navigate('/')} className="mt-4 text-accent text-sm hover:underline">
              鑑定を始める →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(r => {
              const meta = FEATURE_META[r.feature] ?? { label: r.feature, dot: 'bg-white/30', path: '/' }
              return (
                <div key={r.id} className="glass-card border border-white/5 p-4 flex items-start gap-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${meta.dot} mt-2 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white/70 text-sm font-medium">{meta.label}</span>
                      {r.birth_date && (
                        <span className="text-white/25 text-xs">{r.birth_date}</span>
                      )}
                    </div>
                    {r.feature === 'chat' && r.content ? (
                      <ChatPreview content={r.content} />
                    ) : (
                      r.title && <p className="text-white/30 text-xs mt-0.5">{r.title}</p>
                    )}
                    <p className="text-white/20 text-xs mt-1">{formatDate(r.created_at)}</p>
                  </div>
                  <button
                    onClick={() => navigate(meta.path)}
                    className="text-white/20 hover:text-accent text-xs transition-colors flex-shrink-0"
                  >
                    再分析 →
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
