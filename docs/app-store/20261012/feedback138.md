# Build 138 — 2026-10-12 TestFlight feedback

## Feedback and changes

Three build136 screenshots received at 17:37–17:39 JST:

1. Membership purchase left a generic verification error.
2. First-use terms should be a compact window with a checkbox.
3. Membership selection should offer monthly/yearly plans and omit the prominent restore action.

The paywall now leads with “鑑定書の会員プラン”, two selectable plan cards, actual StoreKit price/currency and monthly book allowances. Large promotional art, duplicate price/benefit sections and the regular restore button were removed from this surface. Restore remains in Settings. When verification has failed, an explicit recovery action can still reflect an existing purchase without buying again. Consultation drafts remain displayed and retained.

The consent sheet is a 620-point sheet expandable to full height, with scrollable conditions and an initially unchecked agreement control. Continue stays disabled until checked. Provider/data disclosure, full terms link and account-scoped first-use continuation remain intact.

## Purchase failure evidence

Read-only production journal inspection showed, for the same Sandbox transaction:

- 2026-10-12 08:36:32 UTC: Apple notification mirrored to the previously stored lineage owner.
- 08:36:34 UTC: appreview verification returned `owner_mismatch`; request owner and signed account token both identified appreview, while the stored lineage still belonged to the other test account.
- Neither event had a SQL application error.

Native automatic delivery persists a pending event with `allowOwnerTransfer=false`. Explicit purchase/restore reused that pending event and operation ID, so its intentional Sandbox transfer was never authorized and the server replayed the denied result.

Fix: an explicit purchase/restore waits for any automatic delivery of that same account/transaction to settle. If a non-transfer pending event remains, it persists a transfer-authorized event with a fresh operation ID before verification. Retries preserve that ID. Automatic sync/update never upgrades authorization. Server restrictions to Sandbox, signed verification and matching acknowledgement before StoreKit finish remain unchanged. No DB rows, membership dates or allowances were manually altered.

Existing build136 failures can be retried through “購入済みの会員情報を反映” or Settings restore after updating. Actual Apple checkout and purchase-to-book continuation still require a TestFlight device check; unit tests do not prove an Apple payment.

## Validation

- 19 targeted native tests passed (PurchaseDeliveryTests, BookMembershipContinuationTests, Feedback134Tests).
- New regressions cover denied automatic verification followed by explicit recovery, new operation identity, wrong-account isolation and concurrent delivery settlement.
- Simulator: unchecked consent disables Continue; checking enables it. Compact-sheet screenshot saved under outputs/feedback138/consent138.png.
- Release archive/upload status is recorded in outputs/build138-archive.log and outputs/build138-upload.log.

No backend deployment is required for these changes.
