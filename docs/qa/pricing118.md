# Books-only pricing — build 118

## Accepted scope

All deterministic self/couple/timeline cards are free, including previously paid compatibility sections and years from 2027. AI books: first one free; subsequent single purchase JPY 980; subscription JPY 1,980 with three books per billing period. Partner limits remain 1/10. Delivered books remain readable after subscription expiry.

## Implementation

- Card projection no longer requires subscription or receipt database availability. Historical verified purchase/refund delivery is preserved. Legacy purchase requests first obtain unlocked content and therefore do not buy a new card. Authoritative original-snapshot validation at save time remains enabled.
- New trial RPC issues one credit for a verified email identity, with an atomic unique claim. A private purpose-specific random secret protects the SHA-256 identity fingerprint; the claim has no user foreign key and survives account deletion. Plain email, question and chart are not stored in that ledger. This stops reuse of the same email, not a person using multiple different verified addresses.
- Free credits are separately presented and spent before subscription/purchased credits. Existing fenced order/refund machinery handles concurrency and failed generation. No subscription is required to spend valid credits. Zero-credit requests return a payment-required response.
- Composition offers a single purchase or monthly plan, retains the draft, and resumes after verified purchase/dismissal. Owner changes cancel continuation. StoreKit's actual product price is displayed; no hardcoded JPY 980 label can conceal an old store price.
- Terms/privacy copy describes free cards and the minimal anti-abuse ledger.

## Release prerequisites / order

1. Run database regression tests against a disposable local PostgreSQL, including concurrent grant/spend, refund, unverified email and deletion/re-registration.
2. Apply `backend/supabase/ai_books_trial_20261008.sql` before the API deploy. Do not replay this migration; existing purchases are not deleted.
3. Update the existing AI book consumable `com.onsai.fatelab.report.single` to JPY 980 in App Store Connect. Stop new sales of legacy card consumable if the console permits; continue historical transaction handling.
4. Deploy backend and website; confirm runtime revision and both worker/API readiness.
5. Upload build 118 and verify TestFlight availability. No App Review submission is authorized by this change.
6. Physical Sandbox QA: initial free creation; second request opens both offers; cancelled purchase preserves draft; purchased slot resumes exactly once; monthly purchase resumes; leave/reopen during generation; delivered book remains accessible after expiry.

Current account deletion removes the original grant/book, but the minimal identity claim prevents a new free grant. Do not silently refund or convert historical card purchases. Existing unused card credits require an explicit migration/support decision if they exist in Production; audit before release.

## Validation status

Backend book suite: 29 passing. Reading-access suite: 7 passing. Local database suite includes the new concurrent trial and re-registration cases. iOS selected purchase/continuation tests and backend/frontend builds passed. Release archive, store-price change and production migration/deployment are tracked separately; local validation is not evidence of a production cutover.
