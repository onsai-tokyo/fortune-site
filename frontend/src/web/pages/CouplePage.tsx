import { MeetingYearSelect } from '../components/MeetingYearSelect'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader'
import { Button, CoconalaBanner, Footer, LinkButton, NatureImage, Page, SectionHeading } from '../components/ui'
import { images } from '../data/images'
import { remoteMode } from '../data/paymentConfig'
import { ReadingStatus } from '../components/ReadingStatus'
import { CoupleBirthForm } from './CoupleBirthForm'
import { coupleTags } from '../data/coupleTags'
import { coupleLandingHtml, coupleResultConsultation } from '../data/coupleLandingCopy.js'
import { personalReadings } from '../data/readingData'
import { apiFetch } from '../data/api'
import { supabase } from '../../lib/supabase'
import type { Chapter, Partner } from '../data/types'
import { readingFocusPages, readingFocusLandingHtml, type CoupleFocus } from '../data/readingFocus.js'
import { focusChapters, focusCoupleYears } from '../data/focusResults'

function PartnerChapterList({ chapters }: { chapters: Chapter[] }) {
  return <>{chapters.map((c, i) => <details key={c.id} className="border-b border-fl-line py-5"><summary className="cursor-pointer text-base leading-relaxed"><span className="mr-3 text-xs text-fl-moss">{String(i + 1).padStart(2, '0')}</span>{c.sub || c.title}</summary><h2 className="my-4 text-lg font-medium leading-relaxed">{c.title}</h2>{c.sections?.map(s => <p key={s.heading} className="text-sm leading-loose">{s.body}</p>)}</details>)}</>
}

function PartnerAbout({ partner, standalone }: { partner: Partner; standalone?: Chapter[] }) {
  const { selfSourceId, chapters: demoChapters, session, guestPartnerChapters } = useApp()
  const [chapters, setChapters] = useState<Chapter[]>(standalone ?? (remoteMode ? guestPartnerChapters ?? [] : demoChapters))
  const [status, setStatus] = useState(!standalone && remoteMode && session !== 'none' ? 'loading' : 'ready')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (standalone || !remoteMode || session === 'none') return
    let active = true
    setStatus('loading'); setChapters([])
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !selfSourceId) throw new Error('SOURCE_MISSING')
      const raw = await apiFetch<{ cards: Parameters<typeof personalReadings>[1] }>(`/api/reading/${selfSourceId}/partners/${partner.id}/about`, { accessToken: session.access_token })
      const result = personalReadings([], raw.cards, '', images.nature.pampas).chapters
      if (!result.length) throw new Error('READING_MISSING')
      if (active) { setChapters(result); setStatus('ready') }
    })().catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [selfSourceId, partner.id, attempt, session, standalone])
  return <Page><SiteHeader current="couple" /><section className="fl-page-title px-6 py-8">
    <Link to={`/couple/${partner.id}`} className="text-sm text-fl-moss">‹ ふたりの年表へ</Link>
    <h1 className="my-5 text-2xl">{partner.name}について</h1>
    <p className="text-sm text-fl-muted">{partner.birthDate.replace(/-/g, '/')}生まれ{partner.birthTime ? ` · ${partner.birthTime}` : ''}</p>
    {status === 'loading' && <p role="status">相手の鑑定を読み込んでいます…</p>}
    {status === 'error' && <div role="alert"><p>相手の鑑定を読み込めませんでした。</p><button className="min-h-[44px] underline" onClick={() => setAttempt(n => n + 1)}>再読み込み</button></div>}
    <PartnerChapterList chapters={chapters} />
  </section><Footer /></Page>
}

function MeetingYearForm({ partnerId }: { partnerId: string }) {
  const { saveMeetingYear, standaloneCouple, readStandaloneCouple } = useApp()
  const [year, setYear] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  return <Page><SiteHeader current="couple" /><section className="space-y-4 px-6 py-8"><h1>ふたりの年表</h1><p>出会った年を入力すると、実際のふたりの年表を表示できます。</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { if (standaloneCouple?.partner.id === partnerId) await readStandaloneCouple(standaloneCouple.self, { ...standaloneCouple.partner, metYear: Number(year) }, partnerId); else await saveMeetingYear(partnerId, Number(year)) } catch { setError('保存できませんでした。もう一度お試しください。') } finally { setBusy(false) } }}><MeetingYearSelect id="saved-meeting-year" value={year} onChange={setYear} /><button disabled={busy} className="mt-4 border p-3">保存して年表を読む</button></form>{error && <p role="alert">{error}</p>}</section></Page>
}
import { useApp } from '../state/AppState'
import { useCenterCurrent } from '../components/useCenterCurrent'

