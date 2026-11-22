import { useEffect } from 'react'
import { Page, PlainHeader } from '../components/ui'

// Client-side navigation cannot change the HTTP response status. Direct unknown
// requests are handled by the host's static 404.html and return HTTP 404.
export function NotFoundPage() {
  useEffect(() => {
    document.title = 'ページが見つかりません｜Fate Lab'
    const canonical = document.querySelector('link[rel="canonical"]')
    canonical?.remove()
    return () => {
      if (canonical && !document.querySelector('link[rel="canonical"]')) document.head.append(canonical)
    }
  }, [])
  return <Page>
    <PlainHeader />
    <main className="px-6 py-10 text-base leading-[1.9]">
      <p className="text-sm text-fl-muted">404</p>
      <h1 className="text-2xl font-medium">ページが見つかりません</h1>
      <p>URLが変更されたか、ページが削除された可能性があります。URLをご確認いただくか、以下のページからお探しください。</p>
      <nav aria-label="ページを探す" className="mt-8 flex flex-col items-start gap-3 text-fl-slate underline">
        <a className="min-h-[44px] py-2" href="/">トップページへ</a>
        <a className="min-h-[44px] py-2" href="/tools/">無料の計算ツール一覧</a>
        <a className="min-h-[44px] py-2" href="/guides/">占い解説一覧</a>
        <a className="min-h-[44px] py-2" href="/support">お問い合わせ</a>
      </nav>
    </main>
  </Page>
}
