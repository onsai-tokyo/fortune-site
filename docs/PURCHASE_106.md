# Build 106: membership restore and settings

## Feedback
- Recreated FATE LAB accounts could encounter an Apple membership message when tapping the subscription purchase button.
- TestFlight build 105 feedback submitted 2026-10-06 22:47 requested a cleaner settings membership panel.

## Changes
- Existing active StoreKit entitlements use an explicit “購入を復元して利用する” primary action in settings and subscription sheets. Tapping it runs the existing restore flow instead of blocking the user or requesting a second purchase.
- Restore does not depend on product metadata being loaded, and ignores revoked/expired subscriptions.
- An existing Apple entitlement is no longer reported as a red sync error. Server verification remains authoritative; automatic background owner transfer is still prohibited. Existing Sandbox-only explicit transfer policy is unchanged.
- Settings prioritizes monthly price, included benefits and primary action. Detailed conditions remain in the disclosure; the short single-purchase summary remains visible. Currency disclosures remain intact.

## Validation
- iOS: 133 tests, 2 pre-existing skips, 0 failures.
- Backend architecture and Apple event tests: 27 passed / 10 failed. A clean HEAD snapshot produced the same 10 failing test names; no new failures.
- Simulator: authenticated settings screen inspected; screenshot outputs/membership106.png.
- Actual Apple restoration after deleting/recreating an account requires device verification in TestFlight. No live purchase or entitlement transfer was performed during development.
