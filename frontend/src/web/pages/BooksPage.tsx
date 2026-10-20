import { Link, useParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { IconAlert, IconChevron, IconClock } from '../components/icons'
import { Button, Footer, LinkButton, NatureImage, Page } from '../components/ui'
import { savedCatalog } from '../data/mock'
import { images } from '../data/images'
import type { Book } from '../data/types'
import { useApp } from '../state/AppState'
import { useState } from 'react'
import { paymentsAvailable, BOOK_PREPARING, remoteMode } from '../data/paymentConfig'
import { visibleYearSections } from '../data/readingPresentation'
import { matchingSnapshot, snapshotForReading } from '../data/readingSnapshot'
import { formatBookDate as formatDate } from '../data/bookDate'

/** iOS AIBook.isPending と同じ */
const isPending = (b: Book) => b.state === 'queued' || b.state === 'generating' || b.state === 'review'
const stateLabel: Record<string, string> = { queued: '受付済み', generating: '作成中', review: '確認中' }

/** iOS AIBook.failureMessage と同じ文言 */
function failureMessage(code?: string) {
  if (code === 'BOOK_REFUSED' || code === 'BOOK_DOCUMENT_POLICY') return 'このご相談は読みもので扱える範囲を超えていたため、使った1冊分をお戻ししました。相談内容は保存されています。'
  return '作成を完了できなかったため、使った1冊分をお戻ししました。相談内容はそのままで再試行できます。'
}

export function ShelfTabs({ active, bookCount, savedCount }: { active: 'books' | 'saved'; bookCount: number; savedCount: number }) {
  const tab = (on: boolean) => `flex min-h-[44px] items-center justify-center rounded-[11px] text-sm ${on ? 'bg-white font-medium' : 'text-fl-body'}`
  return (
    <nav aria-label="本棚の表示" className="fl-shelf-tabs grid grid-cols-2 rounded-[14px] bg-fl-surface p-1">
      <Link to="/books" aria-current={active === 'books' ? 'page' : undefined} className={tab(active === 'books')}>相談への回答 {bookCount}冊</Link>
      <Link to="/books/saved" aria-current={active === 'saved' ? 'page' : undefined} className={tab(active === 'saved')}>お気に入りの鑑定 {savedCount}件</Link>
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
  const { credits, retryBook, retryTargets } = useApp()
  const [retried, setRetried] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
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
        {retryTargets?.[book.id] ? <LinkButton to={`/books/${retryTargets[book.id]}`}>同じ相談のブックを確認</LinkButton> : <Button disabled={retried || credits <= 0} onClick={async () => {
          setRetried(true); setRetryError(null)
          try { await retryBook(book.id) }
          catch (error) { setRetryError(error instanceof Error ? error.message : '受付を確認できませんでした。') }
          finally { setRetried(false) }
        }}>もう一度つくる</Button>}
        <LinkButton to="/support" variant="secondary">お問い合わせ</LinkButton>
      </div>
      {retryError && <p role="alert" className="text-sm text-fl-danger">{retryError}</p>}
      <span className="text-xs leading-[1.7] text-fl-muted">相談文は保存されているので、書き直す必要はありません。</span>
    </div>
  )
}

function BookRow({ book }: { book: Book }) {
  return (
    <Link to={`/books/${book.id}`} className="fl-book-row flex gap-3.5 rounded-2xl border border-fl-line bg-white p-4 hover:bg-fl-surface/40">
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
  const { books, savedIds, partners, years, chapters, coupleYears, credits, bookRefreshError, reloadReadings, snapshots } = useApp()
  const delivered = books.filter(b => b.state === 'delivered')
  const savedCount = remoteMode ? (snapshots?.length ?? 0) + savedIds.length : savedCatalog(partners, years, chapters, coupleYears).filter(s => savedIds.includes(s.id)).length
  return (
    <Page>
      <SiteHeader current="books" />
      <section className="fl-page-title flex flex-col gap-4 px-5 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">本棚</h1>
        <ShelfTabs active="books" bookCount={delivered.length} savedCount={savedCount} />
      </section>
      <section className="flex flex-col gap-3 px-5 pt-3">
        {bookRefreshError && <div role="alert" className="rounded-2xl border border-fl-ochre bg-white p-4"><p>{bookRefreshError}</p><Button variant="secondary" onClick={reloadReadings}>再読み込み</Button></div>}
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
              <li>ひとつの相談に、一冊の答えをお届けします</li>
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
  const { books, savedIds, partners, years, chapters, coupleYears, snapshots, snapshotError, reloadReadings } = useApp()
  const [filter, setFilter] = useState<'all' | 'you' | 'couple'>('all')
  const catalog = savedCatalog(partners, years, chapters, coupleYears)
  // 保存した順（新しいものを上）に並べる
  const saved = remoteMode
    ? (snapshots??[]).map(r=>({id:r.id,kind:r.payload.kind,title:r.payload.title,label:r.payload.label,href:`/books/saved/${r.id}`}))
    : [...savedIds].reverse().map(id => catalog.find(c => c.id === id)).filter((s): s is NonNullable<typeof s> => !!s)
  const rows = saved.filter(s => filter === 'all' || s.kind === filter)
  const filters: { id: typeof filter; label: string }[] = [{ id: 'all', label: 'すべて' }, { id: 'you', label: 'あなた' }, { id: 'couple', label: 'ふたり' }]
  return (
    <Page>
      <SiteHeader current="books" />
      <section className="fl-page-title flex flex-col gap-4 px-5 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">本棚</h1>
        <ShelfTabs active="saved" bookCount={books.filter(b => b.state === 'delivered').length} savedCount={saved.length + (remoteMode ? savedIds.length : 0)} />
        <div className="flex flex-wrap gap-2">
          {filters.map(f => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
              className={`flex min-h-[40px] items-center rounded-full px-3.5 text-[13px] ${filter === f.id ? 'bg-fl-ink font-medium text-white' : 'border border-fl-line bg-white text-fl-body'}`}>{f.label}</button>
          ))}
        </div>
      </section>
      <section className="flex flex-col px-5 pt-1">
        {snapshotError && <div role="alert"><p>{snapshotError}</p><Button onClick={reloadReadings}>再読み込み</Button></div>}
        {remoteMode && savedIds.length > 0 && <aside className="my-4 rounded-xl bg-fl-surface p-4 text-sm leading-relaxed">
          以前の保存項目 {savedIds.length}件は残っています。旧方式では保存時点の本文を記録していなかったため、新しい鑑定と混ぜずに保留しています。
          項目を開き、現在の鑑定を確認して保存し直せます。以前の保存は消えません。
          <ul className="mt-3 list-none p-0">{savedIds.map(key=><li key={key}>
            <Link className="flex min-h-[48px] items-center justify-between border-t border-fl-line py-3 text-fl-moss"
              to={`/books/legacy/${encodeURIComponent(key)}`}>{legacyLabel(key)}<IconChevron size={16}/></Link>
          </li>)}</ul>
        </aside>}
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
        {rows.length === 0 && !snapshotError && <p className="m-0 py-8 text-center text-sm leading-[1.85] text-fl-muted">保存した読みものはまだありません。<br />読みものの右上の保存ボタンで、ここに残せます。</p>}
      </section>
      <section className="px-5 pt-6"><p className="m-0 text-xs leading-[1.8] text-fl-muted">読みものの右上の保存ボタンで、ここに追加できます。</p></section>
      <Footer />
    </Page>
  )
}

function legacyLabel(key: string) {
  const year = /^you-(\d{4})$/.exec(key)
  if (year) return `${year[1]}年のあなた（以前の保存）`
  const couple = /^couple-.+-(\d{4})$/.exec(key)
  if (couple) return `${couple[1]}年のふたり（以前の保存）`
  return key.startsWith('chapter-') ? '性格の章（以前の保存）' : '以前の保存項目'
}

export function LegacySavedReadingPage() {
  const { readingKey = '' } = useParams()
  const state = useApp()
  const input = snapshotForReading(readingKey, state)
  // A changed source/body must require fresh confirmation.
  return <LegacySavedReadingReview key={JSON.stringify([readingKey,input])} readingKey={readingKey}/>
}

function LegacySavedReadingReview({readingKey}: {readingKey:string}) {
  const state = useApp()
  const [confirmed,setConfirmed] = useState(false)
  const input = snapshotForReading(readingKey,state)
  const existing = matchingSnapshot(state.snapshots??[],input)
  const available = remoteMode && state.savedIds.includes(readingKey)
  return <Page><SiteHeader current="books"/><section className="px-6 py-8">
    <Link to="/books/saved" className="text-sm text-fl-moss">‹ 本棚へ</Link>
    <h1 className="mt-6 text-2xl">{legacyLabel(readingKey)}</h1>
    {!available ? <p>この保存項目は見つかりません。</p> : <>
      <p className="rounded-xl bg-fl-surface p-4 text-sm leading-loose">
        以前の保存には本文の記録がありません。ここで保存するのは現在表示している鑑定です。
        保存当時の本文の復元ではなく、内容が異なる場合があります。以前の保存項目は残ります。
      </p>
      {!input || input.payload.sections.length===0 ? <>
        <p className="text-sm leading-loose">確認できる鑑定がありません。「あなた」で生年月日などを確認し、ふたりの鑑定なら対象の相手も選んでください。その後、本棚のこの項目へ戻ってください。</p>
        <LinkButton to="/you">あなたの鑑定を確認する</LinkButton>
        {readingKey.startsWith('couple-') && <LinkButton to="/couple" variant="secondary">相手を確認する</LinkButton>}
      </> : <>
        <p className="text-sm text-fl-moss">現在の入力：{state.profile?.birthDate}／出生時刻 {state.profile?.birthTime || '不明'}</p>
        <h2 className="text-xl">{input.payload.title}</h2>
        {visibleYearSections(input.payload.sections).map((s,i)=><section key={i} className="my-6">
          {s.heading&&<h3 className="text-base">{s.heading}</h3>}
          <p className="whitespace-pre-wrap text-sm leading-loose">{s.body}</p>
        </section>)}
        {existing ? <><p role="status">この内容は保存済みです。以前の保存項目も残しています。</p>
          <LinkButton to={`/books/saved/${existing.id}`}>保存した鑑定を開く</LinkButton></> : <>
          <label className="my-5 flex items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>
            対象と本文を確認しました。保存当時の復元ではなく、この内容を新しく保存します。
          </label>
          <Button disabled={!confirmed || state.session!=='linked' || !!state.snapshotError || state.savingIds?.includes(readingKey)}
            onClick={()=>state.toggleSaved(readingKey,true)}>この内容で保存し直す</Button>
          {state.session!=='linked' && <Link to="/settings/link">新規登録・ログインして保存</Link>}
        </>}
        {(state.snapshotError || state.saveErrors?.[readingKey]) && <p role="alert">{state.snapshotError || state.saveErrors?.[readingKey]}</p>}
      </>}
    </>}
  </section><Footer/></Page>
}

export function SavedSnapshotPage() {
  const {id}=useParams()
  const {snapshots,snapshotError,readingsStatus,removeSnapshot,reloadReadings}=useApp()
  const [error,setError]=useState('')
  const [removing,setRemoving]=useState(false)
  const row=snapshots?.find(r=>r.id===id)
  return <Page><SiteHeader current="books"/><section className="px-6 py-8">
    <Link to="/books/saved" className="text-sm text-fl-moss">‹ 本棚へ</Link>
    {!row ? <><p role="status">{snapshotError ?? (readingsStatus==='loading'?'保存した鑑定を読み込んでいます…':'この保存項目は見つかりません。')}</p><Button onClick={reloadReadings}>再読み込み</Button></>
      : <><p className="text-xs text-fl-moss">保存した時点の鑑定</p><h1 className="text-2xl">{row.payload.title}</h1>
        {visibleYearSections(row.payload.sections).map((s,i)=><section key={i} className="my-7">{s.heading&&<h2 className="text-lg">{s.heading}</h2>}<p className="whitespace-pre-wrap text-sm leading-loose">{s.body}</p></section>)}
        <Button variant="secondary" disabled={removing} onClick={async()=>{
          if(!window.confirm('この鑑定を本棚から削除しますか？'))return
          setRemoving(true);setError('')
          try{await removeSnapshot(row.id)}catch{setError('削除できませんでした。もう一度お試しください。')}finally{setRemoving(false)}
        }}>本棚から削除</Button>{error&&<p role="alert">{error}</p>}</>}
  </section></Page>
}
