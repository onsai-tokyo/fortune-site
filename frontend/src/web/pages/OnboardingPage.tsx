import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BackHeader, Button, Chip, Field, Page, PlainHeader } from '../components/ui'
import { IconDown } from '../components/icons'
import type { Gender } from '../data/types'
import { useApp } from '../state/AppState'
import { prefectures } from '../data/mock'
import { safeReturnTo } from '../../lib/safeReturnTo'

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
  const [birthPlace, setBirthPlace] = useState(profile?.birthPlace ?? '東京都')
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null)
  const editing = !!profile
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && gender !== null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || !gender) return
    saveProfile({ nickname: nickname.trim(), birthDate, birthTime: birthTime || null, birthPlace, gender })
    if (editing) navigate(returnTo ?? '/settings')
    else navigate(`/creating${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`)
  }

  return (
    <Page>
      {editing
        ? <BackHeader to={returnTo ?? '/settings'} title="生まれた日の情報" />
        : <PlainHeader right={<Link to="/restore" className="flex min-h-[44px] items-center px-1 text-[13px] text-fl-body">別の端末から引き継ぐ</Link>} />}

      <section className="flex flex-col gap-3 px-6 pb-2 pt-8">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{editing ? '生まれた日の情報を変える' : <>生まれた日を<br />教えてください</>}</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">{editing ? '変えると、読みものと年表がこの内容で計算し直されます。' : '暦の計算に使います。あとから変えられます。'}</p>
      </section>

      <form onSubmit={submit} className="flex flex-col gap-[22px] px-6 pt-5">
        <Field id="birthdate" label="生年月日" type="date" required value={birthDate} onChange={e => setBirthDate(e.target.value)} min="1900-01-01" max={new Date().toISOString().slice(0, 10)} />
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

        <details open={editing} className="group rounded-card border border-fl-line bg-white [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 text-[15px] font-medium">
            <span className="flex flex-col gap-0.5"><span>もっと正確に（任意）</span><span className="text-xs font-normal text-fl-muted">出生時刻・出生地・呼び名</span></span>
            <IconDown size={18} className="shrink-0 text-fl-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-[18px] border-t border-fl-line px-5 pb-5 pt-4">
            <Field id="birthtime" label="出生時刻" type="time" value={birthTime} onChange={e => setBirthTime(e.target.value)}
              hint="母子健康手帳の出産の記録に載っています。時刻があると、時期を月単位で読めます。" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="place" className="text-[13px] font-medium text-fl-body">出生地</label>
              <select id="place" value={birthPlace} onChange={e => setBirthPlace(e.target.value)} className="min-h-[52px] w-full rounded-field border border-fl-line bg-white px-4 text-base">
                {prefectures.map(p => <option key={p}>{p}</option>)}
              </select>
              <span className="text-xs leading-[1.7] text-fl-muted">出生時刻と合わせて、時差の補正に使います。</span>
            </div>
            <Field id="nickname" label="呼び名" maxLength={20} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="例：ゆう" hint="読みものの中で、この名前で呼びかけます。" />
          </div>
        </details>

        <div className="flex flex-col gap-3 pb-12 pt-2">
          {!editing && (
            <p className="m-0 text-xs leading-[1.8] text-fl-muted">
              <Link to="/terms" className="underline">利用規約</Link>と<Link to="/privacy" className="underline">プライバシーポリシー</Link>に同意のうえお進みください。18歳以上の方がご利用いただけます。
            </p>
          )}
          <Button type="submit" size="lg" disabled={!valid}>{editing ? '保存する' : '同意して、無料で読む'}</Button>
          {!editing && <span className="text-center text-xs leading-[1.7] text-fl-muted">登録・ログインは不要です。</span>}
        </div>
      </form>
    </Page>
  )
}
