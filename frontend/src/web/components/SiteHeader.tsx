import { FateMark } from './FateMark'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../state/AppState'
import { IconChevron, IconClose, IconMenu } from './icons'
import { paymentsAvailable } from '../data/paymentConfig'

export type NavKey = 'you' | 'couple' | 'compose' | 'books' | 'none'

const items: { key: NavKey; label: string; sub: string; to: string }[] = [
  { key: 'you', label: 'あなた', sub: '性格の章と、年ごとの流れ', to: '/you' },
  { key: 'couple', label: 'ふたり', sub: '相手との年表', to: '/couple' },
  { key: 'compose', label: '個別相談', sub: 'あなたの鑑定から、相談を深める', to: '/compose' },
  { key: 'books', label: '本棚', sub: '届いたブックと保存した読みもの', to: '/books' },
]

export function SiteHeader({ current }: { current: NavKey }) {
  const [open, setOpen] = useState(false)
  const { credits, session, purchasedEver } = useApp()
  const location = useLocation()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="sticky top-0 z-30">
      <header className="fl-masthead relative flex items-center justify-between gap-3 border-b border-fl-line bg-fl-canvas py-1.5 pl-5 pr-2">
        <Link to="/you" className="fl-wordmark flex min-h-[44px] items-center text-[13px] font-medium tracking-[0.3em]"><FateMark />FATE LAB</Link>
        <div className="flex items-center gap-1">
          {purchasedEver && (paymentsAvailable
            ? <Link to="/credits" aria-label={`相談のブック 残り${credits}冊`} className="flex min-h-[44px] items-center px-2.5 text-[13px] text-fl-body hover:text-fl-ink">残り {credits}冊</Link>
            : <span className="px-2.5 text-[13px] text-fl-body">残り {credits}冊</span>)}
          <button ref={buttonRef} type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="site-menu"
            aria-label={open ? 'メニューを閉じる' : 'メニューを開く'} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-fl-surface">
            {open ? <IconClose size={22} /> : <IconMenu size={22} />}
          </button>
        </div>
      </header>
      {open && (
        <>
          <button type="button" aria-label="メニューを閉じる" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 top-[65px] z-0 cursor-default bg-fl-ink/20" />
          <nav id="site-menu" aria-label="メニュー" className="absolute left-0 right-0 top-full z-10 flex flex-col border-b border-fl-line bg-fl-canvas px-5 pb-5 pt-2 shadow-[0_16px_32px_rgba(20,22,20,0.08)]">
            {items.map(item => (
              <Link key={item.key} to={item.to} aria-current={item.key === current ? 'page' : undefined}
                className={`my-1 flex min-h-[68px] items-center gap-3 rounded-xl border-l-[3px] px-4 py-2 text-base transition-colors ${item.key === current ? 'border-fl-moss bg-fl-surface font-medium text-fl-ink' : 'border-transparent font-medium hover:bg-fl-surface/50'}`}>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-3">{item.label}{item.key === current && <span className="text-[10px] font-medium tracking-wider text-fl-moss">表示中</span>}</span>
                  <span className="text-xs font-normal text-fl-muted">{item.sub}</span>
                </span>
                <IconChevron size={16} className="text-fl-muted" />
              </Link>
            ))}
            {paymentsAvailable && purchasedEver && <Link to="/credits" className="mt-3 flex min-h-[48px] items-center justify-center rounded-[14px] border border-fl-line bg-white text-[15px] font-medium">相談のブックを買い足す（残り{credits}冊）</Link>}
            <div className="flex flex-wrap gap-x-5 pt-3 text-[13px]">
              <Link to="/settings" className="flex min-h-[44px] items-center text-fl-body">設定</Link>
              <Link to="/support" className="flex min-h-[44px] items-center text-fl-body">お問い合わせ</Link>
              {session === 'anonymous' && <Link to="/settings/link" className="flex min-h-[44px] items-center text-fl-body">新規登録（無料）</Link>}
            </div>
          </nav>
        </>
      )}
    </div>
  )
}
