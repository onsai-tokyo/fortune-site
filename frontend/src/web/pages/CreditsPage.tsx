import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconClock, IconRefresh } from '../components/icons'
import { BackHeader, Button, Field, LinkButton, NatureImage, Note, Page, PlainHeader } from '../components/ui'
import { LinkEmailForm } from './SettingsPage'
import { images } from '../data/images'
import { plans } from '../data/mock'
import type { PlanId } from '../data/types'
import { useApp } from '../state/AppState'
import { paymentsAvailable, BOOK_PREPARING } from '../data/paymentConfig'

function CreditsPreparing() {
  return <Page><BackHeader to="/compose" title="相談のブック" /><section className="flex flex-col gap-4 px-5 py-7"><h1 className="m-0 text-[24px] font-medium">{BOOK_PREPARING}</h1><p>新しい冊数の購入は、まだご利用いただけません。書いた相談は下書きとして残ります。利用できる冊数がある方は、ブック作成・質問を引き続きご利用いただけます。</p><LinkButton to="/compose">相談の下書きにもどる</LinkButton><LinkButton to="/books" variant="secondary">本棚へ</LinkButton></section></Page>
}

/**
 * 本番：POST /api/web-payments/checkout（未実装）で決済会社の支払い画面URLを受け取り移動。
 * 送るもの：プラン、領収書のメール、匿名でもよいアカウントID（JWT）。人間かどうかの確認（Turnstile等）のトークンも添える。
 * 利用枠の付与は決済会社からの通知（Webhook）でのみ行い、戻りURLでは付与しない。
 */
export function CreditsPage() {
  return paymentsAvailable ? <CheckoutPage /> : <CreditsPreparing />
}

