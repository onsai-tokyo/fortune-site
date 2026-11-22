import { BirthTimeFields } from '../components/BirthTimeFields'
import { trackThreadsEvent } from '../data/threadsMeasurement'
import { MeetingYearSelect } from '../components/MeetingYearSelect'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BirthDateFields } from '../components/BirthDateFields'
import { Button, Chip } from '../components/ui'
import { ApiError } from '../data/api'
import { validBirthDate } from '../data/birthDate'
import { prefectures, relationOptions } from '../data/mock'
import type { Gender, Relation } from '../data/types'
import { useApp } from '../state/AppState'
import { readingFocusPages, type CoupleFocus } from '../data/readingFocus.js'
import type { Partner } from '../data/types'

type BirthDetails = { time: string; place: string }
type FormError = { message: string; target?: string }

function InputError({ error, target }: { error: FormError | null; target: string }) {
  return error?.target === target ? <p id="couple-form-error" role="alert" className="m-0 text-sm text-fl-danger">{error.message}</p> : null
}

function BirthFields({ id, title, date, setDate, gender, setGender, details, setDetails, error }: {
  id: string; title: string; date: string; setDate: (value: string) => void
  gender: Gender | null; setGender: (value: Gender) => void
  details: BirthDetails; setDetails: (value: BirthDetails) => void
  error: FormError | null
}) {
  return <section aria-labelledby={`${id}-title`} aria-describedby={error?.target === id ? 'couple-form-error' : undefined} className="flex min-w-0 flex-col gap-3 rounded-card border border-fl-line bg-white p-4">
    <h2 id={`${id}-title`} className="m-0 text-base">{title}</h2>
    <BirthDateFields id={id} value={date} onChange={setDate} />
    <InputError error={error} target={id} />
    <BirthTimeFields id={`${id}-time`} value={details.time}
      onChange={time => setDetails({ ...details, time })} />
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-fl-body">
      出生地（任意）
      <select className="rounded-field border border-fl-line bg-white px-3 text-base"
        value={details.place} onChange={e => setDetails({ ...details, place: e.target.value })}>
        <option value="">未選択・分からない</option>
        {prefectures.map(place => <option key={place}>{place}</option>)}
      </select>
    </label>
    <fieldset id={`${id}-gender`} aria-invalid={error?.target === `${id}-gender` || undefined} aria-describedby={error?.target === `${id}-gender` ? 'couple-form-error' : undefined} className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1 text-sm">性別（必須）</legend>
      <div className="grid grid-cols-2 gap-2">
        <Chip selected={gender === 'female'} onClick={() => setGender('female')}>女性</Chip>
        <Chip selected={gender === 'male'} onClick={() => setGender('male')}>男性</Chip>
      </div>
    </fieldset>
    <InputError error={error} target={`${id}-gender`} />
  </section>
}

