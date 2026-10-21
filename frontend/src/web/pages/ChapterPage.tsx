import { Link, Navigate, useParams } from 'react-router-dom'
import { IconChevron } from '../components/icons'
import { BackHeader, Disclaimer, LinkButton, NatureImage, Page } from '../components/ui'
import { chapterSections, savedKey } from '../data/mock'
import { remoteMode } from '../data/paymentConfig'
import { ReadingStatus } from '../components/ReadingStatus'
import { useApp } from '../state/AppState'
import { SaveReadingButton } from '../components/SaveReadingButton'

export function ChapterPage() {
  const { id } = useParams()
  const { chapters, readingsStatus } = useApp()
  const chapterList = chapters
  if (remoteMode && readingsStatus !== 'ready') return <ReadingStatus loading={readingsStatus === 'loading'} />
  const chapter = chapterList.find(c => c.id === id)
  if (!chapter) return remoteMode ? <ReadingStatus empty /> : <Navigate to="/you" replace />
  const key = savedKey.chapter(chapter.id)
  const sections = chapter.sections?.length ? chapter.sections : remoteMode ? [] : chapterSections[chapter.id] ?? []
  const index = chapterList.indexOf(chapter)
  const next = chapterList[index + 1]

  return (
    <Page>
      <BackHeader to="/you" title="性格の章" sticky right={
        <SaveReadingButton readingKey={key} compact />
      } />
      <NatureImage src={chapter.image} className="h-[170px]" />
      <section className="fl-reading-title flex flex-col gap-3 px-6 pb-2 pt-7">
        <span className="text-xs font-medium tracking-[0.15em] text-fl-moss">性格の章 ・ {index + 1} / {chapterList.length}</span>
        <p className="m-0 text-sm font-medium text-fl-moss">{chapter.sub}</p>
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{chapter.title}</h1>
      </section>
      <article className="fl-reading-body flex flex-col gap-6 px-6 pb-2 pt-4">
        {sections.map(s => (
          <div key={s.heading} className="flex flex-col gap-2.5">
            <h2 className="m-0 text-[17px] font-medium">{s.heading}</h2>
            <p className="m-0 text-[15px] leading-[1.95] text-fl-body">{s.body}</p>
          </div>
        ))}
      </article>
      <section className="flex flex-col gap-2.5 px-6 pt-6">
        <LinkButton to={`/compose?source=chapter-${chapter.id}`}>この章について相談する</LinkButton>
        <nav aria-label="章の移動" className="pt-5">
          {next ? <Link to={`/you/chapters/${next.id}`} className="fl-next-chapter"><span><small>次の章　{String(index + 2).padStart(2, '0')} / {chapterList.length} · {next.sub}</small><strong>{next.title}</strong></span><IconChevron size={20} /></Link>
            : <Link to="/you#personality-chapters" className="fl-next-chapter"><span><small>性格の章を読み終えました</small><strong>目次へ戻る</strong></span><IconChevron size={20} /></Link>}
        </nav>
      </section>
      <section className="px-6 pb-12 pt-5"><Disclaimer>暦の計算に基づく読みものです。</Disclaimer></section>
    </Page>
  )
}
