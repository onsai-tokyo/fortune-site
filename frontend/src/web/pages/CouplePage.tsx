import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { IconBookmark, IconPen } from '../components/icons'
import { Card, Footer, LinkButton, NatureImage, Page } from '../components/ui'
import { images } from '../data/images'
import { mockCoupleYears, relationGroup, savedKey } from '../data/mock'
import { useApp } from '../state/AppState'
import { useCenterCurrent } from '../components/useCenterCurrent'

/** /couple：相手がいれば最初の相手へ、いなければ案内 */
export function CoupleIndexPage() {
  const { partners, partnerNotice } = useApp()
  if (partners.length) return <Navigate to={`/couple/${partners[0].id}`} replace />
  return (
    <Page>
      <SiteHeader current="couple" />
      <section className="px-5 pt-6">
        <Card className="flex flex-col items-center gap-[18px] px-6 pb-8 pt-5 text-center">
          <NatureImage src={images.dunes} className="h-[150px] rounded-xl" />
          <h1 className="m-0 text-xl font-medium leading-relaxed">大切な人との年表を<br />つくってみませんか</h1>
          <p className="m-0 text-sm leading-[1.85] text-fl-body">相手の生年月日と出会った年を入れると、ふたりの関係を一年ずつ読めます。過去の年も、これからの年も無料で、相手は何度でも入れ替えられます。</p>
          <LinkButton to="/couple/new" size="lg">相手を登録する</LinkButton>
        </Card>
        {partnerNotice && <p role="alert" className="mt-3 text-[13px] leading-[1.7] text-fl-danger">{partnerNotice}</p>}
      </section>
      <section className="flex flex-col gap-1 px-5 pt-8">
        <h2 className="mb-2 mt-0 text-base font-medium">ふたりの年表でできること</h2>
        {['出会った年から今年まで、その年のふたりの読みものを読む', '同じ年の、あなたと相手それぞれの流れを知る', '気になる年について相談し、ブックにして本棚に残す'].map((t, i) => (
          <div key={t} className="flex gap-3.5 border-b border-fl-line py-3.5">
            <span className="w-[22px] text-[13px] text-fl-muted">0{i + 1}</span>
            <span className="text-sm leading-[1.8] text-fl-body">{t}</span>
          </div>
        ))}
      </section>
      <Footer />
    </Page>
  )
}

