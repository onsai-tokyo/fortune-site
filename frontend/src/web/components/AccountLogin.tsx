import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { safeReturnTo } from '../../lib/safeReturnTo'
import { remoteMode } from '../data/paymentConfig'
import { Button, Field } from './ui'

/** Existing-account login only. Never silently merges an anonymous account. */
export function AccountLogin({ anonymous }: { anonymous: boolean }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeReturnTo(params.get('returnTo'), '/books')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [switchAllowed, setSwitchAllowed] = useState(false)
  const working = useRef(false)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    if (params.get('oauth') !== '1' || !remoteMode) return
    let active = true
    const failed = params.has('error') || new URLSearchParams(location.hash.slice(1)).has('error')
    if (failed) setError('Googleログインを完了できませんでした。もう一度お試しください。')
    else void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (!error && data.session && !data.session.user.is_anonymous) navigate(next, { replace: true })
      else setError('ログインを確認できませんでした。もう一度お試しください。')
    }).catch(() => { if (active) setError('ログインを確認できませんでした。') })
    return () => { active = false }
  }, [params, next, navigate])

  async function login(method: 'password' | 'google', event?: FormEvent) {
    event?.preventDefault()
    if (!remoteMode || working.current || (anonymous && !switchAllowed)) return
    working.current = true
    setBusy(true); setError('')
    try {
      if (method === 'google') {
        // Fixed callback permits one exact allow-list entry; Google returns to
        // the bookshelf. Password/OTP can still honor a safe in-app returnTo.
        const redirectTo = `${location.origin}/restore?oauth=1`
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
        if (error && alive.current) setError('Googleログインを開始できませんでした。メールコードでもログインできます。')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (!alive.current) return
        if (error || !data.session || data.session.user.is_anonymous) setError('メールアドレス・パスワードを確認してください。パスワード未設定の方はメールコードでログインできます。')
        else { setPassword(''); navigate(next, { replace: true }) }
      }
    } catch { if (alive.current) setError('接続できませんでした。時間をおいてお試しください。') }
    finally { working.current = false; if (alive.current) setBusy(false) }
  }
  return <section className="flex flex-col gap-4 border-t border-fl-line pt-6">
    <h2 className="m-0 text-base font-medium">ほかの方法でログイン</h2>
    {!remoteMode && <p className="text-xs text-fl-muted">見本画面ではパスワード・Google認証は実行しません。</p>}
    {anonymous && <label className="flex gap-3 text-sm leading-relaxed"><input type="checkbox" checked={switchAllowed} onChange={e => setSwitchAllowed(e.target.checked)} />今の匿名アカウントから切り替えます。残したい鑑定は、先に無料登録で保存してください。</label>}
    <form onSubmit={e => void login('password', e)} className="flex flex-col gap-3">
      <Field id="password-login-email" label="メールアドレス" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
      <Field id="password-login-password" label="パスワード" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      <Button type="submit" variant="secondary" disabled={!remoteMode || busy || !email.trim() || !password || (anonymous && !switchAllowed)}>パスワードでログイン</Button>
    </form>
    <Button variant="secondary" disabled={!remoteMode || busy || (anonymous && !switchAllowed)} onClick={() => void login('google')}>Googleでログイン</Button>
    {error && <p role="alert" className="text-sm text-fl-danger">{error}</p>}
    <p className="m-0 text-xs leading-relaxed text-fl-muted">登録時と同じアカウントをお使いください。Googleでログインしても、今の匿名アカウントの本棚は自動では移りません。</p>
  </section>
}
