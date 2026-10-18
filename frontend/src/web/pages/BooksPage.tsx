import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { IconAlert, IconChevron, IconClock } from '../components/icons'
import { Button, Footer, LinkButton, NatureImage, Page } from '../components/ui'
import { savedCatalog } from '../data/mock'
import { images } from '../data/images'
import type { Book } from '../data/types'
import { useApp } from '../state/AppState'
import { useState } from 'react'
import { paymentsAvailable, BOOK_PREPARING } from '../data/paymentConfig'

/** iOS AIBook.isPending と同じ */
const isPending = (b: Book) => b.state === 'queued' || b.state === 'generating' || b.state === 'review'
const stateLabel: Record<string, string> = { queued: '受付済み', generating: '作成中', review: '確認中' }

/** iOS AIBook.failureMessage と同じ文言 */
function failureMessage(code?: string) {
  if (code === 'BOOK_REFUSED' || code === 'BOOK_DOCUMENT_POLICY') return 'このご相談は読みもので扱える範囲を超えていたため、使った1冊分をお戻ししました。相談内容は保存されています。'
  return '作成を完了できなかったため、使った1冊分をお戻ししました。相談内容はそのままで再試行できます。'
}

function formatDate(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日`
}

export function ShelfTabs({ active, bookCount, savedCount }: { active: 'books' | 'saved'; bookCount: number; savedCount: number }) {
  const tab = (on: boolean) => `flex min-h-[44px] items-center justify-center rounded-[11px] text-sm ${on ? 'bg-white font-medium' : 'text-fl-body'}`
  return (
    <nav aria-label="本棚の表示" className="grid grid-cols-2 rounded-[14px] bg-fl-surface p-1">
      <Link to="/books" aria-current={active === 'books' ? 'page' : undefined} className={tab(active === 'books')}>相談のブック {bookCount}冊</Link>
      <Link to="/books/saved" aria-current={active === 'saved' ? 'page' : undefined} className={tab(active === 'saved')}>保存した読みもの {savedCount}件</Link>
    </nav>
  )
}

function GeneratingCard({ book }: { book: Book }) {
  return (
    <div className="flex gap-3.5 rounded-2xl border border-dashed border-fl-muted bg-white p-4" aria-live="polite">
      <span className="flex h-[72px] w-[52px] shrink-0 items-center justify-center rounded-md bg-fl-surface text-fl-muted"><IconClock size={22} /></span>
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium text-fl-slate">{stateLabel[book.state] ?? '作成中'}</span>
        <span className="text-[15px] font-medium leading-normal">{book.title}</span>
        <span className="text-xs leading-[1.6] text-fl-muted">数分でお届けします。画面を閉じても大丈夫です。</span>
        <span role="progressbar" aria-label="作成の進み具合" aria-valuenow={book.progress ?? 0} aria-valuemin={0} aria-valuemax={100} className="block h-1 overflow-hidden rounded bg-fl-surface">
          <span className="block h-1 bg-fl-slate transition-all" style={{ width: `${book.progress ?? 10}%` }} />
        </span>
      </span>
    </div>
  )
}

function FailedCard({ book }: { book: Book }) {
  const { credits, retryBook } = useApp()
  const [retried, setRetried] = useState(false)
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-fl-ochre bg-white p-[18px]">
      <div className="flex items-start gap-3">
        <IconAlert size={22} className="mt-px shrink-0 text-fl-ochre" />
        <span className="flex flex-col gap-1">
          <span className="text-[15px] font-medium">ブックを作成できませんでした</span>
          <span className="text-[13px] text-fl-muted">{book.title} ・ {formatDate(book.createdAt)}</span>
        </span>
      </div>
      <p className="m-0 text-sm leading-[1.85] text-fl-body">{failureMessage(book.failureCode)}（いまの残り {credits}冊）</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Button disabled={retried || credits <= 0} onClick={() => { setRetried(true); retryBook(book.id) }}>もう一度つくる</Button>
        <LinkButton to="/support" variant="secondary">お問い合わせ</LinkButton>
      </div>
      <span className="text-xs leading-[1.7] text-fl-muted">相談文は保存されているので、書き直す必要はありません。</span>
    </div>
  )
}

function BookRow({ book }: { book: Book }) {
  return (
    <Link to={`/books/${book.id}`} className="flex gap-3.5 rounded-2xl border border-fl-line bg-white p-4 hover:bg-fl-surface/40">
      <NatureImage src={book.cover} className="h-[72px] w-[52px] shrink-0 rounded-md" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs text-fl-muted">{formatDate(book.createdAt)}・{book.theme}</span>
        <span className="text-[15px] font-medium leading-normal">{book.title}</span>
        <span className="text-xs text-fl-muted">もとの読みもの：{book.sourceTitle}</span>
      </span>
      <IconChevron size={16} className="self-center text-fl-muted" />
    </Link>
  )
}

/** 本番：GET /api/books（60件ずつ、before カーソル）。作成中は /api/books/operations/:id をポーリング */
export function BooksPage() {
  const { books, savedIds, partners, years, chapters, coupleYears, credits } = useApp()
  const delivered = books.filter(b => b.state === 'delivered')
  const savedCount = savedCatalog(partners, years, chapters, coupleYears).filter(s => savedIds.includes(s.id)).length
  return (
    <Page>
      <SiteHeader current="books" />
      <section className="flex flex-col gap-4 px-5 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">本棚</h1>
        <ShelfTabs active="books" bookCount={delivered.length} savedCount={savedCount} />
      </section>
      <section className="flex flex-col gap-3 px-5 pt-3">
        {books.filter(b => b.state === 'failed').map(b => <FailedCard key={b.id} book={b} />)}
        {books.filter(b => isPending(b)).map(b => <GeneratingCard key={b.id} book={b} />)}
        {delivered.map(b => <BookRow key={b.id} book={b} />)}
        {books.length === 0 && (
          <div className="flex flex-col gap-4 rounded-card border border-fl-line bg-white p-5">
            <NatureImage src={images.nature.tree} className="h-[120px] rounded-xl" />
            <h2 className="m-0 text-lg font-medium leading-relaxed">ここに、あなたへのブックが並びます</h2>
            <p className="m-0 text-sm leading-[1.85] text-fl-body">読みものを一つ選んで相談を書くと、その読みものをもとにした答えが一冊のブックになって届きます。</p>
            <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-[1.8] text-fl-body marker:text-fl-muted">
              <li>約2,500文字。章立てで、ゆっくり読めます</li>
              <li>届いたブックには、2回まで質問できます</li>
              <li>{paymentsAvailable ? '1冊 500円。いつでも本棚で読み返せます' : `${BOOK_PREPARING}（新規購入）`}</li>
            </ul>
            <LinkButton to="/compose">{!paymentsAvailable && credits <= 0 ? '相談の下書きを書く' : '最初の一冊をつくる'}</LinkButton>
          </div>
        )}
      </section>
      {books.length > 0 && <section className="px-5 pt-6"><LinkButton to="/compose" variant="outline">{!paymentsAvailable && credits <= 0 ? '相談の下書きを書く' : '次の一冊をつくる'}</LinkButton></section>}
      <Footer />
    </Page>
  )
}

export function SavedReadingsPage() {
  const { books, savedIds, partners, years, chapters, coupleYears } = useApp()
  const [filter, setFilter] = useState<'all' | 'you' | 'couple'>('all')
  const catalog = savedCatalog(partners, years, chapters, coupleYears)
  // 保存した順（新しいものを上）に並べる
  const saved = [...savedIds].reverse().map(id => catalog.find(c => c.id === id)).filter((s): s is NonNullable<typeof s> => !!s)
  const rows = saved.filter(s => filter === 'all' || s.kind === filter)
  const filters: { id: typeof filter; label: string }[] = [{ id: 'all', label: 'すべて' }, { id: 'you', label: 'あなた' }, { id: 'couple', label: 'ふたり' }]
  return (
    <Page>
      <SiteHeader current="books" />
      <section className="flex flex-col gap-4 px-5 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">本棚</h1>
        <ShelfTabs active="saved" bookCount={books.filter(b => b.state === 'delivered').length} savedCount={saved.length} />
        <div className="flex flex-wrap gap-2">
          {filters.map(f => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
              className={`flex min-h-[40px] items-center rounded-full px-3.5 text-[13px] ${filter === f.id ? 'bg-fl-ink font-medium text-white' : 'border border-fl-line bg-white text-fl-body'}`}>{f.label}</button>
          ))}
        </div>
      </section>
      <section className="flex flex-col px-5 pt-1">
        {rows.map(r => (
          <Link key={r.id} to={r.href} className="flex min-h-[72px] items-center gap-3.5 border-b border-fl-line">
            <span className={`h-10 w-2 shrink-0 rounded ${r.kind === 'you' ? 'bg-fl-moss' : 'bg-fl-rose'}`} />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-xs text-fl-muted">{r.label}</span>
              <span className="text-[15px] font-medium leading-normal">{r.title}</span>
            </span>
            <IconChevron size={16} className="text-fl-muted" />
          </Link>
        ))}
        {rows.length === 0 && <p className="m-0 py-8 text-center text-sm leading-[1.85] text-fl-muted">保存した読みものはまだありません。<br />読みものの右上の保存ボタンで、ここに残せます。</p>}
      </section>
      <section className="px-5 pt-6"><p className="m-0 text-xs leading-[1.8] text-fl-muted">読みものの右上の保存ボタンで、ここに追加できます。</p></section>
      <Footer />
    </Page>
  )
}
