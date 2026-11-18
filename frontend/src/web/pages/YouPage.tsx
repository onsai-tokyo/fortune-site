import { useEffect, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { Button, CoconalaBanner, Card, Eyebrow, Footer, LinkButton, NatureImage, Page, SectionHeading } from '../components/ui'
import { IconChevron } from '../components/icons'
import { chapterSections } from '../data/mock'
import { images } from '../data/images'
import { remoteMode } from '../data/paymentConfig'
import { ReadingStatus } from '../components/ReadingStatus'
import { useApp } from '../state/AppState'
import { useCenterCurrent } from '../components/useCenterCurrent'
import { recordGuideReadingResult } from '../data/guideReadingMeasurement.js'
import { readingFocusPages } from '../data/readingFocus.js'
import type { BirthProfile, Chapter, YearReading } from '../data/types'

export type PersonalFocusReading = { profile: BirthProfile; years: YearReading[]; chapters: Chapter[]; personaTitle: string }

function formatBirth(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return `${y}年${m}月${d}日生まれ`
}

export function YouPage({ reading, onSelectYear, onReadAgain }: { reading?: PersonalFocusReading; onSelectYear?: (year: number) => void; onReadAgain?: () => void } = {}) {
  const app = useApp()
  const { profile, partners, years, chapters, personaTitle, readingsStatus, reloadReadings } = reading ? { ...app, ...reading, partners: [], readingsStatus: 'ready' as const } : app
  const focused = Boolean(reading)
  const yearHref = (year: number) => focused ? `/uranai/konki#year-${year}` : `/you/years/${year}`
  const openYear = (event: MouseEvent, year: number) => { if (focused && onSelectYear) { event.preventDefault(); onSelectYear(year) } }
  const { state } = useLocation()
  const yearList = [...years].sort((a, b) => a.year - b.year)
  const chapterList = chapters
  const current = yearList.find(y => y.label === '今年') ?? yearList[0]
  const hasYears = yearList.length > 0
  const partner = partners[0]
  const futureYears = yearList.filter(y => y.year > new Date().getFullYear()).sort((a, b) => a.year - b.year)
  const stripRef = useCenterCurrent<HTMLDivElement>(current?.year)
  const hasResult = (!remoteMode || readingsStatus === 'ready') && Boolean(current || chapterList.length)
  useEffect(() => {
    if (hasResult && !focused) recordGuideReadingResult(state?.guideReadingStartedAt)
  }, [hasResult, state, focused])
  if (remoteMode && readingsStatus !== 'ready') return <ReadingStatus loading={readingsStatus === 'loading'} />
  if (!current && !chapterList.length) return <ReadingStatus empty />
  return (
    <Page>
      <SiteHeader current="you" />

      <section className="fl-page-title flex flex-col gap-2.5 px-5 pb-2 pt-7">
        <Eyebrow>あなたの読みもの</Eyebrow>
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{focused ? readingFocusPages.konki.resultHeading : personaTitle || 'あなたの読みもの'}</h1>
        {profile && <p className="fl-profile-meta m-0 text-sm text-fl-body">{formatBirth(profile.birthDate)}{profile.birthTime ? `・${profile.birthTime}・${profile.birthPlace}` : ''}</p>}
        <p className="m-0 text-sm leading-[1.85] text-fl-body">{focused ? '候補は計算上の目印です。結婚の可否や期限を決めず、各年の根拠と現実の状況を合わせて確認してください。' : '生年月日から、あなたの性格と一年ずつの流れを読み解きます。'}</p>
      </section>

      {!focused && <nav className="fl-reading-contents" aria-labelledby="contents-title">
        <div className="fl-contents-heading">
          <h2 id="contents-title">目次</h2>
          <span>{profile?.nickname ? `${profile.nickname}さんの読みもの` : 'あなたの読みもの'}</span>
        </div>
        <a href="#personality-chapters"><span>01</span><strong>性格の章</strong><small>{chapterList.length}の視点</small><IconChevron size={14} /></a>
        <a href="#personal-years"><span>02</span><strong>年ごとの流れ</strong><small>{hasYears ? `${yearList[0].year} — ${yearList[yearList.length - 1].year}` : '対象年なし'}</small><IconChevron size={14} /></a>
        {partner && <Link to={`/couple/${partner.id}?view=about`}><span>03</span><strong>相手について</strong><small>{partner.name}</small><IconChevron size={14} /></Link>}
        <Link to={partner ? `/couple/${partner.id}` : '/couple'}><span>{partner ? '04' : '03'}</span><strong>ふたりの年表</strong><small>{partner ? partner.name : '相手を登録する'}</small><IconChevron size={14} /></Link>
      </nav>}

      {!focused && <section id="personality-chapters" className="fl-chapters flex flex-col px-5 pb-2 pt-6">
        <SectionHeading detail={`${chapterList.length}の視点`}>性格の章</SectionHeading>
        {chapterList.map((ch, index) => (
          <Link key={ch.id} to={`/you/chapters/${ch.id}`} className="fl-chapter-row group flex items-center gap-4 border-b border-fl-line py-5">
            <span aria-hidden="true" className="fl-chapter-number self-start pt-1 text-lg text-fl-moss">{String(index + 1).padStart(2, '0')}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-xs font-medium tracking-[.08em] text-fl-moss">{ch.sub}</span>
              <span className="fl-chapter-title text-[15px] font-medium leading-[1.85] group-hover:underline">{ch.title}</span>
              {(ch.sections?.[0]?.body || (!remoteMode && chapterSections[ch.id]?.[0]?.body)) && <span className="fl-chapter-preview text-[13px] leading-[1.85] text-fl-body">{(ch.sections?.[0]?.body || chapterSections[ch.id]?.[0]?.body || '').slice(0, 88)}…</span>}
            </span>
            <IconChevron size={16} className="shrink-0 text-fl-muted" />
          </Link>
        ))}
      </section>}

      <section id="personal-years" className="fl-year-section pb-2 pt-5">
        <SectionHeading detail="過去から、これからへ">年ごとの流れ</SectionHeading>
        {current ? <>
          <nav className="fl-year-navigation" aria-label="これからの年を読む">
            <Link to={yearHref(current.year)} onClick={e => openYear(e,current.year)}>{current.label === '今年' && '今年 · '}{current.year}年</Link>
            {futureYears.filter(y => y.year !== current.year).slice(0, 3).map(y => <Link key={y.year} to={yearHref(y.year)} onClick={e => openYear(e,y.year)}>{y.year === new Date().getFullYear() + 1 ? '来年 · ' : ''}{y.year}年 <IconChevron size={12} /></Link>)}
          </nav>
          {!futureYears.length && <p className="mx-6 mb-4 text-xs leading-relaxed text-fl-muted">来年以降の鑑定は現在取得できていません。<button type="button" onClick={() => void reloadReadings()} className="ml-1 underline">再読み込み</button></p>}
          <div ref={stripRef} className="fl-year-strip relative flex gap-2.5 overflow-x-auto px-5 pb-2">
            {yearList.map(y => {
              const on = y.year === current.year
              return (
                <Link key={y.year} to={yearHref(y.year)} onClick={e => openYear(e,y.year)} aria-current={on ? 'true' : undefined} data-current={on}
                  className={`flex min-h-[108px] w-[132px] shrink-0 flex-col gap-1.5 rounded-2xl p-3.5 ${on ? 'bg-fl-ink text-white' : 'border border-fl-line bg-white'}`}>
                  <span className={`text-xs ${on ? 'text-fl-line' : 'text-fl-muted'}`}>{y.year}{y.label ? `・${y.label}` : ''}</span>
                  <span className="text-sm font-medium leading-normal">{y.title}</span>
                </Link>
              )
            })}
          </div>
        </> : <p className="mx-6 text-sm leading-relaxed text-fl-body">表示できる年ごとの鑑定はありません。</p>}
      </section>

      {current && <section className="px-5 pb-2 pt-5">
        <Card className="fl-year-feature flex flex-col gap-3 p-5">
          <NatureImage src={images.nature.pampas} className="h-[132px] rounded-xl" />
          <div className="fl-feature-meta flex items-center justify-between gap-3">
            <span className="text-xs font-medium tracking-[0.15em] text-fl-moss">{current.year}年のあなた</span>
            <span className="flex items-center gap-2 text-xs text-fl-muted">{current.label}</span>
          </div>
          <h2 className="m-0 text-[19px] font-medium leading-relaxed">{current.title}</h2>
          <p className="m-0 text-sm leading-[1.85] text-fl-body">{current.summary}</p>
          <div className="flex gap-2.5 pt-1">
            <Link to={yearHref(current.year)} onClick={e => openYear(e,current.year)} className="flex min-h-[46px] flex-1 items-center justify-center rounded-[14px] border border-fl-line text-sm font-medium">続きを読む</Link>
          </div>
        </Card>
      </section>}

      {!focused && <section className="px-5 pt-6">
        <Link to="/couple" className="flex items-center gap-3.5 rounded-card bg-fl-cream p-[18px]">
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-[15px] font-medium">相性・相手との年表はこちら</span>
            <span className="text-[13px] text-fl-body">{partner ? 'あなたの年と、ふたりの年を見比べる' : '相手を登録すると、ふたりの関係の流れが読めます'}</span>
          </span>
          <IconChevron size={18} />
        </Link>
      </section>}
      {focused && <section className="px-5 pt-6"><Button variant="secondary" onClick={onReadAgain}>入力し直して、もう一度占う</Button><LinkButton to={readingFocusPages.konki.guide} variant="secondary" reloadDocument>詳しい婚期の見方を読む</LinkButton></section>}

      <CoconalaBanner className="px-5 pt-6" />
      <Footer />
    </Page>
  )
}
