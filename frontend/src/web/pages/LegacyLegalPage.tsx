import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import snapshots from '../data/legacyLegalSnapshots.json'

export function LegacyLegalPage({ document }: { document: keyof typeof snapshots.documents }) {
  const location = useLocation()
  useEffect(() => {
    if (location.hash === '#ai-consultation') window.document.getElementById('ai-consultation')?.scrollIntoView()
  }, [location.hash])
  return <main className="break-words">
    <aside className="mx-auto max-w-4xl space-y-3 border-b border-fl-line p-6 text-sm leading-relaxed" aria-label="アプリ向け文書の保存版">
      <h2 className="text-xl font-medium">アプリ向け文書の保存版</h2>
      <p>参照元：main {snapshots.sourceCommit.slice(0, 7)}。Web版とは別の文書です。現在の公開サイトや配布済みアプリの文面との完全一致は未確認です。</p>
      <p>保存版は閲覧専用です。旧画面の動的な料金取得は行わず、元の初期表示文を保存しています。ここから購入や契約はできません。</p>
      <nav className="flex flex-wrap gap-4 underline" aria-label="アプリ向け保存文書"><Link to="/app-legal/terms">利用規約の保存版</Link><Link to="/app-legal/privacy">プライバシーポリシーの保存版</Link><Link to="/app-legal/tokushohou">特商法表記の保存版</Link></nav>
      <nav className="flex flex-wrap gap-4 underline" aria-label="現在のWeb版文書"><Link to="/terms">Web版の利用規約</Link><Link to="/privacy">Web版のプライバシーポリシー</Link><Link to="/tokushoho">Web版の特商法表記</Link></nav>
    </aside>
    {/* Trusted, checked-in server-rendered repository text; never API/user HTML. */}
    <div data-testid="legacy-legal-document" dangerouslySetInnerHTML={{ __html: snapshots.documents[document] }} />
  </main>
}