export function CoupleIndexPage({ focus, onComplete }: { focus?: CoupleFocus; onComplete?: (partner: Partner, breakupYear?: number) => void } = {}) {
  const { partners } = useApp()
  return (
    <Page>
      <SiteHeader current="couple" />
      <section className="fl-hero flex flex-col gap-5 px-6 pb-5 pt-10">
        <span className="text-xs tracking-[.12em] text-fl-moss">{focus ? '生年月日から読む、ふたりの関わり' : 'ふたりの年表'}</span>
        <h1 className="m-0 text-[28px] leading-[1.65]">{focus ? readingFocusPages[focus].heading : <>出会いから、いま。<br />ふたりの歩みを読む。</>}</h1>
        <p className="m-0 text-sm leading-[1.95] text-fl-body">{focus ? readingFocusPages[focus].intro : '近づく年も、それぞれの毎日を大切にする年も。ふたりの生年月日と出会った年から、関係の流れを一年ずつ読み解きます。'}</p>
        <NatureImage src={images.dunes} className="h-[180px] rounded-card" />
      </section>
      <CoupleBirthForm focus={focus} onComplete={onComplete} />
      {!focus && partners.length > 0 && <section className="px-6 pt-4">
        <h2 className="text-base">以前の相手との年表</h2>
        {partners.map(partner => <Link key={partner.id} to={`/couple/${partner.id}`} className="block py-2 underline">{partner.name}との年表を読む</Link>)}
      </section>}
      {!focus && <section className="flex flex-col gap-1 px-5 pt-8">
        <h2 className="mb-2 mt-0 text-base font-medium">ふたりの年表でできること</h2>
        {['出会った年から、一年ごとのふたりの読みものを読む', '同じ年の、あなたと相手それぞれの流れを知る'].map((t, i) => (
          <div key={t} className="flex gap-3.5 border-b border-fl-line py-3.5">
            <span className="w-[22px] text-[13px] text-fl-muted">0{i + 1}</span>
            <span className="text-sm leading-[1.8] text-fl-body">{t}</span>
          </div>
        ))}
      </section>}
      <section className="fl-landing-section flex flex-col gap-4 px-6 py-10" dangerouslySetInnerHTML={{ __html: focus ? readingFocusLandingHtml(focus) : coupleLandingHtml() }} />
      <Footer />
    </Page>
  )
}

