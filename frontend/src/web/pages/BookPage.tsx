import { Link, Navigate, useParams } from 'react-router-dom'
import { IconChevron } from '../components/icons'
import { BackHeader, Disclaimer, LinkButton, NatureImage, Page } from '../components/ui'
import { useApp } from '../state/AppState'
import { useState } from 'react'
import { formatBookDate } from '../data/bookDate'

const sizes = ['text-[15px]', 'text-base', 'text-lg'] as const

/** 本番：GET /api/books/:id（state が delivered のときだけ document を返す） */
export function BookPage() {
  const { bookId } = useParams()
  const { books, partners } = useApp()
  const [size, setSize] = useState(1)
  const book = books.find(b => b.id === bookId)
  if (!book || book.state !== 'delivered') return <Navigate to="/books" replace />
  // 相手を入れ替えたあとは、前の相手の年表はもう開けない（ブックの中身は作成時のまま残る）
  const sourcePartner = book.sourceHref.match(/^\/couple\/([^?]+)/)?.[1]
  const sourceAvailable = Boolean(book.sourceHref) && (!sourcePartner || partners.some(p => p.id === sourcePartner))
  const document = book.document

  return (
    <Page>
      <BackHeader to="/books" title={book.title} sticky right={
        <button type="button" onClick={() => setSize(s => (s + 1) % sizes.length)} aria-label={`文字の大きさを変える（いまは${['小', '中', '大'][size]}）`}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[15px] font-medium hover:bg-fl-surface">Aa</button>
      } />
      <NatureImage src={book.cover} alt="ブックの表紙の写真" className="h-[220px]" position="center 25%" />
      <section className="flex flex-col gap-3.5 bg-fl-cream px-6 py-7">
        <span className="text-[11px] font-medium tracking-[0.25em] text-fl-rose">相談のブック ・ {book.theme}</span>
        <h1 className="m-0 font-book text-[26px] font-semibold leading-relaxed">{book.title}</h1>
        <span className="text-xs text-fl-body">{formatBookDate(book.deliveredAt ?? book.createdAt, true)}にお届け</span>
      </section>

      <section className="px-6 pb-2 pt-7">
        <div className="flex flex-col gap-2 rounded-2xl border border-fl-line bg-white p-[18px]">
          <span className="text-xs font-medium text-fl-muted">あなたの相談</span>
          <p className="m-0 text-sm leading-[1.85] text-fl-body">{book.question}</p>
        </div>
      </section>

      <article className="flex flex-col gap-[22px] px-6 pb-2 pt-5 font-book">
        {document?.summary && <p className="m-0 rounded-2xl bg-fl-surface px-4 py-4 leading-[2.05]">{document.summary}</p>}
        {document?.answer && <div className="flex flex-col gap-3"><h2 className="m-0 text-[19px] font-semibold leading-relaxed">答え</h2><p className={`m-0 leading-[2.05] ${sizes[size]}`}>{document.answer}</p></div>}
        {book.sections.map(s => (
          <div key={s.heading} className="flex flex-col gap-3">
            <h2 className="m-0 text-[19px] font-semibold leading-relaxed">{s.heading}</h2>
            <p className={`m-0 leading-[2.05] ${sizes[size]}`}>{s.body}</p>
          </div>
        ))}
        {document?.conclusion && <div className="flex flex-col gap-3"><h2 className="m-0 text-[19px] font-semibold leading-relaxed">まとめ</h2><p className={`m-0 leading-[2.05] ${sizes[size]}`}>{document.conclusion}</p></div>}
        {document?.highlights && document.highlights.length > 0 && <div className="rounded-2xl bg-fl-cream px-4 py-4"><h2 className="m-0 text-[17px] font-semibold">大切なポイント</h2><ul className="mb-0 mt-2 list-disc pl-5 leading-[1.9]">{document.highlights.map(item => <li key={item}>{item}</li>)}</ul></div>}
        {document?.actions && document.actions.length > 0 && <div className="flex flex-col gap-2"><h2 className="m-0 text-[19px] font-semibold">できること</h2><ul className="m-0 list-disc pl-5 leading-[1.9]">{document.actions.map(item => <li key={item}>{item}</li>)}</ul></div>}
      </article>

      <section className="flex flex-col gap-2.5 px-6 pb-2 pt-7">
        <span className="text-[13px] font-medium text-fl-body">このブックのもとになった読みもの</span>
        {sourceAvailable ? (
          <Link to={book.sourceHref} className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-fl-line bg-white px-4">
            <span className="flex flex-1 flex-col gap-0.5"><span className="text-sm font-medium">{book.sourceTitle}</span><span className="text-xs text-fl-muted">{book.sourceSub}</span></span>
            <IconChevron size={16} className="text-fl-muted" />
          </Link>
        ) : (
          <div className="flex min-h-[60px] flex-col justify-center gap-0.5 rounded-2xl border border-fl-line bg-fl-surface px-4 py-2.5">
            <span className="text-sm font-medium">{book.sourceTitle}</span>
            <span className="text-xs text-fl-muted">{sourcePartner ? '入れ替える前の相手の年表です（このブックの内容はそのまま読めます）' : '元の読みものを現在確認できません（このブックの内容はそのまま読めます）'}</span>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 px-6 pb-14 pt-6">
        <Disclaimer>このブックは、暦の計算に基づく読みものと、いただいた相談文をもとにAIが作成しました。出来事や結果を約束するものではありません。</Disclaimer>
        {book.questionsLeft > 0
          ? <LinkButton to={`/books/${book.id}/ask`}>このブックについて質問する（あと{book.questionsLeft}回）</LinkButton>
          : <span className="text-center text-xs text-fl-muted">このブックへの質問は使い切りました</span>}
        <LinkButton to="/compose" variant="secondary">別の相談を書く</LinkButton>
      </section>
    </Page>
  )
}
