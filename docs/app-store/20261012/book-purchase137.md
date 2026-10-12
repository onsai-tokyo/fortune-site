# Build 137 — membership before book creation

Owner decision: even a first-time nonmember with a legacy trial credit opens the subscription paywall when tapping 鑑定する. After verified purchase, resume the exact consultation. Existing book access is preserved.

- Composer opens the membership sheet directly for a known nonmember. Persist source, theme, question (including newlines), focused card and title in account-scoped Keychain storage before presenting purchase UI. Restore this draft separately from pending server orders, so restoring alone never consumes a credit.
- On successful membership/credit verification, close the sheet and resume the captured consultation once. The first-use AI consent gate runs before transmission; cancelled purchases do not generate. Account changes invalidate in-memory purchase continuation.
- Server rejects new nonmember orders with BOOK_MEMBERSHIP_REQUIRED before generation or credit consumption. Already accepted idempotent retries remain accessible, including after expiry. Nonmember status reports zero usable credits and no longer issues a trial; member trial synchronization retains existing anti-stacking rules. No purchase history or completed books are deleted.
- Members may still purchase an extra book after their plan allocation is exhausted. Plan prices and monthly/annual quantities are unchanged.
- Remove current free-trial offer copy from the purchase information and web/native terms.

Validation: 8 iOS tests passed (purchase continuation, draft round trip, consent, onboarding regressions); 30 book backend tests passed, including nonmember rejection despite credits, unknown membership, zero credits, member success and post-expiry retry. Production safety checks and backend/frontend builds passed. Final Release archive includes updated native terms.

Real Apple purchase confirmation and end-to-end iPhone transition require TestFlight 137. The automated tests do not perform a purchase or call paid generation.

No DB migration required. Deployment is the backend main branch plus TestFlight 137; until updating, older clients may surface the server membership error instead of the direct sheet.
