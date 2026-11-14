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

  async function login(event: FormEvent) {
    event?.preventDefault()
    if (!remoteMode || working.current || (anonymous && !switchAllowed)) return
    working.current = true
    setBusy(true); setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (!alive.current) return
      if (error || !data.session || data.session.user.is_anonymous) setError('メールアドレス・パスワードを確認してください。パスワード未設定の方はメールコードでログインできます。')
      else { setPassword(''); navigate(next, { replace: true }) }
    } catch { if (alive.current) setError('接続できませんでした。時間をおいてお試しください。') }
    finally { working.current = false; if (alive.current) setBusy(false) }
  }
  return <section className="flex flex-col gap-4 border-t border-fl-line pt-6">
    <h2 className="m-0 text-base font-medium">ほかの方法でログイン</h2>
    {!remoteMode && <p className="text-xs text-fl-muted">見本画面ではパスワード認証は実行しません。</p>}
    {anonymous && <label className="flex gap-3 text-sm leading-relaxed"><input type="checkbox" checked={switchAllowed} onChange={e => setSwitchAllowed(e.target.checked)} />今の匿名アカウントから切り替えます。</label>}
    <form onSubmit={e => void login(e)} className="flex flex-col gap-3">
      <Field id="password-login-email" label="メールアドレス" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
      <Field id="password-login-password" label="パスワード" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      <Button type="submit" variant="secondary" disabled={!remoteMode || busy || !email.trim() || !password || (anonymous && !switchAllowed)}>パスワードでログイン</Button>
    </form>
    {error && <p role="alert" className="text-sm text-fl-danger">{error}</p>}
  </section>
}
