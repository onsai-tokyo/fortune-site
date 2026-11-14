import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button, Page, PlainHeader } from '../components/ui'
import { remoteMode } from '../data/paymentConfig'
import { legacyReturnTo } from '../data/legacyReturnTo'

/** Existing password/Google authentication only. No signup/reset/payment calls. */
export function LegacyLoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = legacyReturnTo(params.get('returnTo'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const mounted = useRef(false)
  const callback = params.get('oauth') === '1'
  const callbackError = params.has('error') || params.has('error_description') || new URLSearchParams(location.hash.slice(1)).has('error')
  useEffect(() => {
    let active = true
    mounted.current = true
    if (callbackError) setMessage('ログインを完了できませんでした。もう一度お試しください。')
    if (callback && !callbackError && remoteMode) {
      // getSession waits for the SDK's URL-session recovery/code exchange.
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return
        if (!error && data.session && !data.session.user.is_anonymous) navigate(next, { replace: true })
        else setMessage('ログインを確認できませんでした。もう一度お試しください。')
      }).catch(() => { if (active) setMessage('ログインを確認できませんでした。') })
    }
    return () => { active = false; mounted.current = false }
  }, [callback, callbackError, navigate, next])

  async function login(event: FormEvent) {
    event.preventDefault()
    if (!remoteMode || working.current) return
    working.current = true; setBusy(true); setMessage('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (!mounted.current) return
      if (error || !data.session || data.session.user.is_anonymous) setMessage('ログインできませんでした。メールアドレス・パスワードと登録時の方法を確認してください。')
      else { setPassword(''); navigate(next, { replace: true }) }
    } catch { if (mounted.current) setMessage('接続できませんでした。時間をおいて再度お試しください。') }
    finally { working.current = false; if (mounted.current) setBusy(false) }
  }


  return <Page><PlainHeader /><section className="space-y-5 px-6 py-8">
    <h1 className="text-2xl">以前のアカウントでログイン</h1>
    <p>以前のWeb版で登録したメールアドレスでログインすると、保存した鑑定を閲覧できます。</p>
    <p className="text-sm">メール未登録のアカウントに過去の鑑定がある場合は、ブラウザーのデータを消す前に、<Link className="underline" to="/support">お問い合わせ</Link>ください。</p>
    {!remoteMode && <p role="status">見本データモードではログインしません。</p>}
    {message && <p role="alert">{message}</p>}
    <form onSubmit={login} className="space-y-4">
      <label className="block">メールアドレス<input className="block w-full rounded border p-3" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block">パスワード<input className="block w-full rounded border p-3" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <Button type="submit" disabled={!remoteMode || busy || !email.trim() || !password}>ログインする</Button>
    </form>
    <p className="text-sm">以前Googleでログインしていた方は、当時と同じメールアドレスで確認コードをお試しください。</p>
    <p><Link className="underline" to={`/restore?returnTo=${encodeURIComponent(next)}`}>登録済みのメールに確認コードを送る</Link></p>
    <p>新しく使う方は<Link className="underline" to="/welcome">出生情報の入力へ</Link>。ログインできない場合は<Link className="underline" to="/support">お問い合わせ</Link>ください。</p>
  </section></Page>
}
