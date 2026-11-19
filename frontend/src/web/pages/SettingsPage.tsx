import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { BackHeader, Button, Page } from '../components/ui'
import { PasswordSetup } from '../components/PasswordSetup'
import { useApp } from '../state/AppState'
import { ACCOUNT_DELETE_FAILED, ACCOUNT_DELETE_AUTH_REQUIRED, ACCOUNT_DELETE_OWNER_CHANGED, ACCOUNT_DELETE_SIGNOUT_FAILED } from '../state/accountDeletion'

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

export function PurchasesPage() {
  return (
    <Page>
      <BackHeader to="/settings" title="過去のご利用" />
      <section className="flex flex-col gap-3 px-5 py-7">
        <p className="m-0 text-sm leading-relaxed">過去の個別相談や未使用の冊数については、サポートへお問い合わせください。</p>
        <Link to="/support" className="flex min-h-[44px] items-center text-sm underline">お問い合わせ</Link>
      </section>
    </Page>
  )
}

/** 退会の本番：DELETE /api/reading/account */
export function SettingsPage() {
  const { profile, partners, forgetDevice, deleteAccount, session, email, resetReading, books, credits, purchasedEver } = useApp()
  const hasPastPurchases = books.length > 0 || credits > 0 || purchasedEver
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  const [forgetError, setForgetError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deletingRef = useRef(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const closeConfirmation = () => { if (!deletingRef.current) setConfirming(false) }
  const confirmDeletion = async () => {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      navigate('/', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setDeleteError([ACCOUNT_DELETE_AUTH_REQUIRED, ACCOUNT_DELETE_OWNER_CHANGED, ACCOUNT_DELETE_SIGNOUT_FAILED].includes(message) ? message : ACCOUNT_DELETE_FAILED)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!confirming) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deletingRef.current) setConfirming(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming])

  const birth = profile ? (() => { const [y, m, d] = profile.birthDate.split('-').map(Number); return `${y}年${m}月${d}日` })() : '未登録'

  return (
    <Page>
      <SiteHeader current="none" />
      <section className="fl-page-title px-5 pt-7"><h1 className="m-0 text-[24px] font-medium leading-[1.55]">設定</h1></section>

      <Group title="鑑定の設定">
        {session === 'linked' && <Row label="登録メール・パスワード" value={email} to="/settings/link" />}
        <Row label="呼び名" value={profile?.nickname || '未設定'} to="/welcome" />
        <Row label="あなたの出生情報" value={birth} to="/welcome" />
        <button type="button" className="min-h-[56px] px-4 text-left text-sm text-fl-moss" onClick={()=>{
          if (!window.confirm('表示中の鑑定をリセットして、出生情報を入力し直します。')) return
          resetReading(); navigate('/welcome')
        }}>入力をリセットして、別の鑑定を読む</button>
      </Group>

      <Group title="ご利用状況">
        <Row label="ふたりの相手" value={partners.length > 1 ? `${partners.length}人（選択して読む）` : partners[0]?.name ?? '未登録'} to="/couple" />
        {hasPastPurchases && <Row label="過去のご利用" to="/settings/purchases" />}
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
            <Button variant="secondary" disabled={forgetting || deleting} onClick={async () => {
              setForgetting(true); setForgetError(null)
              try { await forgetDevice(); navigate('/', { replace: true }) }
              catch (error) { setForgetError(error instanceof Error ? error.message : 'ログアウトできませんでした。') }
              finally { setForgetting(false) }
            }}>{forgetting ? 'ログアウトしています…' : 'この端末での利用をやめる'}</Button>
            {forgetError && <p role="alert" className="text-sm text-fl-danger">{forgetError}</p>}
            <span className="-mt-1 text-center text-xs leading-[1.7] text-fl-muted">共用のパソコンではこちらを。{email} に届くコードで、いつでも戻れます。</span>
          </>
        ) : null}
        {session !== 'none' && <Button variant="dangerText" disabled={deleting || forgetting} onClick={() => { setDeleteError(null); setConfirming(true) }}>退会する（アカウントを削除）</Button>}
      </section>

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-fl-ink/45" onClick={closeConfirmation}>
          <div role="dialog" aria-modal="true" aria-busy={deleting} aria-labelledby="del-title" onClick={e => e.stopPropagation()}
            className="flex w-full max-w-app flex-col gap-3.5 rounded-t-[20px] bg-fl-canvas px-5 pb-7 pt-6">
            <h2 id="del-title" className="m-0 text-lg font-medium">退会しますか？</h2>
            <p className="m-0 text-sm leading-[1.85] text-fl-body">読みもの、登録した相手{hasPastPurchases ? '、過去の相談ブック、残りの冊数' : ''}がすべて削除され、元に戻せません。</p>
            {deleteError && <p role="alert" className="m-0 text-sm leading-[1.85] text-fl-danger">{deleteError}</p>}
            <Button variant="danger" disabled={deleting} onClick={() => { void confirmDeletion() }}>{deleting ? '退会処理中です…' : 'すべて削除して退会する'}</Button>
            <Button ref={cancelRef} variant="ghost" disabled={deleting} onClick={closeConfirmation}>やめる</Button>
          </div>
        </div>
      )}
    </Page>
  )
}

export function LinkEmailPage() {
  const { email } = useApp()
  return (
    <Page>
      <BackHeader to="/settings" title="登録メール・パスワード" />
      <section className="flex flex-col gap-4 px-6 py-7">
        <p className="m-0 text-sm">登録メールアドレスは {email} です。</p>
        <PasswordSetup />
      </section>
    </Page>
  )
}
