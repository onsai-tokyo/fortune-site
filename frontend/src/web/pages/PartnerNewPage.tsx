import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackHeader, Button, Chip, Field, Note, Page } from '../components/ui'
import { prefectures, relationGroup, relationOptions } from '../data/mock'
import type { Gender, Relation } from '../data/types'
import { useApp } from '../state/AppState'

/**
 * iOS PartnerRegistrationView と同じ入力項目・同じ判定。
 * 本番：POST /api/partners（displayName, birthDate, birthTime, birthplace, gender, relationshipType, relationshipLabel, operationId）
 * → 出会った年は coupleMeetingSettings で別に保存（相手の登録だけ成功した場合は「登録」を押し直すと年だけ保存し直す）
 */
export function PartnerNewPage() {
  const { setPartner, partners, partnerNotice, partnerDraft, profile } = useApp()
  const current = partners[0]
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [relation, setRelation] = useState<Relation>('お付き合い中')
  const [birthDate, setBirthDate] = useState('1990-01-01')
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('東京都')
  const [gender, setGender] = useState<Gender>('female')
  const [metYear, setMetYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setName(partnerDraft?.name ?? ''); setRelation(partnerDraft?.relation ?? 'お付き合い中')
    setBirthDate(partnerDraft?.birthDate ?? '1990-01-01'); setBirthTime(partnerDraft?.birthTime ?? '')
    setBirthPlace(partnerDraft?.birthPlace ?? '東京都'); setGender(partnerDraft?.gender ?? 'female')
    setMetYear(partnerDraft?.metYear == null ? '' : String(partnerDraft.metYear)); setError(null)
  }, [partnerDraft])
  const thisYear = new Date().getFullYear()
  // iOSと同じ：出会った年は「ふたりが生まれた年以降」から今年まで
  const minMetYear = Math.max(Number(birthDate.slice(0, 4)) || 1900, Number(profile?.birthDate.slice(0, 4)) || 0)
  const valid = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    const raw = metYear.trim()
    if (raw && (!/^[0-9]{4}$/.test(raw) || Number(raw) < minMetYear || Number(raw) > thisYear)) {
      setError('出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください。')
      return
    }
    setSaving(true); setError(null)
    try {
      const partner = await setPartner({ name: name.trim(), relation, birthDate, birthTime: birthTime || null, birthPlace, gender, metYear: raw ? Number(raw) : null })
      navigate(`/couple/${partner.id}`)
    } catch {
      setError('登録を完了できませんでした。入力を残しているので、案内を確認してください。')
    } finally { setSaving(false) }
  }

  return (
    <Page>
      <BackHeader to="/couple" title={current ? '相手を変える' : '相手を登録する'} />
      <section className="flex flex-col gap-2.5 px-6 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{current ? '相手を変える' : '相手を登録する'}</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">相手の生年月日と出会った年から、ふたりの関係を一年ずつ読みます。</p>
        {partnerNotice && <p role="alert" className="m-0 text-[13px] leading-[1.7] text-fl-danger">{partnerNotice}</p>}
        {current && <Note>登録できる相手は1人です。登録すると、いまの相手（{current.name}）の年表と入れ替わります。{current.name}について作ったブックは本棚に残ります。入れ替えは何度でも無料です。</Note>}
      </section>

      <form onSubmit={submit} noValidate aria-busy={saving} className="flex flex-col gap-[22px] px-6 pt-5">
        <fieldset disabled={saving} className="contents">
        <Field id="pname" label="表示名" required maxLength={20} value={name} onChange={e => setName(e.target.value)} placeholder="呼び名" hint="読みものの中でこの名前を使います。本名でなくてかまいません。" />
        <div className="flex flex-col gap-1.5">
          <Field id="pmet" label="出会った年（任意）" inputMode="numeric" placeholder="例：2023" maxLength={4} value={metYear}
            onChange={e => { setMetYear(e.target.value.replace(/[^0-9]/g, '')); setError(null) }}
            hint="初めて知り合った年。この年からふたりの時系列を表示します。未入力でもふたりの読みものは利用できます。" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prel" className="text-[13px] font-medium text-fl-body">関係</label>
          <select id="prel" value={relation} onChange={e => setRelation(e.target.value as Relation)} className="min-h-[52px] w-full rounded-field border border-fl-line bg-white px-4 text-base">
            <optgroup label="恋愛・結婚">{relationOptions.filter(r => relationGroup(r) === 'romantic').map(r => <option key={r}>{r}</option>)}</optgroup>
            <optgroup label="友人・仕事など">{relationOptions.filter(r => relationGroup(r) === 'friend').map(r => <option key={r}>{r}</option>)}</optgroup>
            <optgroup label="家族">{relationOptions.filter(r => relationGroup(r) === 'family').map(r => <option key={r}>{r}</option>)}</optgroup>
          </select>
        </div>

        <div className="flex flex-col gap-[18px] rounded-card bg-white p-5">
          <span className="text-[13px] font-medium text-fl-body">相手の出生情報</span>
          <Field id="pbirth" label="生年月日" type="date" required value={birthDate} onChange={e => { setBirthDate(e.target.value); setError(null) }} min="1900-01-01" max={new Date().toISOString().slice(0, 10)} />
          <Field id="ptime" label="出生時刻（任意）" type="time" value={birthTime} onChange={e => setBirthTime(e.target.value)} hint="分からない場合は空欄のままで大丈夫です。" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pplace" className="text-[13px] font-medium text-fl-body">出生地</label>
            <select id="pplace" value={birthPlace} onChange={e => setBirthPlace(e.target.value)} className="min-h-[52px] w-full rounded-field border border-fl-line bg-white px-4 text-base">
              {prefectures.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="pb-1.5 text-[13px] font-medium text-fl-body">性別</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['female', 'male'] as const).map(g => (
                <Chip key={g} selected={gender === g} onClick={() => setGender(g)}><span className="w-full text-center">{g === 'female' ? '女性' : '男性'}</span></Chip>
              ))}
            </div>
          </fieldset>
        </div>

        {error && <p role="alert" className="m-0 text-[13px] leading-[1.7] text-fl-danger">{error}</p>}
        <Note>相手の方の生年月日は、ご本人の了解を得たうえで入力してください。登録した相手は、いつでも削除できます。</Note>

        <div className="flex flex-col gap-2.5 pb-12 pt-2">
          <Button type="submit" size="lg" disabled={!valid || saving}>{saving ? '登録しています…' : current ? `${current.name}と入れ替えて登録` : '登録'}</Button>
        </div>
        </fieldset>
      </form>
    </Page>
  )
}
