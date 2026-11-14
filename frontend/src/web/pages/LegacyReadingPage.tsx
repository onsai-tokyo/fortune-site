import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Page, PlainHeader } from '../components/ui'
import { API_BASE } from '../data/api'

type Card = { id: string; title: string; summary?: string; access?: { locked: boolean }; pages?: { label?: string; text?: string }[]; sections?: { heading: string; body: string }[] }
type Reading = { title: string; text?: string; familyCount?: number; cards?: Card[]; messages?: { role: string; content: string }[] }

/** Compatibility is GET-only. Tokens are never treated as public authorization. */
export function LegacyReadingPage({ identifier }: { identifier: 'id' | 'token' | 'share' }) {
  const { conversationId = '', secretToken = '', shareId = '' } = useParams()
  const location = useLocation()
  const [value, setValue] = useState<Reading | null>(null)
  const [notice, setNotice] = useState('読み込んでいます…')
  const revision = useRef(0)
  useEffect(() => {
    const current = ++revision.current
    let owner: string | undefined
    const controller = new AbortController()
    setValue(null); setNotice('読み込んでいます…')
    const invalidate = () => { revision.current++; controller.abort(); setValue(null); setNotice('アカウントが変わりました。再読み込みしてください。') }
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (identifier !== 'share' && (event === 'SIGNED_OUT' || (owner && session?.user.id !== owner))) invalidate()
    })
    // Also fail closed when another tab clears/replaces persisted auth before
    // the SDK's BroadcastChannel notification has arrived.
    const storageChanged = (event: StorageEvent) => {
      if (identifier === 'share' || !owner) return
      if (event.key === null) { invalidate(); return }
      const project = new URL(import.meta.env.VITE_SUPABASE_URL ?? 'https://mock.invalid').hostname.split('.')[0]
      if (event.key !== `sb-${project}-auth-token`) return
      try { if (!event.newValue || JSON.parse(event.newValue)?.user?.id !== owner) invalidate() }
      catch { invalidate() }
    }
    window.addEventListener('storage', storageChanged)
    void (async () => {
      const headers = new Headers()
      if (identifier !== 'share') {
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) throw new Error('この鑑定を保存したアカウントでのログインが必要です。別のアカウントでは開けません。')
        owner = data.session.user.id
        headers.set('Authorization', `Bearer ${data.session.access_token}`)
      }
      const get = async (path: string) => {
        const response = await fetch(`${API_BASE}/api/reading${path}`, { headers, signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 401 ? 'ログインを確認できませんでした。' : response.status === 404 || response.status === 403 ? 'この鑑定は見つからないか、閲覧する権限がありません。' : '取得できませんでした。時間をおいて再読み込みしてください。')
        return response.json()
      }
      let result: Reading
      if (identifier === 'share') {
        const body = await get(`/shares/${encodeURIComponent(shareId)}`)
        const summary = body.share?.summary
        if (!summary || typeof summary.tagline !== 'string') throw new Error('共有ページが見つかりません。')
        result = { title: '鑑定書の要点', text: summary.tagline, familyCount: Number.isInteger(summary.familyCount) ? Math.max(0, Math.min(4, summary.familyCount)) : undefined, cards: ['木', '火', '土', '金', '水'].map(key => ({ id: key, title: key, summary: String(summary.elements?.[key] ?? 0) })) }
      } else {
        const body = await get(identifier === 'token' ? `/reports/${encodeURIComponent(secretToken)}` : `/conversations/${encodeURIComponent(conversationId)}`)
        const id = body.conversation?.id
        if (typeof id !== 'string' || !id) throw new Error('鑑定履歴が見つかりません。')
        // Always use server-projected cards, never an unprojected saved report_text.
        const report = await get(`/${encodeURIComponent(id)}/cards`)
        result = { title: body.conversation.title ?? '保存した鑑定', cards: report.cards ?? [], messages: body.messages ?? [] }
      }
      if (revision.current === current) { setValue(result); setNotice('') }
    })().catch(error => {
      if (revision.current === current && !controller.signal.aborted) setNotice(error instanceof Error ? error.message : '取得できませんでした。')
    })
    return () => { revision.current++; controller.abort(); listener.subscription.unsubscribe(); window.removeEventListener('storage', storageChanged) }
  }, [identifier, conversationId, secretToken, shareId])

  return <Page><PlainHeader /><article className="space-y-6 px-6 py-8 break-words">
    <h1 className="text-2xl">{value?.title ?? (identifier === 'share' ? '鑑定書の要点' : '保存した鑑定')}</h1>
    {notice && <p role="status">{notice}</p>}
    {value?.text && <p className="whitespace-pre-wrap">{value.text}</p>}
    {value?.familyCount != null && <p>一致の印：{'●'.repeat(value.familyCount)}{'○'.repeat(4 - value.familyCount)}</p>}
    {identifier === 'share' && <p className="text-sm">この共有ページに、生年月日・出生時刻・出生地・性別は含まれていません。</p>}
    {value?.cards?.map(card => <section key={card.id} className="space-y-3 border-b border-fl-line pb-5"><h2 className="text-lg">{card.title}</h2>
      {card.access?.locked ? <p>この章はロックされています。Web版では現在、購入できません。</p> : <><p className="whitespace-pre-wrap">{card.summary}</p>{(card.sections?.map(p => ({ label: p.heading, text: p.body })) ?? card.pages ?? []).map((p, i) => <div key={i}>{p.label && <h3>{p.label}</h3>}<p className="whitespace-pre-wrap">{p.text}</p></div>)}</>}
    </section>)}
    {value?.messages?.map((m, i) => <section key={i}><h2>{m.role === 'user' ? 'あなたの質問' : '回答'}</h2><p className="whitespace-pre-wrap">{m.content}</p></section>)}
    <p className="text-sm">このページは閲覧専用です。新しい購入・生成・質問の送信は行いません。</p>
    {!value && identifier !== 'share' && <p><Link className="underline" to={`/legacy/login?returnTo=${encodeURIComponent(location.pathname)}`}>以前のアカウントでログイン</Link>。新Web版の引き継ぎ用メールを登録した方は<Link className="underline" to={`/restore?returnTo=${encodeURIComponent(location.pathname)}`}>メールコードで引き継ぐ</Link>こともできます。</p>}
    <Link className="underline" to="/">トップへ</Link>
  </article></Page>
}
