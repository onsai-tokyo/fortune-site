# Build 131 — TestFlight feedback (2026-10-12)

## Changes

- Free-plan partner registration uses the server's partner limit to open the membership sheet. Stale local purchase state no longer disables that route. A successful purchase reloads the limit before resuming registration.
- Settings distinguishes access from auto-renewal: `会員資格あり`, an explicit cancellation notice when verified, and a neutral explanation when renewal status is unknown. The active membership header uses a subtle landscape and more spacing.
- Sandbox restore now transfers the existing member-credit grants after the verified subscription lineage changes owner. It preserves consumed slots and period boundaries. Production ownership rules are unchanged.

## Incident and repair

The affected Sandbox subscription had moved accounts but its 12 annual grant windows remained revoked under the former account. This produced active membership with zero usable credits. The new migration was applied in production and `ai_book_sync_member` was run for the affected account. Current-window verification returned 5 available and 0 consumed credits. No expiration date or consumed slot was reset.

The renewal notice is still intentionally unknown when StoreKit's appAccountToken belongs to the previous account; the UI must not infer cancellation or auto-renewal from that token mismatch.

## Validation

- Annual-credit regression suite: 15 assertions, including owner transfer, preservation of consumption, repeated sync, repair of previously broken transfers, and refund handling.
- Debug simulator build and Release archive succeeded.
- Release archive: build 131, production API, authentication required.
- Guest settings smoke check in simulator succeeded. Real-device StoreKit purchase and transferred-account UI remain to be checked in TestFlight.
- Credit-repair proof: `outputs/build131-credit-repair.png`.

No App Store review submission was performed.