export function CoupleBirthForm({ focus, onComplete }: { focus?: CoupleFocus; onComplete?: (partner: Partner, breakupYear?: number) => void } = {}) {
  const { readStandaloneCouple } = useApp()
  const navigate = useNavigate()
  const [selfDate, setSelfDate] = useState('')
  const [partnerDate, setPartnerDate] = useState('')
  const [selfGender, setSelfGender] = useState<Gender | null>(null)
  const [partnerGender, setPartnerGender] = useState<Gender | null>(null)
  const [selfDetails, setSelfDetails] = useState<BirthDetails>({ time: '', place: '' })
  const [partnerDetails, setPartnerDetails] = useState<BirthDetails>({ time: '', place: '' })
  const [meetingYear, setMeetingYear] = useState('')
  const [relation, setRelation] = useState<Relation | ''>(focus ? readingFocusPages[focus].relation as Relation | '' : '')
  const [breakupYear, setBreakupYear] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<FormError | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!error || busy) return
    const target = error.target ? document.getElementById(error.target) : null
    const control = target?.matches('input,select,button') ? target : target?.querySelector<HTMLElement>('select,button,input')
    const focusTarget = control ?? errorRef.current
    focusTarget?.focus()
  }, [error, busy])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!validBirthDate(selfDate)) {
      setError({ message: 'あなたの生年月日を確認してください。存在しない日付は使えません。', target: 'couple-self' })
      return
    }
    if (!validBirthDate(partnerDate)) {
      setError({ message: 'お相手の生年月日を確認してください。存在しない日付は使えません。', target: 'couple-partner' })
      return
    }
    if (!selfGender) {
      setError({ message: 'あなたの性別を選択してください。', target: 'couple-self-gender' })
      return
    }
    if (!partnerGender) {
      setError({ message: 'お相手の性別を選択してください。', target: 'couple-partner-gender' })
      return
    }
    if (!relation) {
      setError({ message: 'ふたりの関係を選択してください。', target: 'couple-relation' })
      return
    }
    const year = Number(meetingYear)
    const earliest = Math.max(Number(selfDate.slice(0, 4)), Number(partnerDate.slice(0, 4)))
    if (!/^\d{4}$/.test(meetingYear) || year < earliest || year > new Date().getFullYear()) {
      setError({ message: '出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください。', target: 'couple-meeting-year' })
      return
    }
    if (focus === 'fukuen' && (!/^\d{4}$/.test(breakupYear) || Number(breakupYear) < year || Number(breakupYear) > new Date().getFullYear())) {
      setError({ message: '別れた年は、出会った年以降から今年までを選択してください。', target: 'couple-breakup-year' })
      return
    }
    setBusy(true)
    setError(null)
    const controller = new AbortController()
    request.current = controller
    try {
      const partner = await readStandaloneCouple(
        { nickname: '', birthDate: selfDate, birthTime: selfDetails.time || null, birthPlace: selfDetails.place, gender: selfGender },
        { name: 'お相手', birthDate: partnerDate, birthTime: partnerDetails.time || null, birthPlace: partnerDetails.place, gender: partnerGender, relation, metYear: year },
        undefined, controller.signal,
      )
      if (controller.signal.aborted) return
      trackThreadsEvent('couple_reading_complete')
      if (onComplete) onComplete(partner, focus === 'fukuen' ? Number(breakupYear) : undefined)
      else navigate(`/couple/${partner.id}`)
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 429) {
        setError({ message: '短時間に鑑定が続いています。入力内容はそのままで、少し待ってからもう一度お試しください。' })
      } else {
        setError({ message: 'ふたりの年表を作成できませんでした。入力内容はそのままで、時間をおいてもう一度お試しください。' })
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setBusy(false)
      }
    }
  }

  return <form onSubmit={submit} onChange={() => setError(null)} aria-busy={busy} className="fl-couple-birth-form px-6 pt-4">
    <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="mb-3 text-lg font-medium">ふたりの出生情報を入力する</legend>
      <BirthFields id="couple-self" title="あなた" date={selfDate} setDate={setSelfDate} gender={selfGender} setGender={value => { setSelfGender(value); setError(null) }} details={selfDetails} setDetails={setSelfDetails} error={error} />
      <BirthFields id="couple-partner" title="お相手" date={partnerDate} setDate={setPartnerDate} gender={partnerGender} setGender={value => { setPartnerGender(value); setError(null) }} details={partnerDetails} setDetails={setPartnerDetails} error={error} />
      <label className="flex flex-col gap-1.5 text-sm">
        ふたりの関係（必須）
        <select id="couple-relation" required aria-invalid={error?.target === 'couple-relation' || undefined} aria-describedby={error?.target === 'couple-relation' ? 'couple-form-error' : undefined} className="rounded-field border px-3 text-base" value={relation} onChange={e => setRelation(e.target.value as Relation | '')}>
          <option value="">選択してください</option>
          {relationOptions.filter(option => focus === 'fukuen' ? ['復縁希望', '元恋人'].includes(option) : focus === 'kataomoi' ? option === '片思い' : true).map(option => <option key={option}>{option}</option>)}
        </select>
      </label>
      <InputError error={error} target="couple-relation" />
      <MeetingYearSelect id="couple-meeting-year" value={meetingYear} onChange={setMeetingYear} />
      <InputError error={error} target="couple-meeting-year" />
      {focus === 'fukuen' && <><MeetingYearSelect id="couple-breakup-year" label="別れた年（必須）" value={breakupYear} onChange={setBreakupYear} /><InputError error={error} target="couple-breakup-year" /></>}
      {focus && <p className="m-0 text-xs leading-relaxed text-fl-muted">出会った年は年表の計算に使います。{focus === 'fukuen' && '別れた年は、先に読む年を選ぶために使い、出会いの年には置き換えません。'}相手の情報は計算と結果の表示にだけ利用し、この画面では保存しません。生年月日・性別・入力した年を、URLやアクセス解析へ送ることはありません。</p>}
      <p className="m-0 text-xs leading-relaxed text-fl-muted">
        <Link to="/terms" className="underline">利用規約</Link>と<Link to="/privacy" className="underline">プライバシーポリシー</Link>に同意のうえお進みください。15歳以上の方が利用できます。18歳未満の方は、保護者などの法定代理人の同意が必要です。
      </p>
      {error && !error.target && <p id="couple-form-error" ref={errorRef} tabIndex={-1} role="alert" className="m-0 text-sm text-fl-danger">{error.message}</p>}
      <Button type="submit" disabled={busy}>{busy ? '年表を作成しています…' : focus ? readingFocusPages[focus].button : 'ふたりの年表を読む'}</Button>
    </fieldset>
  </form>
}
