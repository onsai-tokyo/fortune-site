# Build 132 — feedback follow-up

- Settings uses 月額会員 / 年間会員 based on verified purchase metadata.
- Reading status exposes only active Apple subscription lineage, product and environment for the authenticated account. Access authorization remains unchanged.
- StoreKit renewal display matches this server-owned lineage, including after explicit Sandbox ownership restoration. It never uses a different lineage or environment. Older servers retain the original account-token fallback.
- Removed the redundant 鑑定書について disclosure section per feedback; shortened inline data-sharing copy while retaining recipient, shared inputs and explicit consent.
- No pricing, grant quantities, expiry, reading content or ownership transfer rules changed.

Validation: 6 backend tests and 4 iOS membership-display tests passed. Backend build and Release archive succeeded. Device verification of Apple cancellation status remains necessary.

Apple 5.1.2 requires clear third-party AI disclosure and explicit permission; placing all disclosure only in terms was not implemented.
https://developer.apple.com/jp/app-store/review/guidelines/
