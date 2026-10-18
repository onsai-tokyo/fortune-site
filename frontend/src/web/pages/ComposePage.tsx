import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { IconDown, IconPeople } from '../components/icons'
import { Button, Chip, NatureImage, Page } from '../components/ui'
import { AiConsentNotice } from '../components/AiConsent'
import { images } from '../data/images'
import { bookQuestionProblem, bookThemes, countChars, defaultDraftSource, mockChapters, mockCoupleYears, mockYears, plans, relationGroup } from '../data/mock'
import type { BookTheme } from '../data/types'
import { useApp } from '../state/AppState'

const MIN = 20
const MAX = 400

/**
 * 本番：GET /api/books/status → POST /api/books/validate →
 * POST /api/books（operationId・AI同意ヘッダー必須）→ /api/books/operations/:id をポーリング
 */
export function ComposePage() {
  const { credits, draft, setDraft, createBook, aiConsented, acceptAiConsent, partners, requestCreateAfterPurchase } = useApp()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [consent, setConsent] = useState(false)

  // 念のため：もとにする読みものが、いま登録していない相手のものなら差し替える
  const sourcePartner = draft.sourceHref.match(/^\/couple\/([^?]+)/)?.[1]
  const sourceMissing = !!sourcePartner && !partners.some(p => p.id === sourcePartner)
  useEffect(() => {
    if (sourceMissing) setDraft(defaultDraftSource(partners[0]))
  }, [sourceMissing, partners, setDraft])

  useEffect(() => {
    const source = params.get('source')
    // iOSと同じく、読みものから来たときは相談文が空なら書き出しを入れておく
    const prefill = (title: string) => draft.question ? {} : { question: `「${title.slice(0, 120)}」について、私の状況に合わせて詳しく知りたいです。` }
    const match = source?.match(/^you-(\d{4})$/)
    if (match) {
      const y = mockYears.find(r => String(r.year) === match[1])
      if (y) setDraft({ sourceTitle: `あなたの${y.year}年`, sourceSub: y.title, sourceHref: `/you/years/${y.year}`, theme: '時期の判断', ...prefill(y.title) })
    }
    const chapter = source?.match(/^chapter-([a-z]+)$/)
    if (chapter) {
      const c = mockChapters.find(ch => ch.id === chapter[1])
      if (c) setDraft({ sourceTitle: c.title, sourceSub: '性格の章', sourceHref: `/you/chapters/${c.id}`, theme: 'その他', ...prefill(c.title) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, setDraft])

  const count = countChars(draft.question)
  const lengthOk = count >= MIN && count <= MAX
  const problem = bookQuestionProblem(draft.question)
  const empty = credits <= 0
  const consentOk = aiConsented || consent
  // 残りが0冊でも書けて、ボタンから買う（書いてから払う）
  const ready = lengthOk && !problem && consentOk
  const isCouple = draft.sourceHref.startsWith('/couple')
  const single = plans.find(p => p.id === 'single')!

  // もとにする読みものの候補（あなたの年・性格の章・ふたりの年）
  const partner = partners[0]
  type SourceItem = { href: string; title: string; sub: string; theme: BookTheme }
  const sourceGroups: { label: string; items: SourceItem[] }[] = [
    { label: 'あなたの年ごとの流れ', items: mockYears.map(y => ({ href: `/you/years/${y.year}`, title: `あなたの${y.year}年`, sub: y.title, theme: '時期の判断' })) },
    { label: 'あなたの性格の章', items: mockChapters.map(c => ({ href: `/you/chapters/${c.id}`, title: c.title, sub: '性格の章', theme: 'その他' })) },
    ...(partner ? [{ label: `${partner.name}との年表`, items: mockCoupleYears.filter(y => !partner.metYear || y.year >= partner.metYear).map((y): SourceItem => ({ href: `/couple/${partner.id}?year=${y.year}`, title: `${partner.name}との${y.year}年`, sub: y.title, theme: relationGroup(partner.relation) === 'romantic' ? '恋愛・関係' : '人間関係' })) }] : []),
  ]
  function pickSource(href: string) {
    const item = sourceGroups.flatMap(g => g.items).find(i => i.href === href)
    if (item) setDraft({ sourceTitle: item.title, sourceSub: item.sub, sourceHref: item.href, theme: item.theme })
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
        <p className="m-0 text-sm leading-[1.85] text-fl-body">読みものを一つ選んで、相談を書いてください。その読みものをもとにした答えが、一冊のブックになって本棚に届きます（約2,500文字・質問2回つき）。</p>
      </section>

      <section className="flex flex-col gap-2.5 px-5 pt-5">
        <label htmlFor="source" className="text-[13px] font-medium text-fl-body">もとにする読みもの</label>
        <div className="relative flex items-center gap-3.5 rounded-2xl border border-fl-line bg-white p-4 focus-within:outline focus-within:outline-2 focus-within:outline-fl-ink">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fl-cream text-fl-rose">
            {isCouple ? <IconPeople size={20} /> : <NatureImage src={images.nature.pampas} className="h-10 w-10 rounded-xl" />}
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-medium">{draft.sourceTitle}</span>
            <span className="text-xs text-fl-muted">{draft.sourceSub}</span>
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
        <Link to={draft.sourceHref} className="self-start text-xs text-fl-body underline">選んでいる読みものを読む</Link>
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
        <Button size="lg" disabled={!ready} onClick={submit}>{empty ? `${single.price.toLocaleString()}円で一冊つくる` : `一冊つくる（残り${credits}冊）`}</Button>
        <span className="text-center text-xs leading-[1.7] text-fl-muted">
          {empty
            ? 'お支払いのあと、この相談でそのままつくり始めます。5冊セット（1,980円）も選べます。'
            : 'できあがるまで数分かかります。画面を閉じても、本棚に届きます。'}
        </span>
      </section>
    </Page>
  )
}
