import type { NumerologyResult } from '../../lib/types'

interface Props {
  result: NumerologyResult
  hasFullAccess: boolean
  onOpenOneTime: () => void
  onOpenSubscription: () => void
}

export function NumerologyTab({ result, hasFullAccess, onOpenOneTime, onOpenSubscription }: Props) {
  return (
    <div className="glass-card p-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom, #94a3b8, #cbd5e1)' }} />
        <div>
          <p className="text-white/25 text-xs font-garamond italic">Numerology</p>
          <h2 className="text-white font-semibold text-base">数秘術</h2>
        </div>
      </div>

      {/* 常時表示：ライフパスナンバー */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-full border-2 border-white/20 flex items-center justify-center flex-shrink-0"
          style={{ background: 'radial-gradient(circle, rgba(148,163,184,0.15) 0%, transparent 70%)' }}>
          <span className="text-white text-3xl font-bold font-garamond">{result.lifePathNumber}</span>
        </div>
        <div className="space-y-1">
          <p className="text-white/40 text-xs">ライフパスナンバー</p>
          <p className="text-white font-bold text-xl">{result.meaning.title}</p>
          <p className="text-white/60 text-sm leading-relaxed">{result.meaning.summary}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/5 pt-4">
        <div className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center flex-shrink-0">
          <span className="text-white/70 text-lg font-garamond">{result.birthdayNumber}</span>
        </div>
        <div>
          <p className="text-white/40 text-xs">誕生日ナンバー</p>
          <p className="text-white/70 text-sm">あなたが持って生まれた資質を示す数</p>
        </div>
      </div>

      {/* 詳細セクション（blur対象） */}
      <div className="relative">
        <div className={`space-y-4 ${!hasFullAccess ? 'blur-sm pointer-events-none select-none' : ''}`}>
          <div className="border-t border-white/5 pt-4 space-y-3">
            <div className="glass-card p-4 space-y-1" style={{ background: 'rgba(148,163,184,0.05)' }}>
              <p className="text-white/40 text-xs">才能・強み</p>
              <p className="text-white/85 text-sm font-semibold">{result.meaning.talent}</p>
            </div>
            <div className="glass-card p-4 space-y-1" style={{ background: 'rgba(148,163,184,0.05)' }}>
              <p className="text-white/40 text-xs">人生の使命・テーマ</p>
              <p className="text-white/85 text-sm font-semibold">{result.meaning.mission}</p>
            </div>
          </div>
        </div>

        {!hasFullAccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 px-2 gap-2"
            style={{ background: 'linear-gradient(to top, rgba(8,15,40,1) 0%, rgba(8,15,40,0.85) 40%, transparent 100%)' }}>
            <p className="text-white font-semibold text-sm text-center">6占術の完全鑑定書を受け取る</p>
            <button onClick={onOpenOneTime}
              className="w-full py-2.5 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all">
              9,800円で鑑定書を受け取る
            </button>
            <button onClick={onOpenSubscription}
              className="w-full py-2.5 border border-white/20 text-white/60 hover:text-white/80 rounded-lg text-sm transition-all">
              1,980円/月のプレミアム会員になる
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