export function CouplePage({ focus, partnerId: focusedPartnerId, breakupYear, onReadAgain }: { focus?: CoupleFocus; partnerId?: string; breakupYear?: number; onReadAgain?: () => void } = {}) {
  const paramsFromRoute = useParams()
  const partnerId = focusedPartnerId ?? paramsFromRoute.partnerId
  const [params, setParams] = useSearchParams()
  const [focusedYear, setFocusedYear] = useState(new Date().getFullYear())
  const expandedYear = focus ? focusedYear : Number(params.get('year'))
  const scrollToYear = useRef(false)
  const expandedRow = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!scrollToYear.current) return
    scrollToYear.current = false
    expandedRow.current?.scrollIntoView({ block: 'start' })
  }, [expandedYear])
  const { partners, coupleYears, coupleStatus, readingsStatus, standaloneCouple } = useApp()
  const tabsRef = useCenterCurrent<HTMLDivElement>(`${partnerId}-${focus ? focusedYear : params.get('year')}`)
  const standalone = standaloneCouple?.partner.id === partnerId ? standaloneCouple : undefined
  const partner = standalone?.partner ?? partners.find(p => p.id === partnerId)
  if (!standalone && remoteMode && readingsStatus === 'loading') return <ReadingStatus loading={readingsStatus === 'loading'} />
  if (!partner) return <Navigate to="/couple" replace />
  if (!focus && params.get('view') === 'about') return <PartnerAbout key={`${partner.id}-${partner.birthDate}-${partner.birthTime}`} partner={partner} standalone={standalone?.chapters} />

  const sourceYears = (standalone?.years ?? coupleYears[partner.id] ?? []).filter(y => !partner.metYear || y.year >= partner.metYear)
  const years = focus ? focusCoupleYears(sourceYears, focus, new Date().getFullYear(), breakupYear) : sourceYears
  const status = standalone?.status ?? coupleStatus[partner.id]
  if ((standalone || remoteMode) && status === 'needs_meeting_year') return <MeetingYearForm partnerId={partner.id} />
  if ((standalone || remoteMode) && status !== 'ready') return <ReadingStatus loading={status === 'loading'} />
  if (!years.length) return <ReadingStatus empty />
  const pick = (year: number, fromShortcut = false) => {
    if (fromShortcut && year === expandedYear) {
      expandedRow.current?.scrollIntoView({ block: 'start' })
      return
    }
    scrollToYear.current = year !== 0
    if (focus) setFocusedYear(year)
    else setParams(year ? { year: String(year) } : {}, { replace: true })
  }

  return (
    <Page>
      <SiteHeader current="couple" />

      <section className="fl-page-title flex flex-col gap-3.5 px-5 pb-2 pt-6">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{focus ? readingFocusPages[focus].resultHeading : 'ふたりの年表'}</h1>
      </section>

      <nav className="fl-year-navigation" aria-label="相手の鑑定">{focus ? <a href="#focus-partner">お相手の関わり方　›</a> : <Link to={`/couple/${partner.id}?view=about`}>{partner.name}について　›</Link>}</nav>
      {focus && standalone && <section id="focus-partner" className="px-6 py-8">
        <h2 className="my-4 text-lg font-medium leading-relaxed">{readingFocusPages[focus].chapterHeading}</h2>
        <p className="text-sm text-fl-muted">以下の鑑定文の「あなた」は、お相手を指します。相手自身の傾向で、あなたへの特定の感情や、復縁・交際の可否を決めるものではありません。</p>
        <PartnerChapterList chapters={focusChapters(standalone.chapters, focus, partner.relation)} />
      </section>}

      <section className="pt-3">
        <div ref={tabsRef} role="group" aria-label="年を選ぶ" className="fl-couple-year-tabs relative flex gap-2 overflow-x-auto px-5 pb-3 pt-1">
          {years.map(y => (
            <button key={y.year} type="button" aria-pressed={y.year === expandedYear} data-current={y.year === expandedYear} onClick={() => pick(y.year, true)}
              className={`flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-sm ${y.year === expandedYear ? 'bg-fl-ink font-medium text-white' : 'border border-fl-line bg-white text-fl-body'}`}>{y.year}</button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 px-5 pb-6 pt-8">
        <SectionHeading>ふたりの年表</SectionHeading>
        {years.map(y => {
          const on = y.year === expandedYear
          const tags = coupleTags(y)
          return (
            <article key={y.year} ref={on ? expandedRow : undefined} className="fl-timeline-card scroll-mt-24 rounded-2xl border border-fl-line bg-white">
              <div className="fl-timeline-summary">
                <p className="m-0 text-sm font-medium tabular-nums text-fl-moss">{y.year}年{focus === 'fukuen' && y.year === breakupYear ? '・別れた年（入力）' : y.label && `・${y.label}`}</p>
                <h3 className="m-0 text-lg font-semibold leading-relaxed">{y.title}</h3>
                {tags.length > 0 && <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">{tags.map(tag => <li key={tag} className="rounded-full bg-fl-cream px-2.5 py-1 text-[11px] text-fl-moss">{tag}</li>)}</ul>}
                {!on && y.body[0] && <p className="fl-timeline-preview">{y.body[0]}</p>}
                <button type="button" aria-expanded={on} aria-controls={`couple-year-${y.year}`}
                  onClick={() => pick(on ? 0 : y.year)}
                  className="fl-timeline-choice"
                  aria-label={`${y.year}年の鑑定：${on ? '閉じる' : '全文を読む'}`}>
                  {on ? '閉じる' : '全文を読む'} <span aria-hidden="true">{on ? '−' : '＋'}</span>
                </button>
              </div>
              <div id={`couple-year-${y.year}`} hidden={!on} className="border-t border-fl-line px-4 py-5">
                {on && <div className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-3.5 rounded-xl border border-fl-line bg-white p-5">
                    <NatureImage src={images.starMountains} className="aspect-[1.85] w-full rounded-xl" position="center 55%" />
                    <p className="m-0 text-xs font-medium tracking-[0.15em] text-fl-slate">{y.year}年のふたり</p>
                    <h4 className="m-0 text-[21px] font-medium leading-relaxed">{y.title}</h4>
                    {y.body.map((paragraph, i) => <p key={i} className="m-0 text-[15px] leading-[1.9] text-fl-body">{paragraph}</p>)}
                    {(y.you || y.partner) && <div className="flex flex-wrap gap-2 pt-1">
                      {y.you && <span className="rounded-full bg-fl-surface px-3 py-1.5 text-xs text-fl-body">あなた：{y.you}</span>}
                      {y.partner && <span className="rounded-full bg-fl-surface px-3 py-1.5 text-xs text-fl-body">{partner.name}：{y.partner}</span>}
                    </div>}
                  </div>
                  {!standalone && !remoteMode && <p className="m-0 text-xs text-fl-muted">文章はサンプルです。</p>}
                </div>}
              </div>
            </article>
          )
        })}
      </section>
      <p className="mx-6 text-xs leading-relaxed text-fl-muted">タグは読みものの内容を整理する目印です。出来事や結果を約束するものではありません。</p>

      <section className="px-5">
        {!focus && partners.length > 1 && <LinkButton to="/couple" variant="secondary">登録済みの別の相手を選ぶ</LinkButton>}
        {focus ? <><Button variant="secondary" onClick={onReadAgain}>入力し直して、もう一度占う</Button><LinkButton to={readingFocusPages[focus].guide} variant="secondary" reloadDocument>詳しい見方を読む</LinkButton></> : <LinkButton to={standalone ? "/couple" : `/couple/new?replace=${partner.id}`} variant="secondary">別の人との年表を見る（相手を変える）</LinkButton>}
        {!standalone && <p className="mx-1 mt-2.5 text-xs leading-[1.7] text-fl-muted">{partners.length > 1 ? '選んだ相手だけを入れ替えます。他の相手は削除しません。' : '相手は1人ずつ登録できます。何度でも無料で入れ替えられます。'}</p>}
      </section>

      <p className="mx-6 text-xs leading-relaxed text-fl-muted">{coupleResultConsultation}</p>
      <CoconalaBanner position="couple_result" className="px-5 pt-6" />
      <Footer />
    </Page>
  )
}
