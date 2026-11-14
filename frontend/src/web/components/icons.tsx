// 線のアイコン（装飾用。意味のあるボタンには aria-label を付ける）
import type { ReactNode } from 'react'

type P = { size?: number; className?: string; strokeWidth?: number }

function Svg({ size = 20, className, strokeWidth = 1.8, children }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  )
}

export const IconMenu = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const IconBack = (p: P) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>
export const IconChevron = (p: P) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
export const IconDown = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
export const IconPen = (p: P) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></Svg>
export const IconPeople = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.2" /><circle cx="16.5" cy="9" r="2.6" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M15 14.6c3 0 6 1.8 6 5.4" /></Svg>
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
export const IconAlert = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5v.01" /></Svg>
export const IconRefresh = (p: P) => <Svg {...p}><path d="M21 12a9 9 0 11-3-6.7" /><path d="M21 4v5h-5" /></Svg>
export const IconSend = (p: P) => <Svg {...p}><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></Svg>
export function IconBookmark({ filled, ...p }: P & { filled?: boolean }) {
  return (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true" className={p.className}>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  )
}
export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 01-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0012 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 010-4.6V6.6H1.3a12 12 0 000 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 001.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  )
}
