import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface CompatReportData {
  result: {
    overall: number
    work: { score: number; summary: string; strengths: string[]; challenges: string[]; advice: string }
    romantic: { score: number; summary: string; strengths: string[]; challenges: string[]; advice: string }
    dynamic: string
  }
  self: { birthDate: string; gender: string; shichuDay: string }
  partner: { birthDate: string; gender: string; shichuDay: string }
  generatedAt: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-gray-800 font-bold font-mono w-8 text-right text-sm">{score}</span>
    </div>
  )
}

export default function CompatReportPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<CompatReportData | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('compat_report_data')
    if (stored) {
      try { setData(JSON.parse(stored) as CompatReportData) } catch { /* ignore */ }
    }
  }, [])

  if (!data) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/50 text-sm">レポートデータが見つかりません</p>
          <button onClick={() => navigate('/feature/compat')} className="text-accent text-sm hover:underline">
            相性診断へ →
          </button>
        </div>
      </div>
    )
  }

  const { result, self, partner, generatedAt } = data

  return (
    <>
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .report-page { box-shadow: none !important; }
        }
        @page {
          size: A4;
          margin: 15mm 12mm;
        }
      `}</style>

      {/* 画面表示用ナビ */}
      <div className="no-print fixed top-0 left-0 right-0 z-20 border-b border-white/5 backdrop-blur-sm" style={{ background: 'rgba(8,15,40,0.96)' }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/feature/compat')} className="text-white/30 hover:text-white/60 text-sm transition-colors">
            ← 相性診断に戻る
          </button>
          <span className="text-white/60 text-sm font-medium">相性診断レポート</span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm font-semibold rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDFで保存
          </button>
        </div>
      </div>

      {/* レポート本体 */}
      <div className="no-print pt-14 min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0f172a 100%)' }}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <ReportBody result={result} self={self} partner={partner} generatedAt={generatedAt} />
        </div>
      </div>

      {/* 印刷時のみ表示されるレポート（print:block） */}
      <div className="hidden print:block">
        <ReportBody result={result} self={self} partner={partner} generatedAt={generatedAt} />
      </div>
    </>
  )
}

function ReportBody({ result, self, partner, generatedAt }: Omit<CompatReportData, 'result'> & { result: CompatReportData['result'] }) {
  const scoreColor = (s: number) => s >= 80 ? '#16a34a' : s >= 65 ? '#2563eb' : '#d97706'

  return (
    <div className="report-page bg-white rounded-2xl overflow-hidden shadow-2xl" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

      {/* ── ヘッダー ── */}
      <div className="px-10 pt-10 pb-8 text-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <p className="text-blue-300/60 text-xs tracking-widest uppercase mb-3">Compatibility Analysis Report</p>
        <h1 className="text-white font-bold text-2xl mb-2">相性診断レポート</h1>
        <p className="text-white/40 text-xs">鑑定日　{formatDate(generatedAt)}</p>

        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="text-center">
            <p className="text-white/30 text-xs mb-1">あなた</p>
            <p className="text-white font-bold">{formatDate(self.birthDate)}</p>
            <p className="text-white/50 text-xs">{self.gender === 'male' ? '男性' : '女性'} · 日柱 {self.shichuDay}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-px bg-white/20" />
            <span className="text-white/20 text-xs">×</span>
            <div className="w-10 h-px bg-white/20" />
          </div>
          <div className="text-center">
            <p className="text-white/30 text-xs mb-1">お相手</p>
            <p className="text-white font-bold">{formatDate(partner.birthDate)}</p>
            <p className="text-white/50 text-xs">{partner.gender === 'male' ? '男性' : '女性'} · 日柱 {partner.shichuDay}</p>
          </div>
        </div>
      </div>

      {/* ── 総合スコア ── */}
      <div className="px-10 py-8 border-b border-gray-100">
        <p className="text-gray-400 text-xs tracking-widest uppercase mb-5">Overall Score</p>

        <div className="flex items-center gap-8 mb-6">
          {/* 大スコア */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="#f1f5f9" strokeWidth="7" />
              <circle
                cx="48" cy="48" r="40" fill="none"
                stroke={scoreColor(result.overall)} strokeWidth="7"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - result.overall / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-mono text-gray-800">{result.overall}</span>
              <span className="text-gray-400 text-xs">総合</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500 text-xs">仕事の相性</span>
                <span className="text-gray-700 text-xs font-medium">{result.work.score}</span>
              </div>
              <ScoreBar score={result.work.score} color={scoreColor(result.work.score)} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500 text-xs">恋愛の相性</span>
                <span className="text-gray-700 text-xs font-medium">{result.romantic.score}</span>
              </div>
              <ScoreBar score={result.romantic.score} color={scoreColor(result.romantic.score)} />
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-center">
          <p className="text-gray-400 text-xs mb-1">関係性タイプ</p>
          <p className="text-gray-800 font-semibold text-sm leading-relaxed">{result.dynamic}</p>
        </div>
      </div>

      {/* ── 仕事の相性 ── */}
      <Section
        title="仕事の相性"
        subtitle="Work Compatibility"
        score={result.work.score}
        scoreColor={scoreColor(result.work.score)}
        accentColor="#2563eb"
        summary={result.work.summary}
        strengths={result.work.strengths}
        challenges={result.work.challenges}
        advice={result.work.advice}
      />

      {/* ── 恋愛の相性 ── */}
      <Section
        title="恋愛・プライベートの相性"
        subtitle="Romantic Compatibility"
        score={result.romantic.score}
        scoreColor={scoreColor(result.romantic.score)}
        accentColor="#db2777"
        summary={result.romantic.summary}
        strengths={result.romantic.strengths}
        challenges={result.romantic.challenges}
        advice={result.romantic.advice}
        last
      />

      {/* ── フッター ── */}
      <div className="px-10 py-6 text-center" style={{ background: '#f8fafc' }}>
        <p className="text-gray-300 text-xs">宿命解析 · 四柱推命・算命学・宿曜・納音・数秘術・九星気学 統合鑑定</p>
        <p className="text-gray-200 text-xs mt-1">fortune-site-iota.vercel.app</p>
      </div>
    </div>
  )
}

function Section({
  title, subtitle, score, scoreColor, accentColor,
  summary, strengths, challenges, advice, last = false,
}: {
  title: string; subtitle: string; score: number; scoreColor: string; accentColor: string
  summary: string; strengths: string[]; challenges: string[]; advice: string; last?: boolean
}) {
  return (
    <div className={`px-10 py-8 ${last ? '' : 'border-b border-gray-100'}`}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-gray-400 text-xs tracking-widest uppercase mb-0.5">{subtitle}</p>
          <h2 className="text-gray-800 font-bold text-base">{title}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-10 h-1 rounded-full" style={{ background: scoreColor }} />
          <span className="text-2xl font-bold font-mono" style={{ color: scoreColor }}>{score}</span>
        </div>
      </div>

      <p className="text-gray-600 text-sm leading-relaxed mb-5">{summary}</p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#16a34a' }}>強み</p>
          <ul className="space-y-1.5">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: '#16a34a' }}>+</span>
                <span className="text-gray-600 text-xs">{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-600 mb-2">注意点</p>
          <ul className="space-y-1.5">
            {challenges.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500 text-xs mt-0.5 flex-shrink-0">△</span>
                <span className="text-gray-600 text-xs">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 border" style={{ background: `${accentColor}08`, borderColor: `${accentColor}25` }}>
        <p className="text-xs font-semibold mb-1" style={{ color: accentColor }}>アドバイス</p>
        <p className="text-gray-700 text-xs leading-relaxed">{advice}</p>
      </div>
    </div>
  )
}
