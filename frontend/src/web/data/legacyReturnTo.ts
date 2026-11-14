import { safeReturnTo } from '../../lib/safeReturnTo'

/** Login can return only to a read-only legacy report, never checkout/create. */
export function legacyReturnTo(value: string | null): string {
  const safe = safeReturnTo(value, '/')
  const path = new URL(safe, 'https://return.invalid').pathname
  if (!/^\/(r|reading)\/[^/%]+$/.test(path) || /^\/reading\/(new|history)$/.test(path)) return '/'
  return path
}
