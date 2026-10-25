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
import { BooksPage, SavedReadingsPage, SavedSnapshotPage, LegacySavedReadingPage } from './pages/BooksPage'
import { BookPage } from './pages/BookPage'
import { CreditsPage, PaymentReturnPage } from './pages/CreditsPage'
import { LinkEmailPage, PurchasesPage, SettingsPage } from './pages/SettingsPage'
import { DemoPage } from './pages/DemoPage'
import { remoteMode } from './data/paymentConfig'
import { ReadingStatus } from './components/ReadingStatus'

// Web版専用。既存アプリ向け文書のソースは上書きしない。
import { WebTermsPage as TermsPage, WebPrivacyPage as PrivacyPage, WebCommercePage as TokushohoPage, SalesConditionsPage } from './pages/LegalPages'
const SupportPage = lazy(() => import('./pages/SupportPage').then(m => ({ default: m.SupportPage })))
const LegacyReadingPage = lazy(() => import('./pages/LegacyReadingPage').then(m => ({ default: m.LegacyReadingPage })))
const LegacyLoginPage = lazy(() => import('./pages/LegacyLoginPage').then(m => ({ default: m.LegacyLoginPage })))
const LegacyLegalPage = lazy(() => import('./pages/LegacyLegalPage').then(m => ({ default: m.LegacyLegalPage })))

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
  const { profile, readingsStatus } = useApp()
  const location = useLocation()
  if (!profile && remoteMode && readingsStatus === 'loading') return <ReadingStatus loading />
  if (!profile && remoteMode && readingsStatus === 'error') return <ReadingStatus />
  if (!profile) return <Navigate to={`/welcome?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

const user = (el: ReactNode) => <RequireProfile>{el}</RequireProfile>

/** 読みものへの無料の質問はなくなった（質問は相談のブックごと）。古いURLは本文へ */
function YearAskRedirect() {
  const { year } = useParams()
  return <Navigate to={`/you/years/${year}`} replace />
}

function BookAskRedirect() {
  const { bookId } = useParams()
  return <Navigate to={`/books/${bookId}`} replace />
}

function LegacyReadingRedirect() {
  const { search } = useLocation()
  const id = new URLSearchParams(search).get('conversation')
  // Old checkout parameters never trigger payment or automatic generation.
  return <Navigate to={id ? `/reading/${encodeURIComponent(id)}` : '/books'} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<div role="status" className="fl-root p-8">ページを読み込んでいます…</div>}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/restore" element={<RestorePage />} />
        <Route path="/legacy/login" element={<LegacyLoginPage />} />
        <Route path="/s/:shareId" element={<LegacyReadingPage identifier="share" />} />
        <Route path="/r/:secretToken" element={<LegacyReadingPage identifier="token" />} />
        <Route path="/reading" element={<LegacyReadingRedirect />} />
        <Route path="/reading/new" element={<Navigate to="/welcome" replace />} />
        <Route path="/reading/history" element={<Navigate to="/books" replace />} />
        <Route path="/reading/:conversationId" element={<LegacyReadingPage identifier="id" />} />
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
        <Route path="/books" element={<BooksPage />} />
        <Route path="/books/saved" element={<SavedReadingsPage />} />
        <Route path="/books/saved/:id" element={<SavedSnapshotPage />} />
        <Route path="/books/legacy/:readingKey" element={<LegacySavedReadingPage />} />
        <Route path="/books/:bookId" element={<BookPage />} />
        <Route path="/books/:bookId/ask" element={user(<BookAskRedirect />)} />
        <Route path="/credits" element={user(<CreditsPage />)} />
        <Route path="/credits/return" element={user(<PaymentReturnPage />)} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/purchases" element={user(<PurchasesPage />)} />
        <Route path="/settings/link" element={user(<LinkEmailPage />)} />
        <Route path="/tokushoho" element={<TokushohoPage />} />
        <Route path="/sales-conditions" element={<SalesConditionsPage />} />
        <Route path="/tokushohou" element={<LegacyLegalPage document="tokushohou" />} />
        <Route path="/app-legal/terms" element={<LegacyLegalPage document="terms" />} />
        <Route path="/app-legal/privacy" element={<LegacyLegalPage document="privacy" />} />
        <Route path="/app-legal/tokushohou" element={<LegacyLegalPage document="tokushohou" />} />
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
