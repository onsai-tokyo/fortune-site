import { BirthTimeFields } from '../components/BirthTimeFields'
import { trackThreadsEvent } from '../data/threadsMeasurement'
import { MeetingYearSelect } from '../components/MeetingYearSelect'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BirthDateFields } from '../components/BirthDateFields'
import { Button, Chip } from '../components/ui'
import { ApiError } from '../data/api'
import { validBirthDate } from '../data/birthDate'
import { prefectures, relationOptions } from '../data/mock'
import type { Gender, Relation } from '../data/types'
import { useApp } from '../state/AppState'

type BirthDetails = { time: string; place: string }

function BirthFields({ id, title, date, setDate, gender, setGender, details, setDetails }: {
  id: string; title: string; date: string; setDate: (value: string) => void
  gender: Gender | null; setGender: (value: Gender) => void
  details: BirthDetails; setDetails: (value: BirthDetails) => void
}) {
  return <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-3 rounded-card border border-fl-line bg-white p-4">
    <h2 id={`${id}-title`} className="m-0 text-base">{title}</h2>
    <BirthDateFields id={id} value={date} onChange={setDate} />
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
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1 text-sm">性別（必須）</legend>
      <div className="grid grid-cols-2 gap-2">
        <Chip selected={gender === 'female'} onClick={() => setGender('female')}>女性</Chip>
        <Chip selected={gender === 'male'} onClick={() => setGender('male')}>男性</Chip>
      </div>
    </fieldset>
  </section>
}

export function CoupleBirthForm() {
  const { readStandaloneCouple } = useApp()
  const navigate = useNavigate()
  const [selfDate, setSelfDate] = useState('')
  const [partnerDate, setPartnerDate] = useState('')
  const [selfGender, setSelfGender] = useState<Gender | null>(null)
  const [partnerGender, setPartnerGender] = useState<Gender | null>(null)
  const [selfDetails, setSelfDetails] = useState<BirthDetails>({ time: '', place: '' })
  const [partnerDetails, setPartnerDetails] = useState<BirthDetails>({ time: '', place: '' })
  const [meetingYear, setMeetingYear] = useState('')
  const [relation, setRelation] = useState<Relation | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!validBirthDate(selfDate) || !validBirthDate(partnerDate)) {
      setError('あなたとお相手の生年月日を確認してください。存在しない日付は使えません。')
      return
    }
    if (!selfGender || !partnerGender) {
      setError('あなたとお相手の性別を選択してください。')
      return
    }
    if (!relation) {
      setError('ふたりの関係を選択してください。')
      return
    }
    const year = Number(meetingYear)
    const earliest = Math.max(Number(selfDate.slice(0, 4)), Number(partnerDate.slice(0, 4)))
    if (!/^\d{4}$/.test(meetingYear) || year < earliest || year > new Date().getFullYear()) {
      setError('出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください。')
      return
    }
    setBusy(true)
    setError('')
    try {
      const partner = await readStandaloneCouple(
        { nickname: '', birthDate: selfDate, birthTime: selfDetails.time || null, birthPlace: selfDetails.place, gender: selfGender },
        { name: 'お相手', birthDate: partnerDate, birthTime: partnerDetails.time || null, birthPlace: partnerDetails.place, gender: partnerGender, relation, metYear: year },
      )
      trackThreadsEvent('couple_reading_complete')
      navigate(`/couple/${partner.id}`)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 429) {
        setError('短時間に鑑定が続いています。入力内容はそのままで、少し待ってからもう一度お試しください。')
      } else {
        setError('ふたりの年表を作成できませんでした。入力内容はそのままで、時間をおいてもう一度お試しください。')
      }
    } finally { setBusy(false) }
  }

  return <form onSubmit={submit} aria-busy={busy} className="fl-couple-birth-form px-6 pt-4">
    <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="mb-3 text-lg font-medium">ふたりの出生情報を入力する</legend>
      <BirthFields id="couple-self" title="あなた" date={selfDate} setDate={setSelfDate} gender={selfGender} setGender={setSelfGender} details={selfDetails} setDetails={setSelfDetails} />
      <BirthFields id="couple-partner" title="お相手" date={partnerDate} setDate={setPartnerDate} gender={partnerGender} setGender={setPartnerGender} details={partnerDetails} setDetails={setPartnerDetails} />
      <label className="flex flex-col gap-1.5 text-sm">
        ふたりの関係（必須）
        <select required className="rounded-field border px-3 text-base" value={relation} onChange={e => setRelation(e.target.value as Relation | '')}>
          <option value="">選択してください</option>
          {relationOptions.map(option => <option key={option}>{option}</option>)}
        </select>
      </label>
      <MeetingYearSelect id="couple-meeting-year" value={meetingYear} onChange={setMeetingYear} />
      <p className="m-0 text-xs leading-relaxed text-fl-muted">
        <Link to="/terms" className="underline">利用規約</Link>と<Link to="/privacy" className="underline">プライバシーポリシー</Link>に同意のうえお進みください。15歳以上の方が利用できます。18歳未満の方は、保護者などの法定代理人の同意が必要です。
      </p>
      {error && <p role="alert" className="m-0 text-sm text-fl-danger">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? '年表を作成しています…' : 'ふたりの年表を読む'}</Button>
    </fieldset>
  </form>
}
