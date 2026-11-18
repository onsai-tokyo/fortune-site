import type { CouponOffer } from './couponOffers'
export function checkedAtLabel(value: string): string
export function couponCheckSummary(offers: readonly CouponOffer[]): { count: number; latest: string; unchecked: number }
export function warnStaleCouponChecks(offers: readonly CouponOffer[], options: { today: string; warn?: (message: string) => void }): void
export function couponPageMetadata(offers: readonly CouponOffer[]): { title: string; description: string; heading: string }
export function couponComparisonHtml(offers: readonly CouponOffer[], relatedLinks?: readonly { href: string; label: string }[]): string
