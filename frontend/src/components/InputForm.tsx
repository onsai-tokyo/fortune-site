import { useState, useMemo } from 'react'
import type { FortuneInput } from '../lib/types'

const MBTI_TYPES = [
  'INTJ','INTP','ENTJ','ENTP',
  'INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ',
  'ISTP','ISFP','ESTP','ESFP',
]

const currentYear = new Date().getFullYear()
const YEARS  = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const HOURS  = Array.from({ length: 24 }, (_, i) => i)

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31
  return new Date(year, month, 0).getDate()
}

interface DateState { year: number | ''; month: number | ''; day: number | '' }
interface TimeState { hour: number | ''; minute: number | '' }

interface Props {
  onSubmit: (data: FortuneInput) => void
  loading: boolean
}

const sc = "bg-deep-navy/50 border border-navy-light rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all font-sans cursor-pointer appearance-none"

// 生年月日・時刻セレクタ（再利用コンポーネント）
function DateTimePicker({
  date, setDate, time, setTime, timeUnknown, setTimeUnknown,
}: {
  date: DateState
  setDate: React.Dispatch<React.SetStateAction<DateState>>
  time: TimeState
  setTime: React.Dispatch<React.SetStateAction<TimeState>>
  timeUnknown: boolean
  setTimeUnknown: (v: boolean) => void
}) {
  const days = useMemo(
    () => Array.from({ length: daysInMonth(date.year || 0, date.month || 0) }, (_, i) => i + 1),
    [date.year, date.month]
  )

  function handleMonthChange(m: number) {
    const maxDay = daysInMonth(date.year || 0, m)
    setDate(d => ({ ...d, month: m, day: d.day !== '' && d.day > maxDay ? '' : d.day }))
  }

  return (
    <div className="space-y-2">
      {/* 生年月日 一列 */}
      <div className="flex items-center gap-1 flex-wrap">
        <select value={date.year}
          onChange={e => setDate(d => ({ ...d, year: e.target.value ? Number(e.target.value) : '' }))}
          className={`${sc} w-[5.5rem]`}>
          <option value="">年</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-white/40 text-xs">年</span>
        <select value={date.month}
          onChange={e => handleMonthChange(e.target.value ? Number(e.target.value) : 0)}
          className={`${sc} w-14`}>
          <option value="">月</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-white/40 text-xs">月</span>
        <select value={date.day}
          onChange={e => setDate(d => ({ ...d, day: e.target.value ? Number(e.target.value) : '' }))}
          className={`${sc} w-14`}>
          <option value="">日</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-white/40 text-xs">日</span>
        {/* 時刻不明チェック */}
        <label className="flex items-center gap-1 cursor-pointer select-none ml-2">
          <input type="checkbox" checked={timeUnknown}
            onChange={e => setTimeUnknown(e.target.checked)} className="w-3 h-3 accent-gold" />
          <span className="text-white/50 text-xs">時刻不明</span>
        </label>
      </div>
      {/* 時刻セレクタ */}
      {!timeUnknown && (
        <div className="flex items-center gap-1">
          <select value={time.hour}
            onChange={e => setTime(t => ({ ...t, hour: e.target.value !== '' ? Number(e.target.value) : '' }))}
            className={`${sc} w-16`}>
            <option value="">時</option>
            {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}</option>)}
          </select>
          <span className="text-white/40 text-xs">時</span>
          <select value={time.minute}
            onChange={e => setTime(t => ({ ...t, minute: e.target.value !== '' ? Number(e.target.value) : '' }))}
            className={`${sc} w-16`}>
            <option value="">分</option>
            {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
              <option key={m} value={m}>{String(m).padStart(2,'0')}</option>
            ))}
          </select>
          <span className="text-white/40 text-xs">分</span>
        </div>
      )}
    </div>
  )
}