export function CouplePage() {
  const { partnerId } = useParams()
  const [params, setParams] = useSearchParams()
  const { partners, setDraft, savedIds, toggleSaved } = useApp()
  const tabsRef = useCenterCurrent<HTMLDivElement>(`${partnerId}-${params.get('year')}`)
  const partner = partners.find(p => p.id === partnerId)
  if (!partner) return <Navigate to="/couple" replace />

  const years = mockCoupleYears.filter(y => !partner.metYear || y.year >= partner.metYear)
  const pickedYear = Number(params.get('year')) || 2026
  const current = years.find(y => y.year === pickedYear) ?? years[years.length - 2] ?? years[0]
  const pick = (year: number) => setParams({ year: String(year) }, { replace: true })

  function startCompose() {
    setDraft({ sourceTitle: `${partner!.name}との${current.year}年`, sourceSub: current.title, sourceHref: `/couple/${partner!.id}?year=${current.year}`, theme: relationGroup(partner!.relation) === 'romantic' ? '恋愛・関係' : '人間関係' })
  }

  return (
    <Page>
      <SiteHeader current="couple" />

      <section className="flex flex-col gap-3.5 px-5 pb-2 pt-6">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">ふたりの年表</h1>
        <div className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-fl-line bg-white px-4 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fl-cream text-[15px] font-medium text-fl-rose">{partner.name.slice(0, 1)}</span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-base font-medium">あなた と {partner.name}</span>
            <span className="text-xs text-fl-muted">{partner.relation}{partner.metYear ? `・${partner.metYear}年から` : ''}</span>
          </span>
          <Link to="/couple/new" className="flex min-h-[44px] items-center px-1 text-[13px] font-medium text-fl-slate">相手を変える</Link>
        </div>
      </section>

      <section className="pt-3">
        <div ref={tabsRef} role="tablist" aria-label="年を選ぶ" className="relative flex gap-2 overflow-x-auto px-5 pb-3 pt-1">
          {years.map(y => (
            <button key={y.year} type="button" role="tab" aria-selected={y.year === current.year} data-current={y.year === current.year} onClick={() => pick(y.year)}
              className={`flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-sm ${y.year === current.year ? 'bg-fl-ink font-medium text-white' : 'border border-fl-line bg-white text-fl-body'}`}>{y.year}</button>
          ))}
        </div>
      </section>

      <section className="px-5 pt-1">
        <Card className="flex flex-col gap-3.5 px-5 py-[22px]">
          <NatureImage src={images.starMountains} className="h-[140px] rounded-xl" position="center 55%" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-[0.15em] text-fl-slate">{current.year}年のふたり</span>
            <span className="flex items-center gap-1 text-xs text-fl-muted">{current.label}
              <button type="button" onClick={() => toggleSaved(savedKey.couple(partner.id, current.year))} aria-pressed={savedIds.includes(savedKey.couple(partner.id, current.year))}
                aria-label={savedIds.includes(savedKey.couple(partner.id, current.year)) ? '保存を取り消す' : '本棚に保存する'} className="-my-2 flex h-11 w-11 items-center justify-center rounded-xl text-fl-ink hover:bg-fl-surface">
                <IconBookmark size={18} filled={savedIds.includes(savedKey.couple(partner.id, current.year))} />
              </button>
            </span>
          </div>
          <h2 className="m-0 text-[21px] font-medium leading-relaxed">{current.title}</h2>
          {current.body.map(p => <p key={p} className="m-0 text-[15px] leading-[1.9] text-fl-body">{p}</p>)}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="rounded-full bg-fl-surface px-3 py-1.5 text-xs text-fl-body">あなた：{current.you}</span>
            <span className="rounded-full bg-fl-surface px-3 py-1.5 text-xs text-fl-body">{partner.name}：{current.partner}</span>
          </div>
          <Link to="/compose" onClick={startCompose} className="mt-1.5 flex min-h-[50px] items-center justify-center gap-2 rounded-button bg-fl-ink text-[15px] font-medium text-white">
            <IconPen size={18} />この年について相談する
          </Link>
        </Card>
        <p className="mx-1 mt-2.5 text-xs text-fl-muted">文章はサンプルです。</p>
      </section>

      <section className="flex flex-col gap-1 px-5 pb-6 pt-8">
        <h3 className="mb-2 mt-0 text-base font-medium">ふたりの年表</h3>
        {years.map(y => {
          const on = y.year === current.year
          return (
            <button key={y.year} type="button" onClick={() => pick(y.year)} className="flex min-h-[64px] items-stretch gap-3.5 text-left">
              <span className="flex w-3.5 flex-col items-center">
                <span className={on ? 'mt-3.5 h-3 w-3 rounded-full bg-fl-slate' : 'mt-[15px] h-2.5 w-2.5 rounded-full border border-fl-muted bg-white'} />
                <span className="w-px flex-1 bg-fl-line" />
              </span>
              <span className="flex flex-1 flex-col gap-1 border-b border-fl-line pb-3.5 pt-2">
                <span className="text-xs text-fl-muted">{y.year}年・{y.label}</span>
                <span className={`text-[15px] leading-normal ${on ? 'font-bold' : 'font-medium'}`}>{y.title}</span>
              </span>
            </button>
          )
        })}
      </section>

      <section className="px-5">
        <LinkButton to="/couple/new" variant="secondary">別の人との年表を見る（相手を変える）</LinkButton>
        <p className="mx-1 mt-2.5 text-xs leading-[1.7] text-fl-muted">相手は1人ずつ登録できます。何度でも無料で入れ替えられます。{partner.name}について作ったブックは、入れ替えても本棚に残ります。</p>
      </section>

      <Footer />
    </Page>
  )
}
