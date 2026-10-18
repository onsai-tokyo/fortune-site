import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Chip, Footer, LinkButton, NatureImage, Page, PlainHeader } from '../components/ui'
import { images } from '../data/images'
import { mockYears, plans } from '../data/mock'
import type { Gender } from '../data/types'
import { useApp } from '../state/AppState'
import { paymentsAvailable, BOOK_PREPARING } from '../data/paymentConfig'

const steps = [
  { title: 'あなたを読む', body: '生年月日を入れると、性格の章と、過去からこれからまでの年ごとの流れが読めます。' },
  { title: 'ふたりの年表をひらく', body: '大切な人の生年月日と出会った年から、ふたりの関係を一年ずつたどれます。相手は何度でも入れ替えられます。' },
  { title: '気になる年を、一冊に', body: '読みものをもとに相談を書くと、あなたへの答えが一冊のブックになって本棚に届きます。' },
]

/** 見本の年表（人の名前は出さない。年齢は見本の生年 1994 年から） */
const SAMPLE_BIRTH_YEAR = 1994
const sampleYears = mockYears.slice(0, 4)

export function TopPage() {
  const { profile, saveProfile } = useApp()
  const navigate = useNavigate()
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && gender !== null
  const today = new Date().toISOString().slice(0, 10)

  function start(e: FormEvent) {
    e.preventDefault()
    if (!valid || !gender) return
    // 出生時刻・出生地・呼び名はあとから足せる（出生地は時刻がない間は計算に影響しない）
    saveProfile({ nickname: '', birthDate, birthTime: null, birthPlace: '東京都', gender })
    navigate('/creating')
  }

  function goToForm() {
    document.getElementById('start')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    window.setTimeout(() => dateRef.current?.focus({ preventScroll: true }), 300)
  }

  return (
    <Page>
      <PlainHeader right={<Link to={profile ? '/you' : '/restore'} className="flex min-h-[44px] items-center px-1 text-[13px] text-fl-body">{profile ? 'つづきを読む' : '別の端末から引き継ぐ'}</Link>} />

      <section className="flex flex-col gap-4 px-6 pb-6 pt-10">
        <h1 className="m-0 text-[28px] font-medium leading-[1.6]">生まれた日から、<br />あなたの一年ずつを読む。</h1>
        <p className="m-0 text-[15px] leading-[1.9] text-fl-body">四柱推命とインド占星術の暦の計算から、あなたの性格と、過去からこれからまでの年ごとの流れを読みものにします。大切な人を登録すれば、ふたりの年表も。</p>
      </section>

      <section className="px-5 pb-10">
        {profile ? (
          <div className="flex flex-col gap-3 rounded-card bg-white p-5">
            <span className="text-[15px] font-medium">おかえりなさい</span>
            <span className="text-sm leading-[1.8] text-fl-body">あなたの読みものは、この端末に用意してあります。</span>
            <LinkButton to="/you" size="lg">つづきを読む</LinkButton>
          </div>
        ) : (
          <form id="start" onSubmit={start} className="flex flex-col gap-[18px] rounded-card border border-fl-line bg-white p-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="top-birthdate" className="text-[13px] font-medium text-fl-body">生年月日</label>
              <input ref={dateRef} id="top-birthdate" type="date" required min="1900-01-01" max={today} value={birthDate} onChange={e => setBirthDate(e.target.value)}
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
            <p className="m-0 text-xs leading-[1.8] text-fl-muted">
              <Link to="/terms" className="underline">利用規約</Link>と<Link to="/privacy" className="underline">プライバシーポリシー</Link>に同意のうえお進みください。18歳以上の方がご利用いただけます。
            </p>
            <Button type="submit" size="lg" disabled={!valid}>同意して、無料で読む</Button>
            <span className="text-center text-xs leading-[1.7] text-fl-muted">登録・ログインは不要です。出生時刻と出生地は、あとから足せます。</span>
          </form>
        )}
      </section>

      <section className="px-5 pb-8">
        <NatureImage src={images.mountains} alt="霧のかかった山なみ" className="h-[180px] rounded-card sm:h-[220px]" />
      </section>

      <section className="flex flex-col gap-4 px-6 pb-12">
        <h2 className="m-0 text-xl font-medium leading-relaxed">たとえば、こんな年表に</h2>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">一年ごとに、その年の流れと過ごし方を読めます。過去の年をふり返ることも、これからの年を先に読むこともできます。</p>
        <ol className="m-0 flex list-none flex-col p-0" aria-label="年表の見本">
          {sampleYears.map(y => {
            const now = y.label === '今年'
            return (
              <li key={y.year} className="flex gap-3.5">
                <span className="flex w-3.5 flex-col items-center" aria-hidden="true">
                  <span className={now ? 'mt-[18px] h-3 w-3 rounded-full bg-fl-moss' : 'mt-[19px] h-2.5 w-2.5 rounded-full border border-fl-muted bg-fl-canvas'} />
                  <span className="w-px flex-1 bg-fl-line" />
                </span>
                <span className="flex flex-1 flex-col gap-1 border-b border-fl-line py-3.5">
                  <span className="text-xs text-fl-muted">{y.year}年・{y.year - SAMPLE_BIRTH_YEAR}歳になる年{now ? '（今年）' : ''}</span>
                  <span className={`text-[15px] leading-normal ${now ? 'font-bold' : 'font-medium'}`}>{y.title}</span>
                </span>
              </li>
            )
          })}
        </ol>
        <p className="m-0 text-xs leading-[1.7] text-fl-muted">見本です。表示される文章は、生年月日によって変わります。</p>
      </section>

      <section className="flex flex-col gap-7 bg-fl-surface px-6 py-10">
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

      <section className="flex flex-col gap-4 px-6 py-10">
        <h2 className="m-0 text-xl font-medium">料金</h2>
        <div className="flex justify-between border-b border-fl-line py-4 text-[15px]"><span>性格・年ごとの流れ・ふたりの年表</span><span className="font-medium">無料</span></div>
        {paymentsAvailable ? plans.map(plan => (
          <div key={plan.id} className="flex justify-between border-b border-fl-line py-4 text-[15px]">
            <span>相談のブック {plan.name}</span><span className="font-medium">{plan.price.toLocaleString()}円</span>
          </div>
        )) : <p className="text-[15px]">{BOOK_PREPARING}</p>}
        <span className="text-xs leading-[1.7] text-fl-muted">{paymentsAvailable ? '価格は税込です。' : '新しい冊数の購入は準備中です。'}ブック1冊ごとに、そのブックへの質問が2回つきます。月額の契約や自動更新はありません。届いたブックは、いつでも本棚で読み返せます。占いの結果は、出来事や効果を約束するものではありません。</span>
      </section>

      <section className="px-6 pb-12">
        {profile ? <LinkButton to="/you" size="lg">つづきを読む</LinkButton> : <Button size="lg" onClick={goToForm}>生年月日を入れて読む</Button>}
      </section>

      <Footer />
    </Page>
  )
}
