# Build 109 — settings and terms-link presentation

User feedback on build 108 requested removal of duplicate plan details and the inline AI provider/data notice.

- Settings keeps the active-member banner, purchase/restore path, and expandable plan details; duplicate heading, price and benefit grid are removed.
- Native chat/book composers show only the linked sentence 「利用規約に同意した上での鑑定をお願いします。」 and 「鑑定する」 action (retry/plan/stop actions remain appropriate to state).
- The link opens /terms#ai-consultation. That section discloses Anthropic PBC/Claude API, purposes, book/chat-specific data, partner/input personal data, and per-request agreement by the action.
- No stored blanket consent, no inference from membership or signup, no automatic sending on opening terms. This is the user's requested linked-terms presentation, not the prior explicit inline third-party-AI notice.
- New header version terms-ai-2026-10-07-v2 distinguishes the presentation. Backend also accepts the existing v1 for older clients/Web. No global consent bypass.
- The user was told this presentation may need further changes in App Review. Do not claim it guarantees Apple's explicit AI-consent requirements.

Roll out the backend and public terms before the new app is used. Update review notes and filming instructions to reflect the actual UI; do not describe a switch or standalone consent screen.
