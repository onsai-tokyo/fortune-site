import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

type ShareSummary = {
  tagline: string
  familyCount: number | null
  elements: Record<string, number>
}

const API_FALLBACK = 'https://fortune-site-iuzo.onrender.com'
const elementColors: Record<string, string> = { 木: '#66876a', 火: '#b56850', 土: '#a78955', 金: '#aa9d83', 水: '#58758a' }

export default function SharedReadingPage() {
  const { shareId = '' } = useParams<{ shareId: string }>()
  const [summary, setSummary] = useState<ShareSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      let response: Response
      try {
        response = await fetch(`/api/reading/shares/${encodeURIComponent(shareId)}`)
        if (response.status >= 500) response = await fetch(`${API_FALLBACK}/api/reading/shares/${encodeURIComponent(shareId)}`)
      } catch {
        try { response = await fetch(`${API_FALLBACK}/api/reading/shares/${encodeURIComponent(shareId)}`) }
        catch { setError('共有ページへ接続できませんでした'); return }
      }
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.share?.summary) { setError(body.error ?? '共有ページが見つかりません'); return }
      setSummary(body.share.summary)
    })()
  }, [shareId])

  return <main className="min-h-screen bg-[#faf7ef] px-5 py-12 text-[#211d18]">
    <article className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-[#d8c79e] bg-[#fffdf8] shadow-[0_20px_60px_rgba(83,61,25,.10)]">
      <header className="border-b border-[#e5d8ba] bg-[#f7f0df] px-7 py-7">
        <p className="text-xs tracking-[.28em] text-[#9a762b]">FATE LAB · READING NOTE</p>
        <h1 className="mt-3 text-2xl">鑑定書の要点</h1>
      </header>
      <section className="px-7 py-8">
        {error && <p className="rounded-xl border border-[#c98775] bg-[#fff6f2] p-4 text-[#7f3427]">{error}</p>}
        {!summary && !error && <p className="text-[#62594f]">要点を読み込んでいます…</p>}
        {summary && <>
          <p className="text-sm text-[#7a7065]">一言で表すと</p>
          <p className="mt-3 border-l-2 border-[#b78a32] pl-5 text-2xl leading-relaxed">{summary.tagline}</p>
          {summary.familyCount != null && <div className="mt-8 border-y border-[#e5d8ba] py-5"><p className="text-sm text-[#62594f]">一致の印</p><p className="mt-2 tracking-[.35em] text-[#9a762b]">{'●'.repeat(summary.familyCount)}{'○'.repeat(Math.max(0, 4 - summary.familyCount))}</p></div>}
          <div className="mt-8">
            <h2 className="text-lg">五行バランス</h2>
            <div className="mt-5 grid gap-3">{['木', '火', '土', '金', '水'].map(key => {
              const values = Object.values(summary.elements)
              const max = Math.max(1, ...values)
              const value = summary.elements[key] ?? 0
              return <div key={key} className="grid grid-cols-[2rem_1fr_3rem] items-center gap-3"><span>{key}</span><span className="h-2 overflow-hidden rounded-full bg-[#eee6d6]"><span className="block h-full rounded-full" style={{ width: `${Math.max(2, value / max * 100)}%`, background: elementColors[key] }} /></span><span className="text-right text-sm tabular-nums text-[#62594f]">{value}</span></div>
            })}</div>
          </div>
          <p className="mt-8 rounded-xl bg-[#f7f2e6] px-4 py-3 text-sm leading-7 text-[#62594f]">この共有ページに、生年月日・出生時刻・出生地・性別は含まれていません。</p>
        </>}
        <Link to="/" className="mt-7 block rounded-xl bg-[#9a6d16] py-4 text-center text-white">自分の鑑定書を作る</Link>
      </section>
    </article>
  </main>
}
