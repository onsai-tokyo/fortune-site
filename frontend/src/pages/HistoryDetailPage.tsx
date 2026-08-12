import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAnalysis, type AnalysisRecord } from '../lib/history'

const FEATURE_LABEL: Record<string, string> = {
  preview: '命式鑑定書', self: '自己分析', compat: '相性診断', marriage: '結婚相性',
  org: '組織診断', recruit: '採用分析', boss: '上司占い', subordinate: '部下占い',
  client: '取引先占い', direction: '方位診断', chat: '鑑定結果への質問', free: '自由鑑定',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <strong key={i} className="text-white font-semibold">{p}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

// 値をそれぞれの型に応じてレンダリング
function RenderValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') {
    return <p className="text-white/70 text-sm leading-relaxed">{renderBold(value)}</p>
  }

  if (typeof value === 'number') {
    return <span className="text-accent font-mono text-sm">{value}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    // 文字列の配列
    if (typeof value[0] === 'string') {
      return (
        <ul className="space-y-1">
          {value.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-white/70 text-sm">
              <span className="text-accent mt-1 flex-shrink-0">·</span>
              <span>{renderBold(String(item))}</span>
            </li>
          ))}
        </ul>
      )
    }
    // オブジェクトの配列
    return (
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="bg-white/3 border border-white/8 rounded-lg p-3">
            <RenderValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)

    // name + score + description パターン（強み/弱み等）
    if ('name' in obj && 'score' in obj) {
      const score = obj.score as number
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-white font-medium text-sm">{String(obj.name)}</span>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${score}%` }} />
            </div>
            <span className="text-accent text-xs font-mono">{score}</span>
          </div>
          {!!obj.description && <p className="text-white/50 text-xs">{String(obj.description)}</p>}
          {!!obj.advice && <p className="text-white/50 text-xs">{String(obj.advice)}</p>}
        </div>
      )
    }

    // title + reason / match パターン（適職等）
    if ('title' in obj || 'suggestedRole' in obj) {
      return (
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-medium text-sm">{String(obj.title ?? obj.suggestedRole ?? '')}</span>
            {obj.match != null && (
              <span className="text-accent text-xs bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">{String(obj.match)}%</span>
            )}
          </div>
          {!!obj.reason && <p className="text-white/50 text-xs">{String(obj.reason)}</p>}
          {!!obj.strength && <p className="text-white/50 text-xs">{String(obj.strength)}</p>}
        </div>
      )
    }

    // year + theme パターン（転換期等）
    if ('year' in obj && 'theme' in obj) {
      return (
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-accent text-xs font-mono">{String(obj.year)}年</span>
            {!!obj.age && <span className="text-white/30 text-xs">({String(obj.age)}歳)</span>}
            <span className="text-white font-medium text-sm">{String(obj.theme)}</span>
          </div>
          {!!obj.description && <p className="text-white/50 text-xs">{String(obj.description)}</p>}
        </div>
      )
    }

    // フラットなキー値のレンダリング
    return (
      <div className="space-y-3">
        {entries.map(([key, val]) => {
          const label = KEY_LABELS[key] ?? key
          return (
            <div key={key}>
              <p className="text-white/30 text-xs uppercase tracking-wider mb-1">{label}</p>
              <RenderValue value={val} depth={depth + 1} />
            </div>
          )
        })}
      </div>
    )
  }

  return <span className="text-white/70 text-sm">{String(value)}</span>
}

