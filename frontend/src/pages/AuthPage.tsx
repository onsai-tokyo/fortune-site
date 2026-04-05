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

  useEffect(() => {
    const detectRegistration = () => {
      const hash = window.location.hash
      const hashParams = new URLSearchParams(hash.substring(1))
      const searchParams = new URLSearchParams(window.location.search)

      console.log('[AuthPage] ====================')
      console.log('[AuthPage] Full URL:', window.location.href)
      console.log('[AuthPage] Hash:', hash)
      console.log('[AuthPage] Hash params:', Object.fromEntries(hashParams.entries()))
      console.log('[AuthPage] Search params:', Object.fromEntries(searchParams.entries()))

      const isSignup = hashParams.get('type') === 'signup' || searchParams.get('type') === 'signup'
      const hasAccessToken = !!hashParams.get('access_token')

      console.log('[AuthPage] isSignup:', isSignup)
      console.log('[AuthPage] hasAccessToken:', hasAccessToken)

      if (isSignup || hasAccessToken) {
        console.log('[AuthPage] 🎉 REGISTRATION COMPLETE DETECTED!')
        console.log('[AuthPage] Setting localStorage flag...')

        // フラグを設定
        try {
          localStorage.setItem('show_registration_complete', 'true')
          const verify = localStorage.getItem('show_registration_complete')
          console.log('[AuthPage] Flag verification:', verify)

          if (verify !== 'true') {
            console.error('[AuthPage] ❌ Failed to set flag!')
          } else {
            console.log('[AuthPage] ✅ Flag successfully set!')
          }
        } catch (e) {
          console.error('[AuthPage] ❌ localStorage error:', e)
        }

        setMessage('🎉 登録が完了しました！ようこそ、宿命解析へ。ウェルカムボーナス3ptをプレゼントしました。')

        // URLをクリーンにする
        setTimeout(() => {
          console.log('[AuthPage] Cleaning URL...')
          window.history.replaceState({}, '', window.location.pathname)
        }, 100)
      } else {
        console.log('[AuthPage] No registration detected')
      }
      console.log('[AuthPage] ====================')
    }

    detectRegistration()
  }, [])

  useEffect(() => {
    if (user && !message.includes('認証が完了')) navigate('/', { replace: true })
    else if (user && message.includes('認証が完了')) {
      const t = setTimeout(() => navigate('/', { replace: true }), 3000)
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
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
          throw new Error('User already registered')
        }
        setMessage('確認メールを送信しました。メールのリンクをクリックして登録を完了してください。')
        pixel.trackCompleteRegistration()
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
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
    <div className="min-h-screen bg-deep-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-block">
            <h1 className="text-2xl font-bold text-white">宿命解析</h1>
            <p className="text-accent text-xs mt-1">6占術 AI統合命式鑑定</p>
          </button>
        </div>

        <div className="glass-card p-6 space-y-5">
          <h2 className="text-white font-semibold text-lg text-center">{titles[mode]}</h2>

          {message && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-green-400 text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="example@email.com"
                className="w-full bg-navy-light border border-white/10 rounded-lg px-3 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/50"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="text-white/50 text-xs mb-1 block">パスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="8文字以上"
                  minLength={8}
                  className="w-full bg-navy-light border border-white/10 rounded-lg px-3 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/50"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg transition-all disabled:opacity-50 text-sm"
            >
              {isLoading ? '処理中...' : titles[mode]}
            </button>
          </form>

          <div className="space-y-2 pt-2 border-t border-white/10">
            {mode === 'login' && (
              <>
                <button
                  onClick={() => { setMode('register'); setError(''); setMessage('') }}
                  className="w-full text-center text-white/40 hover:text-white/70 text-xs py-1 transition-colors"
                >
                  アカウントをお持ちでない方 → 新規登録
                </button>
                <button
                  onClick={() => { setMode('reset'); setError(''); setMessage('') }}
                  className="w-full text-center text-white/30 hover:text-white/50 text-xs py-1 transition-colors"
                >
                  パスワードを忘れた方
                </button>
              </>
            )}
            {mode !== 'login' && (
              <button
                onClick={() => { setMode('login'); setError(''); setMessage('') }}
                className="w-full text-center text-white/40 hover:text-white/70 text-xs py-1 transition-colors"
              >
                ログインはこちら
              </button>
            )}
          </div>
        </div>

        <p className="text-white/20 text-xs text-center mt-4">
          登録することで利用規約・プライバシーポリシーに同意したものとみなします
        </p>
      </div>
    </div>
  )
}
