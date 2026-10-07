# Membership purchase backlog — build 116

## Evidence

The user recording `ScreenRecording_10-08-2026 00-47-11_1.MP4` shows the Settings paywall opening normally. Pressing its monthly purchase button briefly starts work, then returns to the same nonmember state without Apple checkout.

A read-only production journal query on 2026-10-08 established that the two recorded requests (00:50:00 and 00:50:09 JST) mirrored different historical Sandbox subscription transactions, expired on October 2 and October 1 respectively. A later request at 00:58:51 mirrored a September 30 expiry. The account projection remained expired. No secrets or signed receipts were exported.

The old purchase handler treated every verified subscription transaction as the end of the user action, including expired unfinished renewals returned by StoreKit. Each press therefore acknowledged one historical transaction and silently stopped.

## Change

After a verified monthly transaction is durably delivered to the server and finished in StoreKit, continue the same explicit purchase action only when its expiry predates the start of that action. Do not retry current purchases, revoked/upgraded transactions, cancellation, pending approval, verification/delivery failure, or account changes. Detect repeated transaction IDs and limit processing to 32 attempts. Current purchases are still verified against server membership before completing the UI action. Never automatically restore or clear the user's purchase history.

The paywall displays progress during backlog cleanup and explains cancellation or a delivered purchase without active membership. Single-card and extra-book purchase logic is unchanged. Existing book membership continuation still waits for server-confirmed membership and available credits.

## Validation

- 19 iOS tests passed (7 purchase-flow regression tests, 9 delivery tests, 3 book membership continuation tests).
- Regression cases include multiple historical renewals followed by a valid purchase, no extra purchase after success/cancellation/pending, delivery failure, repeated ID, bounded backlog, account cancellation, and expiration after the user action (must not trigger another charge).
- The regression tests exercise the orchestration with injected outcomes, not an actual Apple checkout. The user's physical TestFlight purchase must still confirm that StoreKit opens checkout after its historical queue is drained.
- Release archive/upload status is recorded with the release artifacts, separately from this source QA note.