const KEY_LABELS: Record<string, string> = {
  corePersonality: 'コア特性', lifeTheme: '人生テーマ',
  strengths: '強み', weaknesses: '弱み・成長領域', careers: '適職',
  turningPoints: '転換期', overall: '総合相性', work: '仕事の相性', romantic: '恋愛・パートナーシップ',
  dynamic: '力学・パワーバランス', marriageLife: '結婚生活', compatibility: '相性スコア',
  teamType: 'チームタイプ', teamScore: 'チームスコア', strengths_org: '組織の強み', challenges: '課題',
  relationships: '人間関係', roles: '役割提案', strategy: '戦略', advice: 'アドバイス',
  battleStrategy: '戦い方', keyPerson: 'キーマン',
  recruitScore: '採用スコア', workStyle: '仕事スタイル', motivation: 'モチベーション',
  riskFactors: 'リスク要因', onboardingTips: 'オンボーディング',
  compatibility_boss: '相性', communication: 'コミュニケーション', growthPotential: '成長可能性',
  managementTips: 'マネジメントのコツ', potentialIssues: '潜在的課題',
  directions: '吉方位', avoidDirections: '凶方位', bestDirection: '最適方位',
  period: '有効期間', explanation: '解説',
  answer: '解析結果',
}

function ChatHistory({ messages }: { messages: { role: string; content: string }[] }) {
  const msgs = messages.filter(m => !(m.role === 'assistant' && !m.content))
  if (msgs.length === 0) return null
  return (
    <div className="glass-card border border-accent/15 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/8 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
        <span className="text-white/60 text-sm font-medium">鑑定結果についての質問</span>
      </div>
      <div className="px-4 py-4 space-y-3 max-h-96 overflow-y-auto">
        {msgs.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-accent text-xs">✦</span>
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-accent/20 text-white/90 rounded-tr-sm'
                : 'bg-white/5 border border-white/8 text-white/80 rounded-tl-sm'
            }`}>
              {renderBold(msg.content)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalysisContent({ record }: { record: AnalysisRecord }) {
  const raw = record.content as Record<string, unknown> | null
  if (!raw) return <p className="text-white/30 text-sm">データがありません</p>

  // 新フォーマット: { result, chat } または { result }
  const result = (raw.result ?? raw) as Record<string, unknown>
  const chat = Array.isArray(raw.chat) ? raw.chat as { role: string; content: string }[] : null

  // feature === 'chat' の場合は会話のみ
  if (record.feature === 'chat') {
    const msgs = Array.isArray(raw?.chat)
      ? raw!.chat as { role: string; content: string }[]
      : Array.isArray(raw) ? raw as { role: string; content: string }[]
      : null
    return msgs && msgs.length > 0 ? <ChatHistory messages={msgs} /> : <p className="text-white/30 text-sm">チャット内容がありません</p>
  }

  // 自由鑑定: answer フィールドを直接表示
  const answer = result.answer as string | undefined

  return (
    <div className="space-y-4">
      {answer ? (
        <div className="glass-card p-5">
          <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{renderBold(answer)}</p>
        </div>
      ) : (
        Object.entries(result)
          .filter(([key, val]) => val !== null && val !== undefined && key !== 'chat')
          .map(([key, val]) => {
            const label = KEY_LABELS[key] ?? key
            return (
              <div key={key} className="glass-card p-5">
                <p className="text-white/30 text-xs uppercase tracking-wider mb-3">{label}</p>
                <RenderValue value={val} />
              </div>
            )
          })
      )}
      {chat && chat.length > 0 && <ChatHistory messages={chat} />}
    </div>
  )
}

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const [record, setRecord] = useState<AnalysisRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getAnalysis(id).then(r => { setRecord(r); setLoading(false) })
  }, [id])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    )
  }

  if (!user || !record) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center">
        <div className="text-white/40 text-sm">記録が見つかりません</div>
      </div>
    )
  }

  const featureLabel = FEATURE_LABEL[record.feature] ?? record.feature

  return (
    <div className="min-h-screen bg-deep-navy">
      <nav className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-20" style={{ background: 'rgba(8,15,40,0.95)' }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/mypage')} className="text-white/30 hover:text-white/60 transition-colors text-sm">
            ← 履歴一覧
          </button>
          <span className="text-white/60 text-sm font-medium">{featureLabel}</span>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div>
            <h1 className="text-white font-bold text-lg">{featureLabel}</h1>
            <p className="text-white/30 text-xs mt-0.5">
              {record.birth_date && <span>{record.birth_date} · </span>}
              {formatDate(record.created_at)}
            </p>
          </div>
        </div>

        <AnalysisContent record={record} />
      </div>
    </div>
  )
}