export function InputForm({ onSubmit, loading }: Props) {
  const [date, setDate]               = useState<DateState>({ year: '', month: '', day: '' })
  const [time, setTime]               = useState<TimeState>({ hour: '', minute: '' })
  const [timeUnknown, setTimeUnknown] = useState(false)
  const [gender, setGender]           = useState<'male' | 'female'>('female')
  const [mbti, setMbti]               = useState('')
  const [question, setQuestion]       = useState('')
  const [errors, setErrors]           = useState<Record<string, string>>({})

  const [showPartner, setShowPartner]   = useState(false)
  const [pDate, setPDate]               = useState<DateState>({ year: '', month: '', day: '' })
  const [pTime, setPTime]               = useState<TimeState>({ hour: '', minute: '' })
  const [pTimeUnknown, setPTimeUnknown] = useState(false)
  const [pGender, setPGender]           = useState<'male' | 'female'>('female')
  const [pMbti, setPMbti]               = useState('')

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!date.year || !date.month || !date.day) errs.date = '生年月日をすべて選択してください'
    if (showPartner && pDate.year && (!pDate.month || !pDate.day)) errs.pDate = '相手の生年月日の月・日も選択してください'
    if (question.trim().length === 0) errs.question = '相談内容を入力してください'
    if (question.trim().length > 500)  errs.question = '500文字以内で入力してください'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const birthDate = `${String(date.year).padStart(4,'0')}-${String(date.month).padStart(2,'0')}-${String(date.day).padStart(2,'0')}`
    const birthTime = (!timeUnknown && time.hour !== '' && time.minute !== '')
      ? `${String(time.hour).padStart(2,'0')}:${String(time.minute).padStart(2,'0')}` : ''

    const hasPartner = showPartner && pDate.year && pDate.month && pDate.day
    const partnerBirthDate = hasPartner
      ? `${String(pDate.year).padStart(4,'0')}-${String(pDate.month).padStart(2,'0')}-${String(pDate.day).padStart(2,'0')}` : ''
    const partnerBirthTime = (hasPartner && !pTimeUnknown && pTime.hour !== '' && pTime.minute !== '')
      ? `${String(pTime.hour).padStart(2,'0')}:${String(pTime.minute).padStart(2,'0')}` : ''

    onSubmit({
      birthDate, birthTime, gender, mbti, question,
      partnerBirthDate, partnerBirthTime,
      partnerGender: pGender, partnerMbti: pMbti,
    })
  }

  const labelClass = "block text-sm font-medium text-white/70 mb-2"
  const selectClass = "bg-deep-navy/50 border border-navy-light rounded-xl px-3 py-3 text-white focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all font-sans cursor-pointer appearance-none"

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* 生年月日（一列） */}
      <div>
        <label className={labelClass}>生年月日 <span className="text-accent">*</span></label>
        <DateTimePicker date={date} setDate={setDate} time={time} setTime={setTime}
          timeUnknown={timeUnknown} setTimeUnknown={setTimeUnknown} />
        {errors.date && <p className="mt-1 text-red-400 text-xs">{errors.date}</p>}
      </div>

      {/* 性別 */}
      <div>
        <label className={labelClass}>性別 <span className="text-accent">*</span></label>
        <div className="flex gap-4">
          {([['male', '男性'], ['female', '女性']] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer select-none">
              <input type="radio" name="gender" value={val} checked={gender === val}
                onChange={() => setGender(val)} className="w-4 h-4 accent-gold" />
              <span className="text-white/90">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* MBTI */}
      <div>
        <label className={labelClass}>MBTI（任意）</label>
        <select value={mbti} onChange={e => setMbti(e.target.value)} className={`w-full ${selectClass}`}>
          <option value="">不明・選択しない</option>
          {MBTI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* 相手の情報（相性鑑定・任意） */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPartner(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5 transition-colors"
        >
          <span className={showPartner ? 'text-accent' : 'text-white/50'}>
            {showPartner ? '▲ 相手の情報（相性鑑定）' : '＋ 相手の情報を入力する（相性鑑定）'}
          </span>
          <span className="text-white/25 text-xs">任意</span>
        </button>

        {showPartner && (
          <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
            <div>
              <label className={labelClass}>相手の生年月日</label>
              <DateTimePicker date={pDate} setDate={setPDate} time={pTime} setTime={setPTime}
                timeUnknown={pTimeUnknown} setTimeUnknown={setPTimeUnknown} />
              {errors.pDate && <p className="mt-1 text-red-400 text-xs">{errors.pDate}</p>}
            </div>
            <div>
              <label className={labelClass}>相手の性別</label>
              <div className="flex gap-4">
                {([['male', '男性'], ['female', '女性']] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="radio" name="pGender" value={val} checked={pGender === val}
                      onChange={() => setPGender(val)} className="w-4 h-4 accent-gold" />
                    <span className="text-white/90">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>相手のMBTI（任意）</label>
              <select value={pMbti} onChange={e => setPMbti(e.target.value)} className={`w-full ${selectClass}`}>
                <option value="">不明・選択しない</option>
                {MBTI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 質問・相談内容 */}
      <div>
        <label className={labelClass}>
          質問事項 <span className="text-accent">*</span>
        </label>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="例：キャリアの転換期にあり、次のフェーズの戦略を立てたい。財務・人間関係の最適化についても知りたい。"
          rows={4}
          maxLength={500}
          className="w-full bg-deep-navy/50 border border-navy-light rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all font-sans resize-none"
        />
        <div className="flex justify-between mt-1">
          {errors.question ? <p className="text-red-400 text-xs">{errors.question}</p> : <span />}
          <span className="text-white/30 text-xs">{question.length}/500</span>
        </div>
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-5 text-white font-bold text-lg rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.01]"
        style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            解析中...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            解析を開始する
            <span className="text-white/70 text-base">→</span>
          </span>
        )}
      </button>
    </form>
  )
}
