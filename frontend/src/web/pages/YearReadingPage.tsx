import { Link, Navigate, useParams } from 'react-router-dom'
import { IconBookmark } from '../components/icons'
import { BackHeader, Disclaimer, LinkButton, NatureImage, Page } from '../components/ui'
import { images } from '../data/images'
import { mockYears, savedKey } from '../data/mock'
import { useApp } from '../state/AppState'

export function YearReadingPage() {
  const { year } = useParams()
  const { savedIds, toggleSaved, years } = useApp()
  const yearList = years.length ? years : mockYears
  const index = yearList.findIndex(y => String(y.year) === year)
  if (index < 0) return <Navigate to="/you" replace />
  const reading = yearList[index]
  const prev = yearList[index - 1]
  const next = yearList[index + 1]
  const key = savedKey.year(reading.year)
  const saved = savedIds.includes(key)
  const sections = reading.sections.length ? reading.sections : [{ heading: 'この年の流れ', body: reading.summary }]

  return (
    <Page>
      <BackHeader to="/you" title={`${reading.year}年のあなた`} sticky right={
        <button type="button" onClick={() => toggleSaved(key)} aria-pressed={saved}
          aria-label={saved ? '保存を取り消す' : '本棚に保存する'} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-fl-surface">
          <IconBookmark filled={saved} />
        </button>
      } />
      <NatureImage src={images.nature.seaLight} className="h-[170px]" />

      <section className="flex flex-col gap-3 px-6 pb-2 pt-7">
        <span className="text-xs font-medium tracking-[0.15em] text-fl-moss">年ごとの流れ{reading.label ? ` ・ ${reading.label}` : ''}</span>
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{reading.title}</h1>
        <div className="flex flex-wrap gap-2">
          {reading.tags.map(tag => <span key={tag} className="rounded-full bg-fl-surface px-3 py-1.5 text-xs text-fl-body">#{tag}</span>)}
        </div>
      </section>

      <article className="flex flex-col gap-6 px-6 pb-2 pt-4">
        {sections.map(s => (
          <div key={s.heading} className="flex flex-col gap-2.5">
            <h2 className="m-0 text-[17px] font-medium">{s.heading}</h2>
            <p className="m-0 text-[15px] leading-[1.95] text-fl-body">{s.body}</p>
          </div>
        ))}
      </article>

      <section className="flex flex-col gap-2.5 px-6 pt-6">
        <LinkButton to={`/compose?source=you-${reading.year}`}>この年について相談する</LinkButton>
      </section>

      <nav aria-label="ほかの年" className="grid grid-cols-2 gap-3 px-6 pb-2 pt-7">
        {prev ? (
          <Link to={`/you/years/${prev.year}`} className="flex flex-col gap-1 rounded-[14px] border border-fl-line bg-white p-3.5">
            <span className="text-xs text-fl-muted">← {prev.year}年</span><span className="text-sm font-medium">{prev.title}</span>
          </Link>
        ) : <span />}
        {next && (
          <Link to={`/you/years/${next.year}`} className="flex flex-col gap-1 rounded-[14px] border border-fl-line bg-white p-3.5 text-right">
            <span className="text-xs text-fl-muted">{next.year}年 →</span><span className="text-sm font-medium">{next.title}</span>
          </Link>
        )}
      </nav>

      <section className="px-6 pb-12 pt-5"><Disclaimer>暦の計算に基づく読みものです。出来事や結果を約束するものではありません。{!years.length && '文章はサンプルです。'}</Disclaimer></section>
    </Page>
  )
}
