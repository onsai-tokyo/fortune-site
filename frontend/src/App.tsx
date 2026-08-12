import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'

const ResultPage = lazy(() => import('./pages/ResultPage').then(module => ({ default: module.ResultPage })))
const FeaturePage = lazy(() => import('./pages/FeaturePage').then(module => ({ default: module.FeaturePage })))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const MyPage = lazy(() => import('./pages/MyPage'))
const HistoryDetailPage = lazy(() => import('./pages/HistoryDetailPage'))
const AnalyzePage = lazy(() => import('./pages/AnalyzePage'))
const CompatReportPage = lazy(() => import('./pages/CompatReportPage'))
const TokushohouPage = lazy(() => import('./pages/TokushohouPage').then(module => ({ default: module.TokushohouPage })))
const TermsPage = lazy(() => import('./pages/TermsPage').then(module => ({ default: module.TermsPage })))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(module => ({ default: module.PrivacyPage })))
const ReadingPage = lazy(() => import('./pages/ReadingPage'))

function PageLoader() {
  return <div className="min-h-screen bg-[#faf7ef]" aria-label="ページを読み込んでいます" />
}

function OfficialTopRedirect() {
  useEffect(() => { window.location.replace('/lp.html') }, [])
  return <PageLoader />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<OfficialTopRedirect />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/feature/:id" element={<FeaturePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/history/:id" element={<HistoryDetailPage />} />
            <Route path="/analyze" element={<AnalyzePage />} />
            <Route path="/compat-report" element={<CompatReportPage />} />
            <Route path="/tokushohou" element={<TokushohouPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/reading" element={<ReadingPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
