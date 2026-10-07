# Book reliability and presentation — build 117

## Evidence

Recording: ScreenRecording_10-08-2026 01-19-00_1.MP4. The reported book was accepted at 01:24:02 JST on October 8, failed at 01:27:15 after three attempts, and its credit was returned (three current-period credits unconsumed). Original logs omitted the underlying errors.

A diagnostic using the same saved question/source snapshot reproduced BOOK_DOCUMENT_HIGHLIGHTS in 60.455 seconds. A second diagnostic removing invalid optional highlights passed full document validation in 62.265 seconds, using claude-sonnet-5. Neither diagnostic modified books or credits. Original historical errors cannot be reconstructed, so this is a reproduced failure path rather than proof of every original attempt's error.

The stored reunion card has correct tags and couple scope. Locked-card projection removes tags intentionally, and the previous iOS fallback displayed あなたについて.

## Changes

- ID-based category labels for locked couple cards, shared with purchase labels.
- Immediate preparation screen, before network waits. Remove repeated StoreKit reconciliation and duplicate prevalidation for existing members; retain validation before nonmember checkout.
- Accepted jobs remain server-owned, with clear guidance that other pages and app closure do not stop generation. Preparation does not promise acceptance before the server acknowledges it. No fabricated percentage.
- Failed compositions retain their question and offer the same draft. Failure text distinguishes policy refusal from system failure.
- Invalid optional highlights are dropped; exact matching highlights retained/deduplicated. Body, quotes, evidence and content validation are unchanged. Existing field limits are also supplied in the model tool schema.
- Allowlisted failure category, timing, attempt and safe request ID logged; no question, prose, credentials or raw provider payload. Public API returns only a sanitized failure code.
- Transient retries back off 30/60 seconds within the existing three-attempt limit. Billing/auth failures pause new generation through ai_book_settings.enabled=false and refund the active failed book through the existing fenced RPC. Queued books remain saved. Apple reconciliation continues. After resolving provider billing/configuration, an operator must explicitly re-enable generation. No automatic top-up configured.
- Explicit diagnostic CLI reads one failed book without changing its state or consuming credits. Provider requests are billable; do not run repeatedly without a reason.

## Validation

- 29 backend book tests passed: highlight regression, unchanged prose/evidence, metadata redaction, error classification/backoff and membership enforcement.
- 13 iOS tests passed: 9 delivery, 3 membership continuation, 1 category test covering three locked cards.
- Actual create-button tap in the DEBUG Simulator composition fixture immediately switched to preparation. This tests rendering, not authenticated checkout/creation end to end.
- Live provider diagnosis passed as above, without publishing a book. Physical TestFlight end-to-end confirmation remains necessary.
- Deployment and archive status recorded separately in release artifacts. No App Review submission. Failed books are not silently re-run.
