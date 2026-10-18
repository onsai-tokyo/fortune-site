import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AppStateProvider, useApp } from './state/AppState'
import { TopPage } from './pages/TopPage'
import { RestorePage } from './pages/RestorePage'
import { OnboardingPage } from './pages/OnboardingPage'
import { CreatingPage } from './pages/CreatingPage'
import { YouPage } from './pages/YouPage'
import { YearReadingPage } from './pages/YearReadingPage'
import { ChapterPage } from './pages/ChapterPage'
import { CouplePage, CoupleIndexPage } from './pages/CouplePage'
import { PartnerNewPage } from './pages/PartnerNewPage'
import { ComposePage } from './pages/ComposePage'
import { BooksPage, SavedReadingsPage } from './pages/BooksPage'
import { BookPage } from './pages/BookPage'
import { AskPage } from './pages/AskPage'
import { CreditsPage, PaymentReturnPage } from './pages/CreditsPage'
import { LinkEmailPage, PurchasesPage, SettingsPage } from './pages/SettingsPage'
import { TokushohoPage } from './pages/TokushohoPage'
import { DemoPage } from './pages/DemoPage'
import { remoteMode } from './data/paymentConfig'

// 既存の公開ページ（文面はそのまま流用。見た目は今後Web版に合わせて調整）
const TermsPage = lazy(() => import('../pages/TermsPage').then(m => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })))
const SupportPage = lazy(() => import('../pages/SupportPage').then(m => ({ default: m.SupportPage })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/**
 * ログイン画面はない。出生情報がまだなければ入力へ案内し、保存した時点で匿名アカウントができる。
 * 別の端末で使っていた人は /restore（メールのコード）から本棚を開く。
 */
function RequireProfile({ children }: { children: ReactNode }) {
  const { profile } = useApp()
  const location = useLocation()
  if (!profile) return <Navigate to={`/welcome?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

const user = (el: ReactNode) => <RequireProfile>{el}</RequireProfile>

/** 読みものへの無料の質問はなくなった（質問は相談のブックごと）。古いURLは本文へ */
function YearAskRedirect() {
  const { year } = useParams()
  return <Navigate to={`/you/years/${year}`} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<div aria-label="ページを読み込んでいます" className="fl-root" />}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/restore" element={<RestorePage />} />
        <Route path="/login" element={<Navigate to="/restore" replace />} />
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route path="/creating" element={user(<CreatingPage />)} />
        <Route path="/you" element={user(<YouPage />)} />
        <Route path="/you/years/:year" element={user(<YearReadingPage />)} />
        <Route path="/you/years/:year/ask" element={<YearAskRedirect />} />
        <Route path="/you/chapters/:id" element={user(<ChapterPage />)} />
        <Route path="/couple" element={user(<CoupleIndexPage />)} />
        <Route path="/couple/new" element={user(<PartnerNewPage />)} />
        <Route path="/couple/:partnerId" element={user(<CouplePage />)} />
        <Route path="/compose" element={user(<ComposePage />)} />
        <Route path="/books" element={user(<BooksPage />)} />
        <Route path="/books/saved" element={user(<SavedReadingsPage />)} />
        <Route path="/books/:bookId" element={user(<BookPage />)} />
        <Route path="/books/:bookId/ask" element={user(<AskPage />)} />
        <Route path="/credits" element={user(<CreditsPage />)} />
        <Route path="/credits/return" element={user(<PaymentReturnPage />)} />
        <Route path="/settings" element={user(<SettingsPage />)} />
        <Route path="/settings/purchases" element={user(<PurchasesPage />)} />
        <Route path="/settings/link" element={user(<LinkEmailPage />)} />
        <Route path="/tokushoho" element={<TokushohoPage />} />
        <Route path="/tokushohou" element={<Navigate to="/tokushoho" replace />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/contact" element={<Navigate to="/support" replace />} />
        <Route path="/demo" element={remoteMode ? <Navigate to="/" replace /> : <DemoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export function WebApp() {
  // 確認用の公開（ファイルを置くだけのホスティング）では # 付きのURLにする
  const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter
  return (
    <AppStateProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppStateProvider>
  )
}
