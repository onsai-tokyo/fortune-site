import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

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
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('確認メールを送信しました。メールのリンクをクリックして登録を完了してください。')
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
