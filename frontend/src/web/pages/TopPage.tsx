import { useState, type FormEvent } from 'react'
import { BirthDateFields } from '../components/BirthDateFields'
import { validBirthDate } from '../data/birthDate'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Chip, Eyebrow, Field, Footer, LinkButton, NatureImage, Page, PlainHeader } from '../components/ui'
import { images } from '../data/images'
import { prefectures } from '../data/mock'
import { CreatingPage } from './CreatingPage'
import { remoteMode } from '../data/paymentConfig'
import type { Gender } from '../data/types'
import { useApp } from '../state/AppState'

const steps = [
  { title: 'あなたを読む', body: '生年月日を入れると、性格の章と、過去からこれからまでの年ごとの流れが読めます。' },
  { title: 'ふたりの年表をひらく', body: '大切な人の生年月日と出会った年から、ふたりの関係を一年ずつたどれます。相手は何度でも入れ替えられます。' },
  { title: '気になる年を、一冊に', body: '読みものをもとに相談を書くと、あなたへの答えが一冊のブックになって本棚に届きます。' },
]

export function TopPage() {
  const { profile, saveProfile, years, chapters, readingsStatus } = useApp()
  const hasReading = Boolean(profile && (!remoteMode || (readingsStatus === 'ready' && years.length && chapters.length)))
  const navigate = useNavigate()
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [progress, setProgress] = useState(0)
  const valid = validBirthDate(birthDate) && gender !== null

  async function start(e: FormEvent) {
    e.preventDefault()
    if (!valid || !gender || saving) return
    // 出生時刻・出生地・呼び名はあとから足せる（出生地は時刻がない間は計算に影響しない）
    setSaving(true)
    setSaveError(false)
    try {
      await saveProfile({ nickname: '', birthDate, birthTime: birthTime || null, birthPlace, gender }, setProgress)
      navigate(remoteMode ? '/you' : '/creating')
    } catch { setSaveError(true) }
    finally { setSaving(false) }
  }

  function goToForm() {
    document.getElementById('start')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    window.setTimeout(() => document.querySelector<HTMLSelectElement>('#top-birthdate select')?.focus({ preventScroll: true }), 300)
  }

  if (saving) return <CreatingPage pending progress={progress} />
  return (
    <Page>
      <PlainHeader right={<Link to={profile ? '/you' : '/restore'} className="flex min-h-[44px] items-center px-1 text-[13px] text-fl-body">{profile ? 'つづきを読む' : 'ログイン'}</Link>} />

      <section className="fl-hero fl-hero-backdrop flex flex-col gap-4 px-6 pb-6 pt-10" style={{ backgroundImage: `linear-gradient(90deg, rgba(250,249,245,.96), rgba(250,249,245,.76)), url("${images.mountains}")` }}>
        <Eyebrow>暦をひらく。自分を知る。</Eyebrow>
        <h1 className="m-0 text-[28px] font-medium leading-[1.6]">生まれた日から、<br />あなたの一年ずつを読む。</h1>
        <p className="m-0 text-[15px] leading-[1.9] text-fl-body">四柱推命とインド占星術の暦から、あなたの性格と年ごとの流れを読み解きます。大切な人を登録すると、ふたりの年表もひらけます。</p>
      </section>

      <section className="px-5 pb-10">
        {hasReading ? (
          <div className="flex flex-col gap-3 rounded-card bg-white p-5">
            <span className="text-[15px] font-medium">おかえりなさい</span>
            <span className="text-sm leading-[1.8] text-fl-body">あなたの読みものは、この端末に用意してあります。</span>
            <LinkButton to="/you" size="lg">つづきを読む</LinkButton>
          </div>
        ) : profile ? (
          <div className="flex flex-col gap-3 rounded-card bg-white p-5">
            <span className="text-[15px] font-medium">鑑定の表示を確認しましょう</span>
            <span className="text-sm leading-[1.8] text-fl-body">出生情報はありますが、読みものの表示を確認できていません。保存状況を確認するか、出生情報から作成を再開できます。</span>
            <LinkButton to="/you" size="lg">保存状況を確認する</LinkButton>
            <LinkButton to="/welcome?returnTo=%2Fyou">出生情報を確認して再開</LinkButton>
          </div>
        ) : (
          <form id="start" onSubmit={start} className="fl-entry-form flex flex-col gap-[18px] rounded-card border border-fl-line bg-white p-5">
            <BirthDateFields id="top-birthdate" value={birthDate} onChange={setBirthDate} disabled={saving} />
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="pb-1.5 text-[13px] font-medium text-fl-body">性別</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['female', 'male'] as const).map(g => (
                  <Chip key={g} selected={gender === g} onClick={() => setGender(g)}><span className="w-full text-center">{g === 'female' ? '女性' : '男性'}</span></Chip>
                ))}
              </div>
            </fieldset>
              <div className="flex flex-col gap-4 bg-white">
                <Field id="top-birthtime" label="出生時刻（任意）" type="time" value={birthTime} onChange={e => setBirthTime(e.target.value)} hint="分からない場合は空欄で進めます。" />
                <label htmlFor="top-birthplace" className="text-[13px]">出生地（任意）</label>
                <select id="top-birthplace" value={birthPlace} onChange={e => setBirthPlace(e.target.value)} className="min-h-[52px] rounded-field border bg-white px-4 text-base"><option value="">未選択・分からない</option>{prefectures.map(p => <option key={p}>{p}</option>)}</select>
                <p className="m-0 text-xs text-fl-muted">出生時刻と出生地を合わせて、暦の計算に使います。あとから変更できます。</p>
              </div>
            <p className="m-0 text-xs leading-[1.8] text-fl-muted">
              <Link to="/terms" className="underline">利用規約</Link>と<Link to="/privacy" className="underline">プライバシーポリシー</Link>に同意のうえお進みください。15歳以上の方がご利用いただけます。18歳未満の方は、保護者などの法定代理人の同意を得たうえでご利用ください。AIの相談ブック作成・質問は18歳以上の方に限ります。
            </p>
            {saveError && <p role="alert" className="m-0 text-sm leading-[1.8] text-fl-body">読みものを作成できませんでした。入力は残っています。時間をおいて、もう一度お試しください。</p>}
            <Button type="submit" size="lg" disabled={!valid || saving}>{saving ? '読みものをつくっています…' : '同意して、無料で読む'}</Button>
            <span className="text-center text-xs leading-[1.7] text-fl-muted">読むだけなら登録不要です。本棚への保存にはメール登録が必要です。</span>
          </form>
        )}
      </section>

      <section className="fl-landing-section flex flex-col gap-4 px-6 pb-12">
        <h2 className="m-0 text-xl font-medium leading-relaxed">たとえば、こんな年表に</h2>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">一年ごとに、その年の流れと過ごし方を読めます。過去の年をふり返ることも、これからの年を先に読むこともできます。</p>
        <div className="fl-timeline-example rounded-card border border-fl-line bg-fl-cream p-5">
          <Eyebrow>YOUR YEARS · 年表の見本</Eyebrow>
          <ol className="mb-0 mt-5 list-none space-y-4 border-l border-fl-moss/30 pl-4">
            {[
              ['2025', '土台を整える年', '暮らしを整える', '身近な習慣を見直し、自分にとって無理のないペースを探す時期。'],
              ['2026', '新しい一歩を踏み出す年', '転機', 'これまで温めてきたことを、小さく試すところから。変化の速さより、納得できる選択を大切に。'],
              ['2027', 'つながりを育てる年', '人との関わり', '一人で抱えず、信頼できる人と言葉を交わすことが次の手がかりに。'],
            ].map(([year, title, tag, body]) => <li key={year} className="rounded-xl bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-fl-moss">{year}年</span><span className="rounded-full bg-fl-cream px-2 py-1 text-[11px] text-fl-body">{tag}</span></div>
              <h3 className="my-2 text-base font-medium">{title}</h3><p className="m-0 text-[13px] leading-[1.85] text-fl-body">{body}</p>
            </li>)}
          </ol>
        </div>
        <p className="m-0 text-xs leading-[1.7] text-fl-muted">見本です。表示される文章は、生年月日によって変わります。</p>
      </section>

      <section className="fl-landing-section flex flex-col gap-7 bg-fl-surface px-6 py-10">
        <h2 className="m-0 text-xl font-medium leading-relaxed">できること</h2>
        <div className="grid grid-cols-3 gap-2" aria-hidden="true">
          {[images.nature.leaf, images.nature.cosmos, images.nature.stones].map(src => (
            <NatureImage key={src} src={src} className="aspect-square rounded-xl" />
          ))}
        </div>
        {steps.map((step, i) => (
          <div key={step.title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-fl-line bg-white text-sm font-medium">{i + 1}</span>
            <div className="flex flex-col gap-1.5">
              <span className="text-base font-medium">{step.title}</span>
              <span className="text-sm leading-[1.8] text-fl-body">{step.body}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="fl-landing-section flex flex-col gap-4 px-6 py-10">
        <Eyebrow>あなたの鑑定から、あなたへの答えへ</Eyebrow>
        <h2 className="m-0 text-xl font-medium">良い面も、注意点も。鑑定を根拠に答える。</h2>
        <p className="m-0 text-sm leading-[1.9] text-fl-body">FATE LAB独自の鑑定データと暦の計算ロジックから、あなたの性格や年ごとの流れを読み解きます。AIはその鑑定結果をもとに、個別の相談に沿った一冊の回答をつくります。</p>
        <p className="m-0 text-sm leading-[1.9] text-fl-body">ただ励ますために良いことだけを伝えたり、不安をあおるために悪く伝えたりするのではなく、追い風になる面も、気をつけたい面も、根拠に沿って率直に伝えることを目指しています。</p>
        <p className="m-0 text-xs leading-relaxed text-fl-muted">占いとAIの回答は、正確性や将来の出来事・効果を保証するものではありません。判断の参考としてお使いください。</p>
      </section>

      <section className="px-6 pb-12">
        {profile ? <LinkButton to="/you" size="lg">つづきを読む</LinkButton> : <Button size="lg" onClick={goToForm}>生年月日を入れて読む</Button>}
      </section>

      <Footer />
    </Page>
  )
}
