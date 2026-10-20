import { useRef, useState, type FormEvent } from 'react'
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
  const { profile, saveProfile } = useApp()
  const navigate = useNavigate()
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && gender !== null
  const today = new Date().toISOString().slice(0, 10)

  async function start(e: FormEvent) {
    e.preventDefault()
    if (!valid || !gender || saving) return
    // 出生時刻・出生地・呼び名はあとから足せる（出生地は時刻がない間は計算に影響しない）
    setSaving(true)
    setSaveError(false)
    try {
      await saveProfile({ nickname: '', birthDate, birthTime: birthTime || null, birthPlace, gender })
      navigate(remoteMode ? '/you' : '/creating')
    } catch { setSaveError(true) }
    finally { setSaving(false) }
  }

  function goToForm() {
    document.getElementById('start')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    window.setTimeout(() => dateRef.current?.focus({ preventScroll: true }), 300)
  }

  if (saving) return <CreatingPage pending />
  return (
    <Page>
      <PlainHeader right={<Link to={profile ? '/you' : '/restore'} className="flex min-h-[44px] items-center px-1 text-[13px] text-fl-body">{profile ? 'つづきを読む' : 'ログイン'}</Link>} />

      <section className="fl-hero flex flex-col gap-4 px-6 pb-6 pt-10">
        <Eyebrow>暦をひらく。自分を知る。</Eyebrow>
        <h1 className="m-0 text-[28px] font-medium leading-[1.6]">生まれた日から、<br />あなたの一年ずつを読む。</h1>
        <p className="m-0 text-[15px] leading-[1.9] text-fl-body">四柱推命とインド占星術の暦から、あなたの性格と年ごとの流れを読み解きます。大切な人を登録すると、ふたりの年表もひらけます。</p>
        <NatureImage src={images.mountains} alt="霧のかかった山なみ" className="fl-hero-image h-[180px] rounded-card sm:h-[220px]" />
      </section>

      <section className="px-5 pb-10">
        {profile ? (
          <div className="flex flex-col gap-3 rounded-card bg-white p-5">
            <span className="text-[15px] font-medium">おかえりなさい</span>
            <span className="text-sm leading-[1.8] text-fl-body">あなたの読みものは、この端末に用意してあります。</span>
            <LinkButton to="/you" size="lg">つづきを読む</LinkButton>
          </div>
        ) : (
          <form id="start" onSubmit={start} className="fl-entry-form flex flex-col gap-[18px] rounded-card border border-fl-line bg-white p-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="top-birthdate" className="text-[13px] font-medium text-fl-body">生年月日</label>
              <input ref={dateRef} id="top-birthdate" type="date" required disabled={saving} min="1900-01-01" max={today} value={birthDate} onChange={e => setBirthDate(e.target.value)}
                className="min-h-[52px] w-full rounded-field border border-fl-line bg-white px-4 text-base text-fl-ink" />
            </div>
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
        <img src="/images/timeline-preview.svg" alt="年ごとの流れの見本。2024年は土台を整える、2025年は新しい一歩、2026年はつながりを育てる。" width="640" height="380" loading="lazy" className="w-full rounded-card border border-fl-line" />
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
        <h2 className="m-0 text-xl font-medium">暦の計算を、相談のよりどころに。</h2>
        <p className="m-0 text-sm leading-[1.9] text-fl-body">出生情報から読み解いた鑑定結果をもとに、AIがあなたの相談を深掘りします。一般的なアドバイスだけでなく、選んだ性格の章や年の流れに沿って、一冊の答えをお届けします。</p>
        <p className="m-0 text-xs leading-relaxed text-fl-muted">占いの結果は、出来事や効果を約束するものではありません。</p>
      </section>

      <section className="px-6 pb-12">
        {profile ? <LinkButton to="/you" size="lg">つづきを読む</LinkButton> : <Button size="lg" onClick={goToForm}>生年月日を入れて読む</Button>}
      </section>

      <Footer />
    </Page>
  )
}
