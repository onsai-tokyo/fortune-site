import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, Subscription, UserPoints } from '../lib/supabase'
import { clearAnalyzedFeatures } from '../lib/analyzedFeatures'
import { AccountBoundary, restoreSession } from '../lib/accountBoundary'

interface AuthContextValue {
  user: User | null
  session: Session | null
  subscription: Subscription | null
  userPoints: UserPoints | null
  isLoading: boolean
  authError: string | null
  retrySession: () => Promise<void>
  isPremium: boolean
  points: number
  signOut: () => Promise<void>
  refreshSubscription: () => Promise<void>
  refreshPoints: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const userRef = useRef<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const boundary = useRef(new AccountBoundary())
  const sessionEvent = useRef(0)


  async function fetchSubscription(userId: string) {
    const revision = boundary.current.capture()
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!boundary.current.current(revision) || userRef.current?.id !== userId) return
    if (error) return
    setSubscription(data ?? null)
  }

  async function fetchPoints(userId: string) {
    const revision = boundary.current.capture()
    const { data, error } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (!boundary.current.current(revision) || userRef.current?.id !== userId) return
    if (error) return
    setUserPoints(data ?? null)
  }

  async function refreshSubscription() {
    if (user) await fetchSubscription(user.id)
  }

  async function refreshPoints() {
    if (user) await fetchPoints(user.id)
  }

  function applySession(next: Session | null) {
    const previous = userRef.current?.id
    boundary.current.select(next?.user.id ?? null)
    userRef.current = next?.user ?? null
    setSession(next)
    setUser(next?.user ?? null)
    setAuthError(null)
    setIsLoading(false)
    if (previous !== next?.user.id) { setSubscription(null); setUserPoints(null) }
    if (next?.user) {
      // Do not await Supabase operations inside the synchronous auth callback.
      void fetchSubscription(next.user.id).catch(() => {})
      void fetchPoints(next.user.id).catch(() => {})
    }
  }

  async function retrySession() {
    setIsLoading(true)
    setAuthError(null)
    const event = sessionEvent.current
    await restoreSession(boundary.current, async () => {
      const result = await supabase.auth.getSession()
      if (result.error) throw result.error
      return result.data.session
    }, next => { if (event === sessionEvent.current) applySession(next) },
    () => { if (event === sessionEvent.current) setAuthError('ログイン状態を確認できませんでした。接続を確認して再試行してください。') },
    () => { if (event === sessionEvent.current) setIsLoading(false) })
  }

  useEffect(() => {
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, next) => {
      sessionEvent.current++
      if (event === 'SIGNED_OUT') boundary.current.invalidate()
      applySession(next)
      if (event === 'SIGNED_IN' && next?.user) {
        const url = new URL(window.location.href)
        if (url.hash.includes('type=signup') || url.searchParams.get('type') === 'signup') {
          try { localStorage.setItem('show_registration_complete', 'true') } catch { /* storage is optional */ }
        }
      }
    })
    void retrySession()
    return () => { boundary.current.invalidate(); authListener.unsubscribe() }
  }, [])

  const isPremium = !!subscription && new Date(subscription.expires_at) > new Date()
  const points = userPoints?.balance ?? 0

  async function signOut() {
    if (user?.id) {
      clearAnalyzedFeatures(user.id)
    }
    boundary.current.invalidate()
    const { error } = await supabase.auth.signOut()
    if (error) { setAuthError('ログアウトできませんでした。再試行してください。'); throw error }
  }

  return (
    <AuthContext.Provider value={{
      user, session, subscription, userPoints,
      isLoading, authError, retrySession, isPremium, points,
      signOut, refreshSubscription, refreshPoints,
    }}>
      {authError && <div role="alert">{authError}<button type="button" onClick={() => void retrySession()}>再試行</button></div>}
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
