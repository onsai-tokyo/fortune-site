interface Props {
  onSubscribe: () => void
  onClose: () => void
}

export function UpgradeModal({ onSubscribe, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-sm p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full border border-accent/30 flex items-center justify-center mx-auto"
            style={{ background: 'radial-gradient(circle, rgba(148,163,184,0.15) 0%, transparent 70%)' }}>
            <span className="text-accent text-2xl">✦</span>
          </div>
          <h3 className="text-white font-semibold text-lg">鑑定書のご購入ありがとうございます</h3>
          <p className="text-white/50 text-sm leading-relaxed">
            PDFは2〜3分以内にメールでお届けします。
          </p>
        </div>

        <div className="glass-card p-4 space-y-2 border border-accent/20" style={{ background: 'rgba(148,163,184,0.05)' }}>
          <p className="text-accent text-xs font-semibold tracking-wider">プレミアム会員 — 1,980円/月</p>
          <p className="text-white/70 text-sm leading-relaxed">
            毎月AIが6占術を統合して今月の運勢をお届け。AIチャット相談も無制限でご利用いただけます。
          </p>
          <ul className="space-y-1 pt-1">
            {[
              '毎月1日：統合運勢レポート配信',
              '毎月15日：詳細アドバイス配信',
              'AIチャット相談し放題（無制限）',
            ].map(item => (
              <li key={item} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />
                <span className="text-white/60 text-xs">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <button
            onClick={onSubscribe}
            className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all"
          >
            1,980円/月のプレミアム会員になる
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            今回は鑑定書だけでいい
          </button>
        </div>
      </div>
    </div>
  )
}
