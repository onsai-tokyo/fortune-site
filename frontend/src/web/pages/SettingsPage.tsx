import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { BackHeader, Button, Note, Page } from '../components/ui'
import { EmailCode } from '../components/EmailCode'
import { useApp } from '../state/AppState'

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-5 pt-6">
      <h2 className="m-0 text-[13px] font-medium text-fl-muted">{title}</h2>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-fl-line bg-white [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-fl-line">{children}</div>
    </section>
  )
}

function Row({ label, value, to }: { label: string; value?: ReactNode; to?: string }) {
  const inner = <><span>{label}</span><span className="text-[13px] text-fl-muted">{value}{to ? ' ›' : ''}</span></>
  const cls = 'flex min-h-[56px] items-center justify-between px-4 text-[15px]'
  return to ? <Link to={to} className={`${cls} hover:bg-fl-surface/40`}>{inner}</Link> : <div className={cls}>{inner}</div>
}

/** 購入履歴（本番：決済会社の取引記録をバックエンドで保持して返す。API未実装） */
export function PurchasesPage() {
  const rows = [
    { date: '2026年10月12日', item: '相談のブック 5冊セット', price: '1,980円' },
    { date: '2026年9月3日', item: '相談のブック 1冊', price: '500円' },
  ]
  return (
    <Page>
      <SiteHeader current="none" />
      <section className="flex flex-col gap-2 px-5 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">購入履歴・領収書</h1>
        <p className="m-0 text-xs text-fl-muted">表示はサンプルです。</p>
      </section>
      <section className="flex flex-col px-5 pb-12 pt-3">
        {rows.map(r => (
          <div key={r.date} className="flex min-h-[64px] items-center justify-between border-b border-fl-line">
            <span className="flex flex-col gap-0.5"><span className="text-[15px] font-medium">{r.item}</span><span className="text-xs text-fl-muted">{r.date}</span></span>
            <span className="flex items-center gap-3 text-[15px]">{r.price}<button type="button" className="min-h-[44px] text-[13px] text-fl-slate underline">領収書</button></span>
          </div>
        ))}
        <Link to="/settings" className="mt-6 flex min-h-[44px] items-center text-sm text-fl-body">← 設定にもどる</Link>
      </section>
    </Page>
  )
}

/** 退会の本番：DELETE /api/reading/account */
export function SettingsPage() {
  const { profile, partners, credits, forgetDevice, deleteAccount, aiConsented, session, email } = useApp()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!confirming) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirming(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming])

  const birth = profile ? (() => { const [y, m, d] = profile.birthDate.split('-').map(Number); return `${y}年${m}月${d}日` })() : '未登録'

  return (
    <Page>
      <SiteHeader current="none" />
      <section className="px-5 pt-7"><h1 className="m-0 text-[24px] font-medium leading-[1.55]">設定</h1></section>

      <Group title="アカウント">
        {session === 'linked'
          ? <Row label="引き継ぎ用メール" value={email} />
          : <Row label="引き継ぎ用メール" value={<span className="text-fl-ochre">未登録</span>} to="/settings/link" />}
        <Row label="呼び名" value={profile?.nickname || '未設定'} to="/welcome" />
        <Row label="あなたの出生情報" value={birth} to="/welcome" />
      </Group>

      <Group title="ご利用状況">
        <Row label="相談のブックの残り" value={<span className="font-medium text-fl-ink">{credits}冊</span>} />
        <Row label="ふたりの相手" value={partners[0]?.name ?? '未登録'} to="/couple" />
        <Row label="購入履歴・領収書" to="/settings/purchases" />
      </Group>

      <Group title="AIへの送信">
        <div className="p-4 text-[13px] leading-[1.8] text-fl-body">ブックをつくるときと質問するときだけ、相談文・読みもの・計算結果・出生情報（呼び名を含む）を Anthropic PBC（Claude API）へ送ります。メールアドレスは送りません。{aiConsented ? '同意済みです。' : 'はじめて使うときに同意をお願いします。'}</div>
      </Group>

      <Group title="サポート">
        <Row label="お問い合わせ" to="/support" />
        <Row label="利用規約" to="/terms" />
        <Row label="プライバシーポリシー" to="/privacy" />
        <Row label="特定商取引法に基づく表記" to="/tokushoho" />
      </Group>

      <section className="flex flex-col gap-3 px-5 pb-12 pt-8">
        {session === 'linked' ? (
          <>
            <Button variant="secondary" onClick={() => { forgetDevice(); navigate('/') }}>この端末での利用をやめる</Button>
            <span className="-mt-1 text-center text-xs leading-[1.7] text-fl-muted">共用のパソコンではこちらを。{email} に届くコードで、いつでも戻れます。</span>
          </>
        ) : (
          <Note>いまはこの端末だけで使っています。ブラウザのデータを消したり機種を変えたりすると、本棚と残りの冊数を開けなくなります。<Link to="/settings/link" className="underline">引き継ぎ用のメールを登録</Link>しておくと安心です。</Note>
        )}
        <Button variant="dangerText" onClick={() => setConfirming(true)}>退会する（アカウントを削除）</Button>
      </section>

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-fl-ink/45" onClick={() => setConfirming(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={e => e.stopPropagation()}
            className="flex w-full max-w-app flex-col gap-3.5 rounded-t-[20px] bg-fl-canvas px-5 pb-7 pt-6">
            <h2 id="del-title" className="m-0 text-lg font-medium">退会しますか？</h2>
            <p className="m-0 text-sm leading-[1.85] text-fl-body">読みもの、登録した相手、相談のブック、残りの冊数がすべて削除され、元に戻せません。残っている冊数分の返金はできません。</p>
            <Button variant="danger" onClick={() => { deleteAccount(); navigate('/') }}>すべて削除して退会する</Button>
            <Button ref={cancelRef} variant="ghost" onClick={() => setConfirming(false)}>やめる</Button>
          </div>
        </div>
      )}
    </Page>
  )
}

/** 引き継ぎ用メールの登録（匿名アカウントにメールをひも付ける） */
export function LinkEmailPage() {
  const { session, email, receiptEmail, linkEmail } = useApp()
  const [done, setDone] = useState(false)
  return (
    <Page>
      <BackHeader to="/settings" title="引き継ぎ用メール" />
      <section className="flex flex-col gap-3 px-6 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">別の端末でも使えるようにする</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">メールアドレスを登録すると、機種変更やブラウザのデータを消したあとも、届いたコードを入れるだけで同じ本棚と残りの冊数を開けます。パスワードは不要です。</p>
      </section>
      <section className="flex flex-col gap-4 px-6 pb-12 pt-4">
        {done || session === 'linked' ? (
          <Note><strong className="font-medium text-fl-ink">{email}</strong> を引き継ぎ用に登録しました。別の端末では「別の端末から引き継ぐ」からこのメールを入れてください。</Note>
        ) : (
          <LinkEmailForm initialEmail={receiptEmail ?? ''} onDone={address => { linkEmail(address); setDone(true) }} />
        )}
        <Link to="/settings" className="flex min-h-[44px] items-center self-center text-[13px] text-fl-body">設定にもどる</Link>
      </section>
    </Page>
  )
}

export function LinkEmailForm({ initialEmail, onDone }: { initialEmail: string; onDone: (email: string) => void }) {
  return <EmailCode idPrefix="link" initialEmail={initialEmail} sendLabel="確認コードを送る" verifyLabel="登録する" onVerified={onDone} />
}
