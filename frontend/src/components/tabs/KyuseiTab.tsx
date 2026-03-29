import type { KyuseiResult } from '../../lib/types'

interface Props {
  result: KyuseiResult
  hasFullAccess: boolean
  onOpenOneTime: () => void
  onOpenSubscription: () => void
}

const STAR_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#78716c', 3: '#4ade80', 4: '#86efac',
  5: '#ca8a04', 6: '#e5e7eb', 7: '#f87171', 8: '#d1d5db', 9: '#c084fc',
}

export function KyuseiTab({ result, hasFullAccess, onOpenOneTime, onOpenSubscription }: Props) {
  const starColor = STAR_COLORS[result.honmeiStar] ?? '#94a3b8'

  return (
    <div className="glass-card p-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom, #4ade80, #86efac)' }} />
        <div>
          <p className="text-white/25 text-xs italic">Kyusei Kigaku</p>
          <h2 className="text-white font-semibold text-base">九星気学</h2>
        </div>
      </div>

      {/* 常時表示：本命星・月命星 */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center flex-shrink-0"
          style={{ borderColor: `${starColor}40`, background: `radial-gradient(circle, ${starColor}20 0%, transparent 70%)` }}>
          <div className="text-center">
            <p className="text-xs" style={{ color: starColor, opacity: 0.7 }}>本命</p>
            <p className="text-white font-bold text-lg leading-tight">{result.honmeiStar}</p>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-white/40 text-xs">本命星</p>
          <p className="text-white font-bold text-xl" style={{ color: starColor }}>{result.honmeiName}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/40 text-xs">月命星：</span>
            <span className="text-white/70 text-xs">{result.tsukimeiName}</span>
            <span className="text-white/25 text-xs">|</span>
            <span className="text-white/40 text-xs">五行：</span>
            <span className="text-white/70 text-xs">{result.element}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-4">
        <p className="text-white/40 text-xs mb-2">基本気質</p>
        <p className="text-white/75 text-sm leading-relaxed">{result.personality}</p>
      </div>

      {/* 詳細セクション（blur対象） */}
      <div className="relative">
        <div className={`space-y-3 ${!hasFullAccess ? 'blur-sm pointer-events-none select-none' : ''}`}>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 space-y-1" style={{ background: `${starColor}10` }}>
              <p className="text-white/40 text-xs">吉方位</p>
              <p className="text-white/85 text-sm font-semibold">{result.luckyDirection}</p>
            </div>
            <div className="glass-card p-3 space-y-1" style={{ background: `${starColor}10` }}>
              <p className="text-white/40 text-xs">ラッキーカラー</p>
              <p className="text-white/85 text-sm font-semibold">{result.luckyColor}</p>
            </div>
          </div>
          <div className="glass-card p-4 space-y-1" style={{ background: `${starColor}08` }}>
            <p className="text-white/40 text-xs">今年の運勢</p>
            <p className="text-white/85 text-sm leading-relaxed">{result.yearFortune}</p>
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
