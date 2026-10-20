import { useState, useRef, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { remoteMode } from '../data/paymentConfig'
import { Button, Field } from './ui'

export function PasswordSetup() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!remoteMode || working.current || password.length < 12 || password !== confirmation) return
    working.current = true; setBusy(true); setMessage('')
    try {
      const url = import.meta.env.VITE_SUPABASE_URL
      const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!url || !publicKey) throw new Error('AUTH_CONFIG_MISSING')
      const { data: current, error } = await supabase.auth.getSession()
      const session = current.session
      if (error || !session || session.user.is_anonymous || !session.user.email_confirmed_at) throw new Error('VERIFY_EMAIL_FIRST')
      // Bind the request to this verified session, not the mutable global auth
      // session. A concurrent account switch must never change its recipient.
      const response = await fetch(`${url}/auth/v1/user`, {
        method: 'PUT',
        headers: { apikey: publicKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const { data: latest } = await supabase.auth.getSession()
      if (latest.session?.user.id !== session.user.id) {
        setPassword(''); setConfirmation('')
        setMessage('アカウントが切り替わりました。設定画面を開き直してください。')
        return
      }
      if (!response.ok) throw new Error('PASSWORD_UPDATE_FAILED')
      setPassword(''); setConfirmation('')
      setMessage('パスワードを設定しました。次回からメールアドレスとパスワードでもログインできます。')
    } catch { setMessage('設定できませんでした。メールコードでログインし直して、再度お試しください。') }
    finally { working.current = false; setBusy(false) }
  }
  return <form onSubmit={save} className="flex flex-col gap-3 rounded-card border border-fl-line bg-white p-5">
    <h2 className="m-0 text-base font-medium">パスワードを設定する（任意）</h2>
    <p className="m-0 text-xs leading-relaxed text-fl-muted">初回はメールの確認が必要です。設定後は、毎回コードを受け取らずにログインできます。忘れた場合もメールコードでログインできます。</p>
    <Field id="new-password" label="パスワード（12文字以上）" type="password" autoComplete="new-password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} />
    <Field id="confirm-password" label="パスワードをもう一度" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
    <Button type="submit" disabled={!remoteMode || busy || password.length < 12 || password !== confirmation}>{busy ? '設定しています…' : 'パスワードを設定'}</Button>
    {!remoteMode && <p className="text-xs text-fl-muted">見本画面ではパスワードは保存されません。</p>}
    {message && <p role="status" className="text-sm leading-relaxed">{message}</p>}
  </form>
}
