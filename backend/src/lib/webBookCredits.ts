export type WebGrant = { source: string; starts_at: string; expires_at: string | null; ai_book_credits: Array<{ consumed_by: string | null; recovery_until: string | null }> }
/** The Web namespace cannot spend Apple/member/review/trial credits. */
export function countAvailableBookCredits(grants: WebGrant[], now = Date.now()) {
  let remaining = 0
  for (const g of grants) {
    if (g.source !== 'web' || !Number.isFinite(Date.parse(g.starts_at)) || Date.parse(g.starts_at) > now) continue
    for (const credit of g.ai_book_credits ?? []) {
      const end = g.expires_at === null ? Infinity : Math.max(Date.parse(g.expires_at), credit.recovery_until ? Date.parse(credit.recovery_until) : 0)
      if (!credit.consumed_by && end > now) remaining++
    }
  }
  return { remaining, purchasedRemaining: remaining, memberRemaining: 0, memberExpiresAt: null }
}
