import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { IconDown, IconPeople } from '../components/icons'
import { Button, Chip, NatureImage, Page } from '../components/ui'
import { AiConsentNotice } from '../components/AiConsent'
import { images } from '../data/images'
import { bookQuestionProblem, bookThemes, countChars, plans } from '../data/mock'
import { sourceCatalog } from '../data/readingData'
import { useApp } from '../state/AppState'
import { remoteMode, paymentsAvailable, BOOK_PREPARING } from '../data/paymentConfig'
import { webAiAdult, WEB_AI_ADULT_NOTICE } from '../../lib/webAiEligibility'

const MIN = 20
const MAX = 400

/**
 * 本番：GET /api/books/status → POST /api/books/validate →
 * POST /api/books（operationId・AI同意ヘッダー必須）→ /api/books/operations/:id をポーリング
 */
export function ComposePage() {
  const { profile, credits, draft, setDraft, createBook, aiConsented, acceptAiConsent, partners, years, chapters, coupleYears, readingsStatus, reloadReadings, requestCreateAfterPurchase } = useApp()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [consent, setConsent] = useState(false)

  const sourceGroups = useMemo(() => sourceCatalog(partners, years, chapters, coupleYears), [partners, years, chapters, coupleYears])
  const sources = useMemo(() => sourceGroups.flatMap(g => g.items), [sourceGroups])
  const requested = params.get('source')
  const requestedItem = sources.find(s => requested?.startsWith('you-') ? s.href === `/you/years/${requested.slice(4)}` : requested?.startsWith('chapter-') ? s.href === `/you/chapters/${requested.slice(8)}` : false)
  const selected = requested && !requestedItem ? undefined : sources.find(s => s.href === draft.sourceHref)
  useEffect(() => {
    if (remoteMode && readingsStatus !== 'ready') return
    const item = requested ? requestedItem : sources.find(s => s.href === draft.sourceHref) ?? sources[0]
    if (!item) return
    if (draft.sourceHref !== item.href || draft.sourceCardId !== item.sourceCardId || (!item.href.startsWith('/couple/') && draft.sourceId !== item.sourceId) || (requested && !draft.question)) {
      setDraft({ sourceTitle: item.title, sourceSub: item.sub, sourceHref: item.href, sourceId: item.sourceId, sourceCardId: item.sourceCardId, theme: item.theme,
        ...(requested && !draft.question ? { question: `「${(item.href.startsWith('/you/chapters/') ? item.title : item.sub).slice(0, 120)}」について、私の状況に合わせて詳しく知りたいです。` } : {}) })
    }
  }, [sources, requested, requestedItem, draft.sourceHref, draft.sourceId, draft.sourceCardId, draft.question, setDraft, readingsStatus])

  const count = countChars(draft.question)
  const lengthOk = count >= MIN && count <= MAX
  const problem = bookQuestionProblem(draft.question)
  const empty = credits <= 0
  const consentOk = aiConsented || consent
  const ageAllowed = !remoteMode || webAiAdult(profile?.birthDate)
  // 残りが0冊でも書けて、ボタンから買う（書いてから払う）
  const ready = ageAllowed && !!selected && (!remoteMode || readingsStatus === 'ready') && lengthOk && !problem && consentOk && (!empty || paymentsAvailable)
  const isCouple = draft.sourceHref.startsWith('/couple')
  const single = plans.find(p => p.id === 'single')!

  function pickSource(href: string) {
    const item = sourceGroups.flatMap(g => g.items).find(i => i.href === href)
    if (item) { setDraft({ sourceTitle: item.title, sourceSub: item.sub, sourceHref: item.href, sourceId: item.sourceId, sourceCardId: item.sourceCardId, theme: item.theme }); if (requested) navigate('/compose', { replace: true }) }
  }

  function submit() {
    if (!ready) return
    if (!aiConsented) acceptAiConsent()
    if (empty) {
      // 支払いが反映されたら、この相談でそのままつくる
      requestCreateAfterPurchase()
      navigate('/credits?from=compose')
      return
    }
    createBook()
    navigate('/books')
  }

  return (
    <Page>
      <SiteHeader current="compose" />

      <section className="px-5 pt-5"><NatureImage src={images.leaves} className="h-[120px] rounded-2xl" /></section>
      <section className="flex flex-col gap-2.5 px-5 pb-2 pt-6">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">いま、知りたいことを。</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">読みものを一つ選んで、相談を書いてください。ひとつの相談に、その読みものをもとにした答えを一冊のブックにしてお届けします（約2,500文字）。</p>
      </section>

      <section className="flex flex-col gap-2.5 px-5 pt-5">
        {remoteMode && readingsStatus !== 'ready' && <p role="status">{readingsStatus === 'loading' ? '読み込み中です…' : '読み込めませんでした。'}{readingsStatus !== 'loading' && <button onClick={reloadReadings}>再読み込み</button>}</p>}
        <label htmlFor="source" className="text-[13px] font-medium text-fl-body">もとにする読みもの</label>
        <div className="relative flex items-center gap-3.5 rounded-2xl border border-fl-line bg-white p-4 focus-within:outline focus-within:outline-2 focus-within:outline-fl-ink">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fl-cream text-fl-rose">
            {isCouple ? <IconPeople size={20} /> : <NatureImage src={images.nature.pampas} className="h-10 w-10 rounded-xl" />}
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-medium">{selected?.title ?? '読みものを選択してください'}</span>
            <span className="text-xs text-fl-muted">{selected?.sub}</span>
          </span>
          <span className="flex items-center gap-1 text-[13px] font-medium text-fl-slate" aria-hidden="true">変える<IconDown size={16} /></span>
          {/* 見た目はカード、操作はOS標準の選択（スマホで選びやすい） */}
          <select id="source" value={draft.sourceHref} onChange={e => pickSource(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
            {sourceGroups.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map(i => <option key={i.href} value={i.href}>{i.title}　{i.sub}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {selected && <Link to={selected.href} className="self-start text-xs text-fl-body underline">選んでいる読みものを読む</Link>}
      </section>

      <section className="flex flex-col gap-2.5 px-5 pt-6">
        <span id="theme-label" className="text-[13px] font-medium text-fl-body">テーマ</span>
        <div role="group" aria-labelledby="theme-label" className="flex flex-wrap gap-2">
          {bookThemes.map(t => (
            <Chip key={t} selected={draft.theme === t} onClick={() => setDraft({ theme: t })}>{t}</Chip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5 px-5 pt-6">
        <label htmlFor="question" className="text-[13px] font-medium text-fl-body">相談したいこと（{MIN}〜{MAX}文字）</label>
        <textarea id="question" rows={7} aria-invalid={count > MAX || !!problem} aria-describedby="question-status" value={draft.question} onChange={e => setDraft({ question: e.target.value })}
          placeholder="例：今年、彼女が転職して忙しくなりました。会う時間が減って不安になります。どんな距離感で過ごすとよいでしょうか。"
          className="w-full resize-y rounded-2xl border border-fl-line bg-white p-4 text-base leading-[1.8] placeholder:text-fl-muted" />
        <div id="question-status" className="flex justify-between gap-3 text-xs text-fl-muted" aria-live="polite">
          <span>{count > MAX ? `${count - MAX}文字減らすとつくれます` : lengthOk ? '書いた内容は下書きとして残ります' : `あと${MIN - count}文字以上でつくれます`}</span>
          <span className={count > MAX ? 'shrink-0 text-fl-danger' : 'shrink-0'}>{count} / {MAX}</span>
        </div>
        {problem && <p role="alert" className="m-0 rounded-xl bg-[#fbeceb] px-4 py-3 text-[13px] leading-[1.8] text-fl-danger">{problem}</p>}
      </section>

      <section className="px-5 pt-5">
        <AiConsentNotice agreed={consent} onChange={setConsent} accepted={aiConsented} />
      </section>

      <section className="flex flex-col gap-2.5 px-5 pb-14 pt-6">
        {!ageAllowed && <p role="status" className="m-0 text-sm leading-relaxed">{WEB_AI_ADULT_NOTICE} 書いた相談は下書きとして残ります。</p>}
        <Button size="lg" disabled={!ready} onClick={submit}>{empty ? (paymentsAvailable ? `${single.price.toLocaleString()}円で一冊つくる` : BOOK_PREPARING) : `一冊つくる（残り${credits}冊）`}</Button>
        <span className="text-center text-xs leading-[1.7] text-fl-muted">
          {empty
            ? (paymentsAvailable ? 'お支払いのあと、この相談でそのままつくり始めます。5冊セット（1,980円）も選べます。' : '書いた相談は下書きとして残ります。すでに利用できる冊数がある場合は、そのまま作成できます。')
            : 'できあがるまで数分かかります。画面を閉じても、本棚に届きます。'}
        </span>
      </section>
    </Page>
  )
}
