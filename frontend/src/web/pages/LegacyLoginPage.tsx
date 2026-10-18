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

  async function google() {
    if (!remoteMode || working.current) return
    working.current = true; setBusy(true); setMessage('')
    try {
      const redirectTo = `${window.location.origin}/legacy/login?oauth=1&returnTo=${encodeURIComponent(next)}`
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      if (error && mounted.current) setMessage('Googleログインを開始できませんでした。')
    } catch { if (mounted.current) setMessage('Googleログインを開始できませんでした。') }
    finally { working.current = false; if (mounted.current) setBusy(false) }
  }

  return <Page><PlainHeader /><section className="space-y-5 px-6 py-8">
    <h1 className="text-2xl">以前のアカウントでログイン</h1>
    <p>以前のWeb版で使った方法でログインすると、保存した鑑定を閲覧できます。iPhoneアプリのデータを新Webの本棚へ移す操作ではありません。</p>
    <p className="text-sm">この端末のアカウントは切り替わります。今の匿名アカウントを残したい場合は、先に設定から引き継ぎ用メールを登録してください。</p>
    {!remoteMode && <p role="status">見本データモードではログインしません。</p>}
    {message && <p role="alert">{message}</p>}
    <form onSubmit={login} className="space-y-4">
      <label className="block">メールアドレス<input className="block w-full rounded border p-3" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block">パスワード<input className="block w-full rounded border p-3" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <Button type="submit" disabled={!remoteMode || busy || !email.trim() || !password}>ログインする</Button>
    </form>
    <Button variant="outline" disabled={!remoteMode || busy} onClick={() => void google()}>Googleでログイン</Button>
    <p className="text-sm">以前使ったGoogleアカウントを選んでください。別のGoogleアカウントでは元の鑑定は開けません。</p>
    <p><Link className="underline" to={`/restore?returnTo=${encodeURIComponent(next)}`}>新Web版のメールコードで引き継ぐ</Link></p>
    <p>新しく使う方は<Link className="underline" to="/welcome">出生情報の入力へ</Link>。ログインできない場合は<Link className="underline" to="/support">お問い合わせ</Link>ください。</p>
  </section></Page>
}
