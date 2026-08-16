import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Trait = { id: string; category: 'decision' | 'work' | 'love' | 'relation' | 'value'; text: string }
const labels = { decision: '決め方', work: '仕事', love: '恋愛・結婚', relation: '人との関わり', value: '大切にしていること' }
const API_FALLBACK = 'https://fortune-site-iuzo.onrender.com'

async function request(path: string, init?: RequestInit) {
  let response: Response | null = null
  try { response = await fetch(path, init); if (response.status < 500) return response } catch { /* fallback */ }
  try { return await fetch(`${API_FALLBACK}${path}`, init) } catch { if (response) return response; throw new Error('鑑定サーバーへ接続できませんでした') }
}

export default function ProfilePage() {
  const { user, session, isLoading } = useAuth()
  const [traits, setTraits] = useState<Trait[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }

  useEffect(() => {
    if (!session?.access_token) { setLoading(false); return }
    void request('/api/reading/profile/traits', { headers }).then(async response => {
      const body = await response.json().catch(() => ({}))
      if (!response.ok) setError(body.error ?? 'プロフィールを取得できませんでした')
      else setTraits(body.traits ?? [])
      setLoading(false)
    }).catch(cause => { setError(cause instanceof Error ? cause.message : 'プロフィールを取得できませんでした'); setLoading(false) })
  }, [session?.access_token])

  async function removeTrait(trait: Trait) {
    if (!window.confirm('この項目を削除しますか？')) return
    const response = await request(`/api/reading/profile/traits/${trait.id}`, { method: 'DELETE', headers })
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error ?? '削除できませんでした'); return }
    setTraits(previous => previous.filter(item => item.id !== trait.id))
  }

  if (isLoading) return <main className="min-h-screen bg-[#faf7ef]" />
  if (!user) return <main className="min-h-screen bg-[#faf7ef] px-5 py-16 text-[#211d18]"><section className="mx-auto max-w-lg rounded-2xl border border-[#d8c79e] bg-[#fffdf8] p-8"><h1 className="text-2xl">あなたについて</h1><p className="mt-4 leading-8 text-[#62594f]">保存した内容を見るにはログインしてください。</p><Link to="/auth?returnTo=%2Fme" className="mt-6 block rounded-lg bg-[#9a6d16] py-4 text-center text-white">ログイン</Link></section></main>

  return <main className="reading-page min-h-screen bg-[#faf7ef] px-5 py-10 text-[#211d18]">
    <div className="mx-auto max-w-2xl">
      <Link to="/reading/history" className="text-sm text-[#5c5349]">← 鑑定書に戻る</Link>
      <header className="mt-8 border-b border-[#d8c79e] pb-8"><p className="text-xs tracking-[.25em] text-[#9a762b]">FATE LAB · YOUR PROFILE</p><h1 className="mt-3 text-3xl leading-relaxed">あなたについて<br />わかってきたこと</h1>{traits.length > 0 && <p className="mt-5 text-5xl text-[#8c681e]">{traits.length}</p>}<p className="mt-4 leading-7 text-[#62594f]">質問を重ねながら「合っている」と選んだ内容だけを、ここへ保存します。</p></header>
      {error && <p className="mt-6 rounded-xl border border-[#c98775] bg-[#fff6f2] p-4 text-[#7f3427]">{error}</p>}
      {loading ? <p className="py-10 text-[#62594f]">内容を確認しています…</p> : traits.length === 0 ? <section className="py-12 text-center"><h2 className="text-xl">まだ何も保存されていません。</h2><p className="mt-5 leading-8 text-[#62594f]">鑑定書について質問すると、<br />会話からわかったことがここに保存されます。</p><Link to="/reading/history" className="mt-7 block rounded-lg bg-[#9a6d16] py-4 text-white">鑑定書について質問する</Link></section> : <section className="py-9 space-y-9">{Object.entries(labels).map(([category, label]) => {
        const items = traits.filter(item => item.category === category)
        if (!items.length) return null
        return <section key={category}><h2 className="border-l-2 border-[#b78a32] pl-4 text-xl">{label}</h2><ul className="mt-4 divide-y divide-[#e8dfce] border-y border-[#e8dfce]">{items.map(item => <li key={item.id} className="flex items-start justify-between gap-4 py-4"><span className="font-sans leading-7 text-[#3d3832]">・{item.text}</span><button onClick={() => void removeTrait(item)} className="shrink-0 text-xs text-[#8b453b]">削除</button></li>)}</ul></section>
      })}<Link to="/reading/history" className="block rounded-lg border border-[#bfa66e] py-4 text-center text-[#70531e]">鑑定書について質問する</Link></section>}
    </div>
  </main>
}
