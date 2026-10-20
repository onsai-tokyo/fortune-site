import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { SiteHeader } from '../components/SiteHeader'
import { IconPen } from '../components/icons'
import { Card, Footer, LinkButton, NatureImage, Page } from '../components/ui'
import { images } from '../data/images'
import { relationGroup, savedKey } from '../data/mock'
import { remoteMode } from '../data/paymentConfig'
import { ReadingStatus } from '../components/ReadingStatus'
import { PartnerNewPage } from './PartnerNewPage'
import { SaveReadingButton } from '../components/SaveReadingButton'
import { coupleTags } from '../data/coupleTags'

function MeetingYearForm({ partnerId }: { partnerId: string }) {
  const { saveMeetingYear } = useApp()
  const [year, setYear] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  return <Page><SiteHeader current="couple" /><section className="space-y-4 px-6 py-8"><h1>ふたりの年表</h1><p>出会った年を入力すると、実際のふたりの年表を表示できます。</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await saveMeetingYear(partnerId, Number(year)) } catch { setError('保存できませんでした。もう一度お試しください。') } finally { setBusy(false) } }}><label>出会った年<input type="number" required value={year} onChange={e => setYear(e.target.value)} className="block w-full border p-3" /></label><button disabled={busy} className="mt-4 border p-3">保存して年表を読む</button></form>{error && <p role="alert">{error}</p>}</section></Page>
}
import { useApp } from '../state/AppState'
import { useCenterCurrent } from '../components/useCenterCurrent'

/** /couple：相手がいれば最初の相手へ、いなければ案内 */
export function CoupleIndexPage() {
  const { partners } = useApp()
  if (partners.length) return <Navigate to={`/couple/${partners[0].id}`} replace />
  return (
    <Page>
      <SiteHeader current="couple" />
      <section className="flex flex-col gap-5 px-6 pb-5 pt-10">
        <span className="text-xs tracking-[.2em] text-fl-moss">TWO LIVES, ONE TIMELINE</span>
        <h1 className="m-0 text-[28px] leading-[1.65]">出会いから、いま。<br />ふたりの歩みを読む。</h1>
        <p className="m-0 text-sm leading-[1.95] text-fl-body">近づく年も、それぞれの毎日を大切にする年も。ふたりの生年月日と出会った年から、関係の流れを一年ずつ読み解きます。</p>
        <NatureImage src={images.dunes} className="h-[180px] rounded-card" />
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-fl-moss">{['無料で読める', '恋人・友人・家族も', '何度でも入れ替え'].map(t => <span key={t} className="rounded-field bg-fl-cream px-2 py-3">{t}</span>)}</div>
      </section>
      <PartnerNewPage embedded />
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
  const { partners, setDraft, coupleYears, coupleStatus, readingsStatus } = useApp()
  const tabsRef = useCenterCurrent<HTMLDivElement>(`${partnerId}-${params.get('year')}`)
  const partner = partners.find(p => p.id === partnerId)
  if (remoteMode && readingsStatus !== 'ready') return <ReadingStatus loading={readingsStatus === 'loading'} />
  if (!partner) return <Navigate to="/couple" replace />

  const years = (coupleYears[partner.id] ?? []).filter(y => !partner.metYear || y.year >= partner.metYear)
  if (remoteMode && coupleStatus[partner.id] === 'needs_meeting_year') return <MeetingYearForm partnerId={partner.id} />
  if (remoteMode && coupleStatus[partner.id] !== 'ready') return <ReadingStatus loading={coupleStatus[partner.id] === 'loading'} />
  const pickedYear = Number(params.get('year')) || new Date().getFullYear()
  const current = years.find(y => y.year === pickedYear) ?? years[years.length - 2] ?? years[0]
  if (!current) return <ReadingStatus empty />
  const pick = (year: number) => setParams({ year: String(year) }, { replace: true })

  function startCompose() {
    setDraft({ sourceId: undefined, sourceCardId: current.sourceCardId, sourceTitle: `${partner!.name}との${current.year}年`, sourceSub: current.title, sourceHref: `/couple/${partner!.id}?year=${current.year}`, theme: relationGroup(partner!.relation) === 'romantic' ? '恋愛・関係' : '人間関係' })
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
              <SaveReadingButton readingKey={savedKey.couple(partner.id, current.year)} compact />
            </span>
          </div>
          <h2 className="m-0 text-[21px] font-medium leading-relaxed">{current.title}</h2>
          <div className="flex flex-wrap gap-2">{coupleTags(current).map(tag => <span key={tag} className="rounded-full bg-fl-cream px-3 py-1 text-xs text-fl-moss">{tag}</span>)}</div>
          {current.body.map(p => <p key={p} className="m-0 text-[15px] leading-[1.9] text-fl-body">{p}</p>)}
          {(current.you || current.partner) && <div className="flex flex-wrap gap-2 pt-1">
            <span className="rounded-full bg-fl-surface px-3 py-1.5 text-xs text-fl-body">あなた：{current.you}</span>
            <span className="rounded-full bg-fl-surface px-3 py-1.5 text-xs text-fl-body">{partner.name}：{current.partner}</span>
          </div>}
          <Link to="/compose" onClick={startCompose} className="mt-1.5 flex min-h-[50px] items-center justify-center gap-2 rounded-button bg-fl-ink text-[15px] font-medium text-white">
            <IconPen size={18} />この年について相談する
          </Link>
        </Card>
        {!remoteMode && <p className="mx-1 mt-2.5 text-xs text-fl-muted">文章はサンプルです。</p>}
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
                <span className="flex flex-wrap gap-1.5">{coupleTags(y).map(tag => <span key={tag} className="rounded-full bg-fl-cream px-2.5 py-1 text-[11px] text-fl-moss">{tag}</span>)}</span>
              </span>
            </button>
          )
        })}
      </section>
      <p className="mx-6 text-xs leading-relaxed text-fl-muted">タグは読みものの内容を整理する目印です。出来事や結果を約束するものではありません。</p>

      <section className="px-5">
        <LinkButton to="/couple/new" variant="secondary">別の人との年表を見る（相手を変える）</LinkButton>
        <p className="mx-1 mt-2.5 text-xs leading-[1.7] text-fl-muted">相手は1人ずつ登録できます。何度でも無料で入れ替えられます。{partner.name}について作ったブックは、入れ替えても本棚に残ります。</p>
      </section>

      <Footer />
    </Page>
  )
}
