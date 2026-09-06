import { Link } from 'react-router-dom'

// Legacy localStorage has no owner attribution. Preserve its bytes, but never display it.
export default function CompatReportPage() {
  return <div className="min-h-screen bg-deep-navy flex items-center justify-center px-4">
    <div className="glass-card p-6 space-y-4 max-w-md">
      <h1 className="text-white text-lg font-semibold">相性鑑定の保存先が変わりました</h1>
      <p className="text-white/60 text-sm">保存済みの鑑定は、ログイン後に鑑定履歴から確認できます。</p>
      <Link to="/reading/history" className="block text-accent">鑑定履歴を開く</Link>
      <Link to="/feature/compat" className="block text-accent">相性鑑定を開く</Link>
    </div>
  </div>
}
