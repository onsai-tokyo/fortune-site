# Build 107: explicit external-AI permission

Before each consultation-book order or follow-up question, the iOS app explains Anthropic Claude API, purpose, information sent, partner information, and privacy policy. The switch starts off; cancel sends nothing. Account scope is checked again before sending. Web AI actions request equivalent explicit confirmation.

POST AI routes require `X-FateLab-AI-Consent: anthropic-2026-10-07-v1` and otherwise return 428 before work or credit consumption. Deterministic reading generation remains available without permission. This is request-level consent, not a persistent consent audit record. Reads and already accepted jobs retain their existing behavior.

Rollout: upload and verify build 107 first, then deploy backend and frontend. Older clients cannot submit new AI requests once enforcement is deployed; update to 107. Saved readings and non-AI calculations continue working. No database migration.

Validation:
- iOS: 133 tests, 2 skipped, 0 failures; signed Simulator build passed.
- Backend related checks: 23 passed; AI consent/browser fetch checks: 8 passed.
- Backend and frontend builds passed.
- Simulator: consent off disables send; consent on enables it (DEBUG-only preview, no external request).
- Reviewer account login, initial profile setup and reading display succeeded; survives app restart. Synthetic profile: 1996-10-07, Tokyo, female, unknown birth time. User accepted initial terms.
- Reviewer account book credits: 0. Live book creation and StoreKit purchase remain unverified for this account. Do not claim review readiness from UI previews alone.
