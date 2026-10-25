import { FateMark } from './FateMark'
import { Link } from 'react-router-dom'
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { IconBack, IconChevron } from './icons'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerText'

const variantClass: Record<Variant, string> = {
  primary: 'bg-fl-ink text-white hover:bg-[#2a2d29]',
  secondary: 'bg-white text-fl-ink border border-fl-line hover:bg-fl-surface',
  outline: 'bg-transparent text-fl-ink border border-fl-ink hover:bg-fl-surface',
  ghost: 'bg-transparent text-fl-ink hover:bg-fl-surface',
  danger: 'bg-fl-danger text-white hover:bg-[#9a1d14]',
  dangerText: 'bg-transparent text-fl-danger hover:bg-[#fbeceb]',
}

const buttonBase = 'fl-button inline-flex w-full items-center justify-center gap-2 rounded-button px-4 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:bg-fl-line disabled:text-fl-muted disabled:border-transparent'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' }>(
  function Button({ variant = 'primary', size = 'md', className = '', ...rest }, ref) {
    return <button ref={ref} type="button" className={`${buttonBase} ${size === 'lg' ? 'min-h-[52px] text-base' : 'min-h-[48px]'} ${variantClass[variant]} ${className}`} {...rest} />
  },
)

export function LinkButton({ to, variant = 'primary', size = 'md', className = '', children }: { to: string; variant?: Variant; size?: 'md' | 'lg'; className?: string; children: ReactNode }) {
  return <Link to={to} className={`${buttonBase} ${size === 'lg' ? 'min-h-[52px] text-base' : 'min-h-[48px]'} ${variantClass[variant]} ${className}`}>{children}</Link>
}

/** 画面の小見出し。ページの見出しを兼ねるときは as="h1" にする（見た目は同じ） */
export function Eyebrow({ children, className = '', as = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'h1' }) {
  const Tag = as
  return <Tag className={`fl-eyebrow m-0 text-xs font-medium text-fl-moss ${className}`}>{children}</Tag>
}

export function SectionHeading({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return <div className="fl-section-heading"><h2>{children}</h2>{detail && <span>{detail}</span>}</div>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`fl-card rounded-card border border-fl-line bg-white ${className}`}>{children}</div>
}

export function Note({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-field bg-fl-surface p-4 text-[13px] leading-[1.8] text-fl-body ${className}`}>{children}</div>
}

export function Chip({ selected, onClick, children, ariaPressed }: { selected: boolean; onClick: () => void; children: ReactNode; ariaPressed?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ariaPressed ?? selected}
      className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-sm transition-colors ${selected ? 'bg-fl-ink font-medium text-white' : 'border border-fl-line bg-white text-fl-body hover:bg-fl-surface'}`}>
      {children}
    </button>
  )
}

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; id: string }>(
  function Field({ label, hint, id, className = '', ...input }, ref) {
    const hintId = hint ? `${id}-hint` : undefined
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-medium text-fl-body">{label}</label>
        <input ref={ref} id={id} aria-describedby={hintId} className={`min-h-[52px] w-full rounded-field border border-fl-line bg-white px-4 text-base text-fl-ink placeholder:text-fl-muted ${className}`} {...input} />
        {hint && <span id={hintId} className="text-xs leading-[1.7] text-fl-muted">{hint}</span>}
      </div>
    )
  },
)

export function NatureImage({ src, alt = '', className = '', position }: { src: string; alt?: string; className?: string; position?: string }) {
  // 幅の指定（w-…）がなければ横いっぱいに広げる
  const width = /(^|\s)w-/.test(className) ? '' : 'w-full'
  return <img src={src} alt={alt} aria-hidden={alt ? undefined : true} loading="lazy" decoding="async" className={`block object-cover ${width} ${className}`} style={position ? { objectPosition: position } : undefined} />
}

export function BackHeader({ to, title, right, sticky }: { to: string; title: ReactNode; right?: ReactNode; sticky?: boolean }) {
  return (
    <header className={`fl-back-header flex items-center gap-2 border-b border-fl-line bg-fl-canvas px-3 py-1.5 ${sticky ? 'sticky top-0 z-20' : ''}`}>
      <Link to={to} aria-label="もどる" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-fl-surface"><IconBack /></Link>
      <div className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</div>
      {right}
    </header>
  )
}

export function PlainHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="fl-masthead flex items-center justify-between border-b border-fl-line px-5 py-1.5">
      <Link to="/" className="fl-wordmark flex min-h-[44px] items-center text-[13px] font-medium tracking-[0.3em]"><FateMark />FATE LAB</Link>
      {right}
    </header>
  )
}

export function ListRow({ to, title, sub, leading, trailing }: { to: string; title: ReactNode; sub?: ReactNode; leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-[64px] items-center gap-3.5 border-b border-fl-line py-2 hover:bg-fl-surface/40">
      {leading}
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium leading-normal">{title}</span>
        {sub && <span className="text-xs text-fl-muted">{sub}</span>}
      </span>
      {trailing ?? <IconChevron size={16} className="text-fl-muted" />}
    </Link>
  )
}

export function Footer() {
  const link = 'flex min-h-[40px] items-center text-fl-body hover:text-fl-ink'
  return (
    <footer className="mt-12 flex flex-col gap-3 border-t border-fl-line px-6 pb-10 pt-6">
      <span className="text-[12px] font-medium tracking-[0.3em] text-fl-ink">FATE LAB</span>
      <nav aria-label="サイトの情報" className="grid grid-cols-2 gap-x-4 text-xs">
        <Link to="/terms" className={link}>利用規約</Link>
        <Link to="/privacy" className={link}>プライバシーポリシー</Link>
        <Link to="/tokushoho" className={link}>特定商取引法に基づく表記</Link>
        <Link to="/support" className={link}>お問い合わせ</Link>
        <Link to="/sales-conditions" className={link}>販売予定条件</Link>
        {import.meta.env.VITE_ROUTER === 'hash' && <Link to="/demo" className={`${link} text-fl-slate underline`}>画面一覧（確認用）</Link>}
      </nav>
      <span className="text-[11px] text-fl-muted">運営：温齋株式会社</span>
    </footer>
  )
}

/** 画面の見出し（全画面で同じ大きさ・余白にそろえる） */
export function PageTitle({ children, lead, className = '' }: { children: ReactNode; lead?: ReactNode; className?: string }) {
  return (
    <section className={`fl-page-title flex flex-col gap-2.5 px-5 pb-2 pt-7 ${className}`}>
      <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{children}</h1>
      {lead && <p className="m-0 text-sm leading-[1.85] text-fl-body">{lead}</p>}
    </section>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="fl-root">
      {/* スマホは全面、パソコンでは中央の一枚の紙のように見せる */}
      <div className="fl-sheet relative mx-auto min-h-screen max-w-app bg-fl-canvas sm:border-x sm:border-fl-line sm:shadow-[0_0_48px_rgba(20,22,20,0.05)]">{children}</div>
    </div>
  )
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return <p className="m-0 text-xs leading-[1.8] text-fl-muted">{children ?? '暦の計算に基づく読みものです。出来事や結果を約束するものではありません。'}</p>
}
