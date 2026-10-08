/** Agreed paid boundaries. IDs are domain identifiers, never list positions. */
export const READING_ACCESS_POLICY_VERSION = 'all-cards-free-20261008-v1'
export const FIRST_PAID_YEAR = 2027
export const PAID_COMPATIBILITY_IDS = new Set(['compat-v24-5', 'compat-v24-6', 'compat-v24-7'])
export type ReadingOffer = { kind: 'compatibility'; item: string } | { kind: 'year'; scope: 'self' | 'couple'; year: number }
export interface AccessCard { id: string; kind: string; tab?: string; scope?: string; period?: { label: string } | null }
export function readingOffer(card: AccessCard): ReadingOffer | null {
  return null // All existing self, couple and timeline readings are free.
}
export function offerKey(offer: ReadingOffer): string {
  return offer.kind === 'compatibility' ? `compatibility:${offer.item}` : `${offer.scope}:year:${offer.year}`
}
/** No client membership flag or price can authorize disclosure. */
export function canReadOffer(offer: ReadingOffer | null, verifiedMembership: boolean, ownedKeys: ReadonlySet<string>): boolean {
  return offer === null || verifiedMembership || ownedKeys.has(offerKey(offer))
}

/** Safe wire projection. A fresh allowlist prevents future internal fields leaking
 * through locked cards. Callers must also remove raw report text and gate other
 * endpoints before enabling paid access. This helper alone is not a paywall. */
export function projectReadingCard<T extends AccessCard & { title: string }>(card: T, verifiedMembership: boolean, ownedKeys: ReadonlySet<string>) {
  const offer = readingOffer(card)
  if (canReadOffer(offer, verifiedMembership, ownedKeys)) return { ...card, access: { locked: false } }
  return {
    id: card.id, kind: card.kind as T["kind"], tab: card.tab as T["tab"], scope: card.scope as T["scope"],
    title: card.title, period: card.period ?? null,
    summary: '', tags: [], pages: [], sections: [], evidence: [],
    access: { locked: true, offerKey: offerKey(offer!) },
  }
}
