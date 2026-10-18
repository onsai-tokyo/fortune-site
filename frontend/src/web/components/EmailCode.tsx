import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Field } from './ui'
import { supabase } from '../../lib/supabase'
import { requestCaptchaToken } from '../../lib/turnstile'

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

/**
 * メールに届く6桁のコードで本人確認する入力（パスワードなし）。
 * - 引き継ぎの設定（匿名アカウントにメールをひも付ける）
 *     本番：supabase.auth.updateUser({ email }) → verifyOtp({ email, token, type: 'email_change' })
 * - 別の端末からの引き継ぎ（ひも付け済みアカウントを開く）
 *     本番：supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, captchaToken } })
 *           → verifyOtp({ email, token, type: 'email' })
 * Supabaseのメールテンプレートで {{ .Token }}（6桁のコード）を本文に入れておくこと。
 */
export function EmailCode({ initialEmail = '', sendLabel, verifyLabel, onVerified, idPrefix }: {
  initialEmail?: string
  sendLabel: string
  verifyLabel: string
  onVerified: (email: string) => void
  idPrefix: string
}) {
  const [email, setEmail] = useState(initialEmail)
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  useEffect(() => { if (step === 'code') codeRef.current?.focus() }, [step])

  async function send(e?: FormEvent) {
    e?.preventDefault()
    if (sending || cooldown > 0) return
    if (!emailOk(email)) { setError('メールアドレスを確かめてください。'); return }
    setError(null)
    setSending(true)
    try {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
        const captchaToken = idPrefix === 'link' ? undefined : await requestCaptchaToken(import.meta.env.VITE_TURNSTILE_SITE_KEY)
        const result = idPrefix === 'link'
          ? await supabase.auth.updateUser({ email: email.trim() })
          : await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, captchaToken } })
        if (result.error) { setError(result.error.message || 'コードを送信できませんでした。'); return }
      }
      setCode(''); setStep('code'); setCooldown(60)
    } catch {
      setError('人間確認またはコード送信が完了しませんでした。もう一度お試しください。')
    } finally { setSending(false) }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    // 画面確認用：6桁なら通す。本番はサーバーの判定（期限切れ・間違い）をそのまま表示する
    if (!/^\d{6}$/.test(code)) { setError('メールに届いた6桁の数字を入力してください。'); return }
    setError(null)
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      const result = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: idPrefix === 'link' ? 'email_change' : 'email' })
      if (result.error) { setError(result.error.message || 'コードを確認できませんでした。'); return }
    }
    onVerified(email.trim())
  }

  if (step === 'email') {
    return (
      <form onSubmit={send} noValidate className="flex flex-col gap-3">
        <Field id={`${idPrefix}-email`} label="メールアドレス" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com"
          value={email} onChange={e => { setEmail(e.target.value); setError(null) }} />
        {error && <p role="alert" className="m-0 text-[13px] text-fl-danger">{error}</p>}
        <Button type="submit" disabled={!email.trim() || sending || cooldown > 0}>{sending ? '確認しています…' : cooldown > 0 ? `再送まで${cooldown}秒` : sendLabel}</Button>
      </form>
    )
  }

  return (
    <form onSubmit={verify} noValidate className="flex flex-col gap-3">
      <p className="m-0 text-sm leading-[1.85] text-fl-body"><strong className="font-medium text-fl-ink">{email}</strong> に6桁のコードを送りました。10分以内に入力してください。届かない場合は迷惑メールフォルダもご確認ください。</p>
      <Field ref={codeRef} id={`${idPrefix}-code`} label="確認コード（6桁）" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456"
        value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(null) }}
        className="tracking-[0.4em]" />
      {error && <p role="alert" className="m-0 text-[13px] text-fl-danger">{error}</p>}
      <Button type="submit" disabled={code.length !== 6}>{verifyLabel}</Button>
      <div className="flex flex-wrap justify-between gap-x-4 text-[13px]">
        <button type="button" onClick={() => { setStep('email'); setError(null) }} className="flex min-h-[44px] items-center text-fl-body">メールアドレスを直す</button>
        <button type="button" disabled={cooldown > 0 || sending} onClick={() => send()} className="flex min-h-[44px] items-center text-fl-body disabled:text-fl-muted">
          {cooldown > 0 ? `コードを再送（${cooldown}秒後）` : 'コードを再送する'}
        </button>
      </div>
    </form>
  )
}
