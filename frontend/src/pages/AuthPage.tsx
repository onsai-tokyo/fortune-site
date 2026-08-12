import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { pixel } from '../lib/pixel'

type Mode = 'login' | 'register' | 'reset'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const returnTo = params.get('returnTo')?.startsWith('/') ? params.get('returnTo')! : '/'

  useEffect(() => {
    const detectRegistration = () => {
      const hash = window.location.hash
      const hashParams = new URLSearchParams(hash.substring(1))
      const searchParams = new URLSearchParams(window.location.search)

      const isSignup = hashParams.get('type') === 'signup' || searchParams.get('type') === 'signup'
      const hasAccessToken = !!hashParams.get('access_token')

      if (isSignup || hasAccessToken) {
        try {
          localStorage.setItem('show_registration_complete', 'true')
        } catch (e) {
          console.error('[AuthPage] localStorage error:', e)
        }

        setMessage('登録が完了しました。鑑定結果の続きをご覧いただけます。')

        setTimeout(() => {
          window.history.replaceState({}, '', window.location.pathname)
        }, 100)
      }
    }

    detectRegistration()
  }, [])

  useEffect(() => {
    if (user && !message.includes('認証が完了')) navigate(returnTo, { replace: true })
    else if (user && message.includes('認証が完了')) {
      const t = setTimeout(() => navigate(returnTo, { replace: true }), 3000)
      return () => clearTimeout(t)
    }
  }, [user, navigate, message])

  useEffect(() => {
    if (params.get('mode') === 'register') setMode('register')
  }, [params])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth?returnTo=${encodeURIComponent(returnTo)}` } })
        if (error) throw error
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
          throw new Error('User already registered')
        }
        setMessage('確認メールを送信しました。メールのリンクをクリックして登録を完了してください。')
        pixel.trackCompleteRegistration()
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=login`,
        })
        if (error) throw error
        setMessage('パスワードリセットのメールを送信しました。')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'エラーが発生しました'
      if (msg.includes('Invalid login credentials')) {
        setError('メールアドレスまたはパスワードが正しくありません')
      } else if (msg.includes('Email not confirmed')) {
        setError('メールアドレスの確認が完了していません。確認メールをご確認ください。')
      } else if (msg.includes('User already registered')) {
        setError('このメールアドレスは既に登録されています')
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const titles: Record<Mode, string> = {
    login: 'ログイン',
    register: '新規登録',
    reset: 'パスワードリセット',
  }

  return (
    <div className="min-h-screen bg-[#faf7ef] text-[#211d18] flex items-center justify-center p-5 font-serif">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-block">
            <h1 className="text-2xl tracking-[.12em]">Fate Lab</h1>
            <p className="text-[#9a762b] text-xs tracking-[.12em] mt-2">9つの占術を照らし合わせる鑑定</p>
          </button>
        </div>

        <div className="border border-[#d8c79e] bg-[#fffdf8] rounded-2xl p-7 sm:p-9 space-y-6 shadow-[0_18px_50px_rgba(83,61,25,.08)]">
          <div className="text-center"><p className="text-[11px] tracking-[.24em] text-[#9a762b]">FATE LAB · MEMBER</p><h2 className="text-2xl mt-3">{titles[mode]}</h2></div>

          {message && (
            <div className="bg-[#f2eee2] border border-[#d8c79e] rounded-lg p-3">
              <p className="text-[#526044] text-sm leading-6">{message}</p>
            </div>
          )}

          {error && (
            <div className="bg-[#fff4ef] border border-[#d9a89a] rounded-lg p-3">
              <p className="text-[#8b3f31] text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[#6d6257] text-sm mb-2 block">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="example@email.com"
                className="w-full bg-white border border-[#d8c79e] rounded-lg px-4 py-3.5 text-[#211d18] text-sm placeholder-[#aaa095] focus:outline-none focus:border-[#9a762b]"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="text-[#6d6257] text-sm mb-2 block">パスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="8文字以上"
                  minLength={8}
                  className="w-full bg-white border border-[#d8c79e] rounded-lg px-4 py-3.5 text-[#211d18] text-sm placeholder-[#aaa095] focus:outline-none focus:border-[#9a762b]"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-[#9a6d16] hover:bg-[#825b11] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? '処理中...' : titles[mode]}
            </button>
          </form>

          <div className="space-y-2 pt-3 border-t border-[#e8dfcb]">
            {mode === 'login' && (
              <>
                <button
                  onClick={() => { setMode('register'); setError(''); setMessage('') }}
                  className="w-full text-center text-[#70531e] hover:text-[#4e3812] text-sm py-1 transition-colors"
                >
                  新規登録（無料）
                </button>
                <button
                  onClick={() => { setMode('reset'); setError(''); setMessage('') }}
                  className="w-full text-center text-[#867a6c] hover:text-[#5d5348] text-xs py-1 transition-colors"
                >
                  パスワードを忘れた方
                </button>
              </>
            )}
            {mode !== 'login' && (
              <button
                onClick={() => { setMode('login'); setError(''); setMessage('') }}
                className="w-full text-center text-[#70531e] hover:text-[#4e3812] text-sm py-1 transition-colors"
              >
                ログインはこちら
              </button>
            )}
          </div>
        </div>

        <p className="text-[#8a7e70] text-xs text-center mt-5 leading-6">
          登録することで利用規約・プライバシーポリシーに同意したものとみなします
        </p>
      </div>
    </div>
  )
}
