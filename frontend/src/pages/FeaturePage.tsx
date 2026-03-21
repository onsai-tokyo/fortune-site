import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { saveAnalysis } from '../lib/history'
import { SelfAnalysisTab } from '../components/tabs/SelfAnalysisTab'
import { CompatibilityTab } from '../components/tabs/CompatibilityTab'
import { OrganizationTab } from '../components/tabs/OrganizationTab'
import { MarriageTab } from '../components/tabs/MarriageTab'
import { RecruitTab } from '../components/tabs/RecruitTab'
import { ChatArea } from '../components/ChatArea'
import type { FortuneData } from '../lib/types'
import { calcShichu } from '../lib/shichu'
import { calcNayin } from '../lib/nayin'
import { calcSanmei } from '../lib/sanmei'
import { getSukuyo } from '../lib/sukuyo'

type FeatureId = 'self' | 'compat' | 'marriage' | 'org' | 'chat' | 'recruit'

const FEATURE_META: Record<FeatureId, {
  label: string; sub: string; dot: string; border: string; description: string; showMbti?: boolean
}> = {
  self: {
    label: '自己分析', sub: 'Self Analysis',
    dot: 'bg-blue-400', border: 'border-blue-500/30',
    description: '生年月日を入力すると、強み・弱み・適職・人生転換期を命式から解析します。MBTIと組み合わせることでより精度が上がります。',
    showMbti: true,
  },
  compat: {
    label: '相性診断', sub: 'Compatibility',
    dot: 'bg-pink-400', border: 'border-pink-500/30',
    description: 'あなたの生年月日を入力後、次の画面で相手の情報を入力して仕事・恋愛の相性を診断します。',
  },
  marriage: {
    label: '結婚相性', sub: 'Marriage',
    dot: 'bg-rose-400', border: 'border-rose-500/30',
    description: 'あなたの生年月日を入力後、パートナーの情報を入力して結婚生活・力関係・うまくいくコツを解析します。',
  },
  org: {
    label: '組織診断', sub: 'Organization',
    dot: 'bg-emerald-400', border: 'border-emerald-500/30',
    description: 'あなたの生年月日を入力後、メンバーを追加してチームのキーマン・戦い方・人間関係マトリクスを解析します。',
  },
  chat: {
    label: '命術師に相談', sub: 'Fortune Consultation',
    dot: 'bg-accent', border: 'border-accent/30',
    description: '生年月日を入力すると、30年以上の経験を持つ命術師（AIデータ駆動）があなたの命式をもとに相談に答えます。',
    showMbti: true,
  },
  recruit: {
    label: '採用・他己分析', sub: 'Recruitment Analysis',
    dot: 'bg-violet-400', border: 'border-violet-500/30',
    description: 'あなた（面接官）の生年月日を入力後、候補者の情報を入力して強み・適性・あなたとの相性を命式から解析します。',
    showMbti: true,
  },
}

const currentYear = new Date().getFullYear()
const YEARS  = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const HOURS  = Array.from({ length: 24 }, (_, i) => i)
const MINS   = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
function daysInMonth(y: number, m: number) { return (!y || !m) ? 31 : new Date(y, m, 0).getDate() }

const sc = "bg-white/5 border border-white/15 rounded-lg px-2 py-2.5 text-white text-sm focus:outline-none focus:border-accent/60 transition-all font-sans cursor-pointer appearance-none"

const MBTI_TYPES = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']

