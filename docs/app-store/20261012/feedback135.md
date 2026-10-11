# Build 135 — simplify member controls

Two feedback items on build 134 (Oct 12 around 01:45–01:47):
- Replace the Settings membership sparkle with a verification-style check badge. Show member plan comparison as a normal Settings row, preserving the nonmember CTA.
- Simplify the member plan sheet's competing controls.

## Changes
- Settings uses `checkmark.seal.fill`; black card, white copy, and white cancellation/status badge preserved.
- Active members' plan link uses the same row layout as subscription management. Nonmember primary button is unchanged.
- Member plan sheet uses a compact status label instead of the second black banner, omits the redundant introductory tagline, places the single manage/restart CTA after plan details, and removes the duplicate restore control from this member sheet. Restore remains in Settings and the nonmember purchase sheet.
- Monthly/annual comparison, pricing, entitlements, purchase operations, consent, and generation logic are unchanged.

## Validation
- Debug build succeeded. Simulator: Settings row opens the sheet; monthly shows 1,980 yen / 3 books, annual shows 12,000 yen / 5 books; one member action below details; legal links retained.
- UI-only DEBUG preview uses an unbound sample member and disabled StoreKit; no live purchase or account update performed.
- Visual artifact: outputs/build135-plans.png.
- Release build/upload logs: outputs/build135-{archive,upload}.log.
