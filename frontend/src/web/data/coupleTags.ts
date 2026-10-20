import type { CoupleYear } from './types'

/** Labels describe existing reading content, not a new predictive calculation. */
export function coupleTags(year: CoupleYear): string[] {
  const supplied = (year.tags ?? []).map(t => t.replace(/^#+\s*/, '').trim()).filter(Boolean)
  if (supplied.length) return [...new Set(supplied)].slice(0, 3)
  const tags: string[] = []
  if (/転機|大きく変わ/.test(year.title)) tags.push('転機')
  if (/関係.*動|関わり方.*変わ|新しい縁|縁が結ば/.test(year.title)) tags.push('関係が動く年')
  if (/ペース.*整|毎日.*大切|暮らし.*整/.test(year.title)) tags.push('日々を整える年')
  return tags
}
