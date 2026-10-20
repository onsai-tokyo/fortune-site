import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BackHeader, Button, Chip, Field, Page, PlainHeader } from '../components/ui'
import type { Gender } from '../data/types'
import { useApp } from '../state/AppState'
import { prefectures } from '../data/mock'
import { safeReturnTo } from '../../lib/safeReturnTo'
import { CreatingPage } from './CreatingPage'
import { remoteMode } from '../data/paymentConfig'
import { BirthDateFields } from '../components/BirthDateFields'
import { validBirthDate } from '../data/birthDate'

/**
 * 生年月日の入力（トップから来なかった人・設定からの変更）。
 * 必須は生年月日と性別だけ。出生時刻・出生地・呼び名は「もっと正確に（任意）」にたたむ。
 * 本番：初回は signInAnonymously → プロフィール保存 → /api/calc/divination → /api/preview/generate
 */
export function OnboardingPage() {
  const { profile, saveProfile } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const rawReturn = params.get('returnTo')
  const returnTo = safeReturnTo(rawReturn, null)
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '')
  const [birthTime, setBirthTime] = useState(profile?.birthTime ?? '')
  const [birthPlace, setBirthPlace] = useState(profile?.birthPlace ?? '')
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [progress, setProgress] = useState(0)
  const editing = !!profile
  const valid = validBirthDate(birthDate) && gender !== null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || !gender || saving) return
    setSaving(true)
    setSaveError(false)
    try {
      await saveProfile({ nickname: nickname.trim(), birthDate, birthTime: birthTime || null, birthPlace, gender }, setProgress)
      if (editing) navigate(returnTo ?? '/settings')
      else navigate(remoteMode ? returnTo ?? '/you' : `/creating${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`)
    } catch { setSaveError(true) }
    finally { setSaving(false) }
  }

  if (saving) return <CreatingPage pending progress={progress} />
  return (
    <Page>
      {editing
        ? <BackHeader to={returnTo ?? '/settings'} title="生まれた日の情報" />
        : <PlainHeader right={<Link to="/restore" className="flex min-h-[44px] items-center px-1 text-[13px] text-fl-body">ログイン</Link>} />}

      <section className="flex flex-col gap-3 px-6 pb-2 pt-8">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{editing ? '生まれた日の情報を変える' : <>生まれた日を<br />教えてください</>}</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">{editing ? '変えると、読みものと年表がこの内容で計算し直されます。' : '暦の計算に使います。あとから変えられます。'}</p>
      </section>

      <form onSubmit={submit} className="flex flex-col gap-[22px] px-6 pt-5">
        <BirthDateFields id="birthdate" value={birthDate} onChange={setBirthDate} disabled={saving} />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="pb-1.5 text-[13px] font-medium text-fl-body">性別</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['female', 'male'] as const).map(g => (
              <Chip key={g} selected={gender === g} onClick={() => setGender(g)}>
                <span className="w-full text-center">{g === 'female' ? '女性' : '男性'}</span>
              </Chip>
            ))}
          </div>
          <span className="text-xs leading-[1.7] text-fl-muted">年ごとの流れの計算に使います。</span>
        </fieldset>

        <div className="flex flex-col gap-[18px]">
            <Field id="birthtime" label="出生時刻（任意）" type="time" value={birthTime} onChange={e => setBirthTime(e.target.value)}
              hint="母子健康手帳の出産の記録に載っています。時刻があると、時期を月単位で読めます。" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="place" className="text-[13px] font-medium text-fl-body">出生地（任意）</label>
              <select id="place" value={birthPlace} onChange={e => setBirthPlace(e.target.value)} className="min-h-[52px] w-full rounded-field border border-fl-line bg-white px-4 text-base">
                <option value="">未選択・分からない</option>{prefectures.map(p => <option key={p}>{p}</option>)}
              </select>
              <span className="text-xs leading-[1.7] text-fl-muted">出生時刻と合わせて、時差の補正に使います。</span>
            </div>
            <Field id="nickname" label="呼び名（任意）" maxLength={20} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="例：ゆう" hint="読みものの中で、この名前で呼びかけます。" />
        </div>

        <div className="flex flex-col gap-3 pb-12 pt-2">
          {!editing && (
            <p className="m-0 text-xs leading-[1.8] text-fl-muted">
              <Link to="/terms" className="underline">利用規約</Link>と<Link to="/privacy" className="underline">プライバシーポリシー</Link>に同意のうえお進みください。15歳以上の方がご利用いただけます。18歳未満の方は、保護者などの法定代理人の同意を得たうえでご利用ください。AIの相談ブック作成・質問は18歳以上の方に限ります。
            </p>
          )}
          {saveError && <p role="alert" className="m-0 text-sm leading-[1.8] text-fl-body">読みものを作成できませんでした。入力は残っています。時間をおいて、もう一度お試しください。</p>}
          <Button type="submit" size="lg" disabled={!valid || saving}>{saving ? '読みものをつくっています…' : editing ? '保存する' : '同意して、無料で読む'}</Button>
          {!editing && <span className="text-center text-xs leading-[1.7] text-fl-muted">登録・ログインは不要です。</span>}
        </div>
      </form>
    </Page>
  )
}
