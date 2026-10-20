import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BackHeader, Button, Chip, Field, Note, Page } from '../components/ui'
import { prefectures, relationGroup, relationOptions } from '../data/mock'
import type { Gender, Relation } from '../data/types'
import { useApp } from '../state/AppState'

/**
 * iOS PartnerRegistrationView と同じ入力項目・同じ判定。
 * 本番：POST /api/partners（displayName, birthDate, birthTime, birthplace, gender, relationshipType, relationshipLabel, operationId）
 * → 出会った年は coupleMeetingSettings で別に保存（相手の登録だけ成功した場合は「登録」を押し直すと年だけ保存し直す）
 */
export function PartnerNewPage({ embedded = false }: { embedded?: boolean }) {
  const { setPartner, cancelPartnerDraft, partners, partnerNotice, partnerDraft, partnerReplacementId, partnerLimit, reloadReadings, profile } = useApp()
  const [params] = useSearchParams()
  const [replacementId, setReplacementId] = useState(params.get('replace') ?? partnerReplacementId ?? '')
  const multiple = partners.length > 1
  const current = partners.find(p => p.id === (partnerDraft ? partnerReplacementId : replacementId)) ?? (!replacementId && !multiple && !partnerDraft ? partners[0] : undefined)
  const missingTarget = !partnerDraft && !!replacementId && !partners.some(p => p.id === replacementId)
  const noCapacity = multiple && (!partnerLimit || partners.length - 1 >= partnerLimit)
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
    if (partnerReplacementId) setReplacementId(partnerReplacementId)
  }, [partnerReplacementId])
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
    if (!valid || saving || missingTarget || (!partnerDraft && multiple && (!current || noCapacity))) return
    const raw = metYear.trim()
    if (raw && (!/^[0-9]{4}$/.test(raw) || Number(raw) < minMetYear || Number(raw) > thisYear)) {
      setError('出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください。')
      return
    }
    setSaving(true); setError(null)
    try {
      const partner = await setPartner({ name: name.trim(), relation, birthDate, birthTime: birthTime || null, birthPlace, gender, metYear: raw ? Number(raw) : null }, partnerDraft ? partnerReplacementId ?? undefined : replacementId || current?.id)
      navigate(`/couple/${partner.id}`)
    } catch {
      setError('登録を完了できませんでした。入力を残しているので、案内を確認してください。')
    } finally { setSaving(false) }
  }

  const Heading = embedded ? 'h2' : 'h1'
  const content = <>
      {!embedded && <BackHeader to="/couple" title={current ? '相手を変える' : '相手を登録する'} />}
      <section className="flex flex-col gap-2.5 px-6 pb-2 pt-7">
        <Heading className="m-0 text-[24px] font-medium leading-[1.55]">{current ? '相手を変える' : '相手を登録する'}</Heading>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">相手の生年月日と出会った年から、ふたりの関係を一年ずつ読みます。</p>
        {missingTarget && <p role="alert" className="text-sm leading-relaxed">選択した相手が見つかりません。別の相手には自動で切り替えません。<button type="button" className="underline" onClick={() => setReplacementId('')}>対象を選び直す</button></p>}
        {multiple && <>
          <p role="status" className="text-sm leading-relaxed">相手が{partners.length}人登録されています。読む相手、または入れ替える相手を選んでください。他の相手は削除しません。</p>
          <nav aria-label="登録済みの相手" className="flex flex-col gap-2">{partners.map(p => <Link key={p.id} to={`/couple/${p.id}`} className="rounded-xl border border-fl-line p-3 text-sm">{p.name}との年表を読む</Link>)}</nav>
          <label className="text-sm">入れ替える相手<select aria-label="入れ替える相手" value={current?.id ?? ''} disabled={saving || !!partnerDraft} onChange={e => setReplacementId(e.target.value)} className="mt-2 block w-full rounded-xl border border-fl-line p-3"><option value="">選んでください</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          {noCapacity && <p role="status" className="text-sm leading-relaxed">{partnerLimit ? '1人を削除しても登録枠が足りないため、入れ替えは開始できません。' : '登録枠を確認できないため、入れ替えは開始できません。'}既存の相手はそのまま読めます。アプリで登録状況を確認するか、<button type="button" className="underline" onClick={reloadReadings}>再読み込み</button>してください。</p>}
        </>}
        {partnerNotice && <p role="alert" className="m-0 text-[13px] leading-[1.7] text-fl-danger">{partnerNotice}</p>}
        {partnerDraft && <Button variant="secondary" disabled={saving} onClick={async () => {
          setSaving(true); setError(null)
          try { await cancelPartnerDraft(); setReplacementId('') }
          catch (error) { setError(error instanceof Error ? error.message : '登録状況を確認できませんでした。') }
          finally { setSaving(false) }
        }}>未完了の登録を取り消して入力し直す</Button>}
        {partnerDraft && <p className="text-xs text-fl-muted">登録済みの相手を削除する操作ではありません。前の相手が削除済みの場合は、取り消しても元には戻りません。</p>}
        {current && <Note>{!multiple && '登録できる相手は1人です。'}登録すると、{multiple ? '選んだ相手' : 'いまの相手'}（{current.name}）の年表と入れ替わります。{multiple && '他の相手は削除しません。'}{current.name}について作ったブックは本棚に残ります。入れ替えは何度でも無料です。</Note>}
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
        <Note>登録した相手は、いつでも削除できます。</Note>

        <div className="flex flex-col gap-2.5 pb-12 pt-2">
          <Button type="submit" size="lg" disabled={!valid || saving || missingTarget || (!partnerDraft && multiple && (!current || noCapacity))}>{saving ? '登録しています…' : partnerDraft ? '登録状況を再確認する' : current ? `${current.name}と入れ替えて登録` : '登録'}</Button>
        </div>
        </fieldset>
      </form>
    </>
  return embedded ? content : <Page>{content}</Page>
}