function CheckoutPage() {
  const { credits, purchase, email: linkedEmail, receiptEmail, pendingCreate, draft, cancelPendingCreate } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // 相談を書いてから来た人は、その一冊のための購入（初期値は1冊）
  const forCompose = params.get('from') === 'compose' && pendingCreate
  const [picked, setPicked] = useState<PlanId>(forCompose ? 'single' : 'pack5')
  // 相談から来たのでなければ、前に途中でやめた「支払ったらつくる」は取り消す
  useEffect(() => { if (!forCompose) cancelPendingCreate() }, [forCompose, cancelPendingCreate])
  const [email, setEmail] = useState(linkedEmail ?? receiptEmail ?? '')
  const plan = plans.find(p => p.id === picked)!
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const [checkoutError, setCheckoutError] = useState('')

  function checkout() {
    if (!emailOk) return
    // Integration seam: replace with provider checkout; never fake a REMOTE grant.
    if (!purchase(picked, email.trim())) { setCheckoutError('お支払い機能は接続準備中です。相談は下書きに残っています。'); return }
    navigate(`/credits/return?plan=${picked}`)
  }

  return (
    <Page>
      <BackHeader to="/compose" title="相談のブックを買う" />
      <section className="flex flex-col gap-2.5 px-5 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{forCompose ? '支払うと、すぐにつくり始めます' : '相談のブックを買う'}</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">
          {forCompose
            ? <>「{draft.sourceTitle}」をもとにした相談を、支払いが済みしだい一冊にします。</>
            : <>いまの残りは {credits}冊です。届いたブックは、いつでも本棚で読み返せます。</>}
        </p>
      </section>

      <section className="px-5 pt-4">
        <div role="radiogroup" aria-label="プランを選ぶ" className="flex flex-col gap-3">
          {plans.map(p => {
            const on = p.id === picked
            return (
              <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setPicked(p.id)}
                className={`flex min-h-[84px] w-full items-center gap-3 rounded-2xl bg-white text-left ${on ? 'border-2 border-fl-ink p-4' : 'border border-fl-line p-[17px]'}`}>
                <span className={`h-5 w-5 shrink-0 rounded-full ${on ? 'border-[6px] border-fl-ink' : 'border-[1.5px] border-fl-muted'}`} />
                <span className="flex flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2 text-base font-medium">{p.name}{p.recommended && <span className="rounded-[10px] bg-fl-cream px-2 py-0.5 text-[11px] font-medium text-fl-rose">おすすめ</span>}</span>
                  <span className="text-[13px] leading-[1.6] text-fl-muted">{p.detail}</span>
                </span>
                <span className="text-base font-medium">{p.price.toLocaleString()}円</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="px-5 pt-5">
        <div className="flex flex-col gap-2 rounded-2xl bg-fl-surface p-4 text-[13px] leading-[1.8] text-fl-body">
          <span>1回きりのお支払いです。月額の契約や自動更新はありません。買った冊数に期限はありません。</span>
          <span>お支払いは決済会社の画面で行います。カード番号はFATE LABには保存されません。</span>
        </div>
      </section>

      <section className="px-5 pt-5">
        <Field id="receipt-email" label="領収書の送り先（メールアドレス）" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com"
          value={email} onChange={e => setEmail(e.target.value)} readOnly={!!linkedEmail}
          hint={linkedEmail ? '引き継ぎ用に登録したメールに送ります。' : 'ブックができたときのお知らせもこのメールに送ります。お支払い後、このメールで別の端末への引き継ぎも設定できます。'} />
      </section>

      <section className="flex flex-col gap-3 px-5 pb-14 pt-6">
        {checkoutError && <p role="alert">{checkoutError}</p>}
        <Button size="lg" disabled={!emailOk} onClick={checkout}>{plan.name}を買う（{plan.price.toLocaleString()}円）</Button>
        <nav aria-label="お支払いについて" className="flex flex-wrap justify-center gap-x-[18px] text-xs">
          <Link to="/tokushoho" className="flex min-h-[44px] items-center text-fl-body">特定商取引法に基づく表記</Link>
          <Link to="/terms" className="flex min-h-[44px] items-center text-fl-body">利用規約</Link>
        </nav>
      </section>
    </Page>
  )
}

type ReturnStatus = 'checking' | 'done' | 'delayed'

/** 決済会社から戻った画面。/api/books/status を数秒おきに確認する */
export function PaymentReturnPage() {
  return paymentsAvailable ? <PaymentReturnContent /> : <CreditsPreparing />
}

function PaymentReturnContent() {
  const { credits, session, receiptEmail, linkEmail, startPendingBook } = useApp()
  const [linked, setLinked] = useState(false)
  const [startedBook, setStartedBook] = useState<string | null>(null)
  const [params] = useSearchParams()
  const plan = plans.find(p => p.id === params.get('plan'))
  const forced = params.get('status') as ReturnStatus | null
  const startCredits = useRef(credits)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 15000)
    return () => window.clearTimeout(t)
  }, [])

  // 一度反映を確認したら「完了」のまま（直後にブックをつくって残りが減っても戻さない）
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => { if (credits > startCredits.current) setConfirmed(true) }, [credits])
  const status: ReturnStatus = forced ?? (confirmed ? 'done' : timedOut ? 'delayed' : 'checking')

  // 書いてから払った人：反映されたら、その相談でブックをつくり始める（1回だけ）
  useEffect(() => {
    if (status !== 'done' || startedBook) return
    const book = startPendingBook()
    if (book) setStartedBook(book.title)
  }, [status, startedBook, startPendingBook])

  return (
    <Page>
      <PlainHeader />
      <section aria-live="polite" className="flex flex-col items-center gap-[18px] px-7 pb-10 pt-[72px] text-center">
        {status === 'checking' && (
          <>
            <span className="flex h-16 w-16 animate-spin-slow items-center justify-center rounded-full bg-fl-surface text-fl-slate"><IconRefresh size={28} /></span>
            <h1 className="m-0 text-[22px] font-medium">反映を確認しています</h1>
            <p className="m-0 text-sm leading-[1.85] text-fl-body">お支払いを受け付けました。決済会社からの通知を待っています。通常は数秒で終わります。</p>
            <p className="m-0 text-[13px] leading-[1.8] text-fl-muted">この画面を閉じても、反映されると残りの冊数に加わります。もう一度買わないでください。</p>
          </>
        )}
        {status === 'done' && (
          <>
            <NatureImage src={images.flower} className="h-28 w-28 rounded-full" />
            <h1 className="m-0 text-[22px] font-medium leading-relaxed">{startedBook ? <>お支払いを確認しました。<br />ブックをつくり始めています</> : `${plan ? plan.name : '相談のブック'}を追加しました`}</h1>
            <p className="m-0 text-sm leading-[1.85] text-fl-body">
              {startedBook
                ? <>「{startedBook}」は数分で本棚に届きます。できあがったらメールでもお知らせします。{credits > 0 && <>残りは {credits}冊です。</>}</>
                : <>いまの残りは {forced === 'done' && plan && credits <= startCredits.current ? credits + plan.credits : credits}冊です。領収書はメールでお送りしました。</>}
            </p>
            {startedBook
              ? <LinkButton to="/books" size="lg" className="mt-2">本棚で待つ</LinkButton>
              : <LinkButton to="/compose" size="lg" className="mt-2">相談を書く</LinkButton>}
            {(session === 'anonymous' || linked) && (
              <div className="mt-6 flex w-full flex-col gap-3 rounded-card border border-fl-line bg-white p-5 text-left">
                <span className="text-base font-medium">別の端末でも使えるようにする</span>
                {linked ? (
                  <Note>メールを登録しました。別のスマホやPCでも「ログイン」からこのメールを入れてください。</Note>
                ) : (
                  <>
                    <span className="text-[13px] leading-[1.8] text-fl-body">いまはこの端末だけで使っています。メールを登録しておくと、機種変更のあとも同じ本棚と残りの冊数を開けます（パスワード不要）。</span>
                    <LinkEmailForm initialEmail={receiptEmail ?? ''} onDone={address => { linkEmail(address); setLinked(true) }} />
                  </>
                )}
              </div>
            )}
          </>
        )}
        {status === 'delayed' && (
          <>
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-fl-surface text-fl-ochre"><IconClock size={28} /></span>
            <h1 className="m-0 text-[22px] font-medium">反映に時間がかかっています</h1>
            <p className="m-0 text-sm leading-[1.85] text-fl-body">お支払いは完了している可能性があります。二重にお支払いにならないよう、再購入はせずにしばらくお待ちください。</p>
            <Button variant="secondary" className="mt-2" onClick={() => window.location.reload()}>もう一度確認する</Button>
            <Link to="/support" className="flex min-h-[44px] items-center text-[13px] text-fl-body">30分以上反映されない場合はお問い合わせへ</Link>
          </>
        )}
      </section>
    </Page>
  )
}