function BirthForm({ meta, onSubmit }: { meta: typeof FEATURE_META[FeatureId]; onSubmit: (fd: FortuneData) => void }) {
  const [year,        setYear]        = useState<number | ''>('')
  const [month,       setMonth]       = useState<number | ''>('')
  const [day,         setDay]         = useState<number | ''>('')
  const [hour,        setHour]        = useState<number | ''>('')
  const [minute,      setMinute]      = useState<number | ''>('')
  const [timeUnknown, setTimeUnknown] = useState(true)
  const [gender,      setGender]      = useState<'male' | 'female'>('female')
  const [mbti,        setMbti]        = useState('')
  const days = Array.from({ length: daysInMonth(Number(year), Number(month)) }, (_, i) => i + 1)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !month || !day) return
    const y = Number(year), m = Number(month), d = Number(day)
    const h = (!timeUnknown && hour !== '') ? Number(hour) : undefined
    const shichu = calcShichu(y, m, d, h)
    const nayin  = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(y, m, d)
    const birthDate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const birthTime = (!timeUnknown && hour !== '' && minute !== '')
      ? `${String(Number(hour)).padStart(2,'0')}:${String(Number(minute)).padStart(2,'0')}` : ''
    onSubmit({
      input: { birthDate, birthTime, gender, mbti, question: '', partnerBirthDate: '', partnerBirthTime: '', partnerGender: 'female', partnerMbti: '' },
      shichu, nayin, sanmei, sukuyo,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">

      {/* 生年月日 */}
      <div>
        <p className="text-white/50 text-xs mb-3">生年月日 <span className="text-red-400">*</span></p>
        <div className="flex gap-1.5 items-center flex-wrap">
          <select value={year}  onChange={e => setYear(e.target.value ? Number(e.target.value) : '')}  className={`${sc} w-[5.5rem]`}>
            <option value="">年</option>{YEARS.map(y  => <option key={y}  value={y}>{y}</option>)}
          </select>
          <span className="text-white/30 text-xs">年</span>
          <select value={month} onChange={e => setMonth(e.target.value ? Number(e.target.value) : '')} className={`${sc} w-14`}>
            <option value="">月</option>{MONTHS.map(m => <option key={m}  value={m}>{m}</option>)}
          </select>
          <span className="text-white/30 text-xs">月</span>
          <select value={day}   onChange={e => setDay(e.target.value ? Number(e.target.value) : '')}   className={`${sc} w-14`}>
            <option value="">日</option>{days.map(d   => <option key={d}  value={d}>{d}</option>)}
          </select>
          <span className="text-white/30 text-xs">日</span>
        </div>
      </div>

      {/* 生まれた時間（任意） */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-white/50 text-xs">生まれた時間</p>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={timeUnknown} onChange={e => setTimeUnknown(e.target.checked)}
              className="w-3 h-3 accent-blue-400 rounded" />
            <span className="text-white/30 text-xs">時間不明</span>
          </label>
        </div>
        {!timeUnknown && (
          <div className="flex gap-1.5 items-center">
            <select value={hour}   onChange={e => setHour(e.target.value !== '' ? Number(e.target.value) : '')}   className={`${sc} w-16`}>
              <option value="">時</option>{HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}</option>)}
            </select>
            <span className="text-white/30 text-xs">時</span>
            <select value={minute} onChange={e => setMinute(e.target.value !== '' ? Number(e.target.value) : '')} className={`${sc} w-16`}>
              <option value="">分</option>{MINS.map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
            </select>
            <span className="text-white/30 text-xs">分</span>
          </div>
        )}
        {!timeUnknown && (
          <p className="text-white/20 text-xs mt-1.5">時柱まで含めた精密解析が可能になります</p>
        )}
      </div>

      {/* 性別 */}
      <div>
        <p className="text-white/50 text-xs mb-3">性別 <span className="text-red-400">*</span></p>
        <div className="flex gap-2">
          {(['female', 'male'] as const).map(g => (
            <button key={g} type="button" onClick={() => setGender(g)}
              className={`px-5 py-2 rounded-lg text-sm border transition-all ${gender === g ? 'border-accent bg-accent/10 text-accent' : 'border-white/15 text-white/40 hover:border-white/30'}`}>
              {g === 'female' ? '女性' : '男性'}
            </button>
          ))}
        </div>
      </div>

      {/* MBTI */}
      {meta.showMbti && (
        <div>
          <p className="text-white/50 text-xs mb-3">MBTI <span className="text-white/20">（任意）</span></p>
          <select value={mbti} onChange={e => setMbti(e.target.value)} className={`${sc} w-48`}>
            <option value="">不明・選択しない</option>
            {MBTI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      <button type="submit"
        className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg text-sm transition-all shadow-lg shadow-accent/20">
        解析を開始する →
      </button>
    </form>
  )
}

export function FeaturePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [fortuneData, setFortuneData] = useState<FortuneData | null>(null)

  const featureId = (id as FeatureId) ?? 'self'
  const meta = FEATURE_META[featureId] ?? FEATURE_META.self

  function handleFortuneSubmit(fd: FortuneData) {
    setFortuneData(fd)
    // 鑑定済みフラグをlocalStorageに保存
    const analyzed = JSON.parse(localStorage.getItem('analyzed_features') ?? '[]') as string[]
    if (!analyzed.includes(featureId)) {
      localStorage.setItem('analyzed_features', JSON.stringify([...analyzed, featureId]))
    }
    // ログイン中ならSupabaseに履歴保存
    if (user) {
      const title = `${meta.label} — ${fd.input.birthDate}`
      saveAnalysis(user.id, featureId, fd.input.birthDate, title).catch(() => {})
    }
  }

  return (
    <div className="min-h-screen">
      {/* ナビ */}
      <nav className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-10" style={{ background: 'rgba(8,15,40,0.8)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/60 transition-colors text-sm">
            ← トップ
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            <span className="text-white/60 text-sm font-medium">{meta.label}</span>
            <span className="text-white/20 text-xs font-garamond italic hidden sm:block">{meta.sub}</span>
          </div>
          {fortuneData && (
            <button onClick={() => setFortuneData(null)} className="ml-auto text-white/20 hover:text-white/50 text-xs transition-colors">
              ← 再入力
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {!fortuneData ? (
          <>
            <div className={`glass-card border ${meta.border} p-6`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-1 h-6 rounded-full ${meta.dot}`} />
                <div>
                  <p className="text-white/25 text-xs font-garamond italic tracking-widest">{meta.sub}</p>
                  <h1 className="text-white font-bold text-xl">{meta.label}</h1>
                </div>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">{meta.description}</p>
            </div>
            <BirthForm meta={meta} onSubmit={handleFortuneSubmit} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className={`w-1 h-5 rounded-full ${meta.dot}`} />
              <h2 className="text-white font-semibold">{meta.label}</h2>
              <span className="text-white/20 text-xs ml-1">{fortuneData.input.birthDate}</span>
            </div>

            {featureId === 'self'    && <SelfAnalysisTab  fortuneData={fortuneData} />}
            {featureId === 'compat'  && <CompatibilityTab fortuneData={fortuneData} />}
            {featureId === 'marriage'&& <MarriageTab      fortuneData={fortuneData} />}
            {featureId === 'org'     && <OrganizationTab  fortuneData={fortuneData} />}
            {featureId === 'recruit' && <RecruitTab       fortuneData={fortuneData} />}
            {featureId === 'chat'    && <ChatArea fortuneData={fortuneData} initialReading="" sessionData={{}} />}
          </>
        )}

      </div>
    </div>
  )
}
