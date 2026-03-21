import { useNavigate } from 'react-router-dom'

export default function PaymentSuccessPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-deep-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-8">
        <div>
          <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center mx-auto mb-6">
            <span className="text-accent text-2xl">✦</span>
          </div>
          <h1 className="text-white font-bold text-2xl font-serif mb-3">ご購入ありがとうございます</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            プレミアム会員として登録が完了しました。<br />
            命術師AIへの相談が今すぐご利用いただけます。
          </p>
        </div>

        <div className="glass-card p-5 border border-accent/20 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 rounded-full bg-accent" />
            <p className="text-white/70 text-sm">AIに何でも相談 — 無制限</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 rounded-full bg-accent" />
            <p className="text-white/70 text-sm">6占術 統合命式鑑定 — 何度でも</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 rounded-full bg-accent" />
            <p className="text-white/70 text-sm">有効期間：30日間</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all"
        >
          トップに戻って鑑定を始める
        </button>
      </div>
    </div>
  )
}
