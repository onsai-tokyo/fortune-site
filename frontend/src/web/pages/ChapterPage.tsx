import { Navigate, useParams } from 'react-router-dom'
import { IconBookmark } from '../components/icons'
import { BackHeader, Disclaimer, LinkButton, NatureImage, Page } from '../components/ui'
import { chapterSections, savedKey } from '../data/mock'
import { remoteMode } from '../data/paymentConfig'
import { ReadingStatus } from '../components/ReadingStatus'
import { useApp } from '../state/AppState'

export function ChapterPage() {
  const { id } = useParams()
  const { savedIds, toggleSaved, chapters, readingsStatus } = useApp()
  const chapterList = chapters
  if (remoteMode && readingsStatus !== 'ready') return <ReadingStatus loading={readingsStatus === 'loading'} />
  const chapter = chapterList.find(c => c.id === id)
  if (!chapter) return remoteMode ? <ReadingStatus empty /> : <Navigate to="/you" replace />
  const key = savedKey.chapter(chapter.id)
  const saved = savedIds.includes(key)
  const sections = chapter.sections?.length ? chapter.sections : remoteMode ? [] : chapterSections[chapter.id] ?? []
  const index = chapterList.indexOf(chapter)
  const next = chapterList[index + 1]

  return (
    <Page>
      <BackHeader to="/you" title="性格の章" sticky right={
        <button type="button" onClick={() => toggleSaved(key)} aria-pressed={saved}
          aria-label={saved ? '保存を取り消す' : '本棚に保存する'} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-fl-surface">
          <IconBookmark filled={saved} />
        </button>
      } />
      <NatureImage src={chapter.image} className="h-[170px]" />
      <section className="flex flex-col gap-3 px-6 pb-2 pt-7">
        <span className="text-xs font-medium tracking-[0.15em] text-fl-moss">性格の章 ・ {index + 1} / {chapterList.length}</span>
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{chapter.title}</h1>
        <p className="m-0 text-sm text-fl-muted">{chapter.sub}</p>
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
        <LinkButton to={`/compose?source=chapter-${chapter.id}`}>この章について相談する</LinkButton>
        {next && <LinkButton to={`/you/chapters/${next.id}`} variant="secondary">次の章：{next.title}</LinkButton>}
      </section>
      <section className="px-6 pb-12 pt-5"><Disclaimer>暦の計算に基づく読みものです。</Disclaimer></section>
    </Page>
  )
}
