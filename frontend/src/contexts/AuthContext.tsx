import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, Subscription, UserPoints } from '../lib/supabase'
import { clearAnalyzedFeatures } from '../lib/analyzedFeatures'

interface AuthContextValue {
  user: User | null
  session: Session | null
  subscription: Subscription | null
  userPoints: UserPoints | null
  isLoading: boolean
  isPremium: boolean
  points: number
  signOut: () => Promise<void>
  refreshSubscription: () => Promise<void>
  refreshPoints: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchSubscription(userId: string) {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSubscription(data ?? null)
  }

  async function fetchPoints(userId: string) {
    const { data } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    setUserPoints(data ?? null)
  }

  async function refreshSubscription() {
    if (user) await fetchSubscription(user.id)
  }

  async function refreshPoints() {
    if (user) await fetchPoints(user.id)
  }

  useEffect(() => {
    // 旧フォーマットのanalyzed_features（ユーザーIDなし）をクリーンアップ
    try {
      if (localStorage.getItem('analyzed_features')) {
        console.log('[AuthContext] Removing old analyzed_features')
        localStorage.removeItem('analyzed_features')
      }
    } catch (e) {
      console.error('[AuthContext] Failed to remove old data:', e)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchSubscription(session.user.id)
        fetchPoints(session.user.id)
      }
      setIsLoading(false)
    })

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, session) => {
      const prevUserId = user?.id

      // 新規登録完了時にフラグを保存
      if (event === 'SIGNED_IN' && session?.user) {
        const url = new URL(window.location.href)
        if (url.hash.includes('type=signup') || url.searchParams.get('type') === 'signup') {
          localStorage.setItem('show_registration_complete', 'true')
        }
      }

      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchSubscription(session.user.id)
        fetchPoints(session.user.id)
      } else {
        setSubscription(null)
        setUserPoints(null)
        // ログアウト時に鑑定済みフラグをクリア
        if (prevUserId) {
          clearAnalyzedFeatures(prevUserId)
        }
      }
    })

    return () => authListener.unsubscribe()
  }, [])

  const isPremium = !!subscription && new Date(subscription.expires_at) > new Date()
  const points = userPoints?.balance ?? 0

  async function signOut() {
    if (user?.id) {
      clearAnalyzedFeatures(user.id)
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, session, subscription, userPoints,
      isLoading, isPremium, points,
      signOut, refreshSubscription, refreshPoints,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
