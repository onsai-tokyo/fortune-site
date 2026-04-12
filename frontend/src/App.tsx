import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TopPage } from './pages/TopPage'
import { ResultPage } from './pages/ResultPage'
import { FeaturePage } from './pages/FeaturePage'
import AuthPage from './pages/AuthPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import ChatPage from './pages/ChatPage'
import MyPage from './pages/MyPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import AnalyzePage from './pages/AnalyzePage'
import CompatReportPage from './pages/CompatReportPage'
import { TokushohouPage } from './pages/TokushohouPage'
import { AuthProvider } from './contexts/AuthContext'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<TopPage />} />
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
