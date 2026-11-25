# Content attribution verification — 2026-11-25

- Baseline: main `85862887ffa7bbe07a8162f62b43768e095a0768`.
- Target confirmed by Analytics Admin API: property 532634924, stream 14355610174, https://fate-lab.com/, G-FPZ7QKTXLJ. Spikatsu's property is separate.
- Six event-scoped custom dimensions created through GA4 UI and verified by Admin API. Existing two dimensions retained.
- Four-tab exploration created, signup-only tabs filtered with `^sign_up$`, shared read-only with existing property users. No new account or permission grant.
- Vercel Production environment names confirmed: GA4_API_SECRET, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY. Values were not downloaded or changed.
- Clean npm ci with updated lockfile; frontend production build and article checks passed. Existing >500 kB bundle advisory remains.
- Public-page/measurement unit suite: 73 passed. Final focused attribution/collector suite: 21 passed.
- Browser suite: 4 passed using built remote-mode app, actual Supabase SDK and isolated Chromium. All browser requests intercepted; Auth and GA responses mocked. No real account creation, email or production GA event.
- Browser assertions include tagged article → calculator input and result → email verification in another tab; one sign_up after verification; reloading and concurrent authenticated tabs; existing account OTP login suppressed; new acquisition resets entry/content; direct/reload preserve; slow Google tag; safe native-tag configuration and server payloads. Canaries for email, name, input birth date, result, hash, auth code and tokens are absent from GA payloads.
- Disposable local PostgreSQL 18: migration and Auth/RLS/anonymous/unconfirmed/baseline/upgrade checks passed. 24 concurrent claims: 1 true, 23 false. No production DB connected or modified.
- git diff --check passed.

Current public Web onboarding intentionally has no new-account signup. Guest reading completion remains separate from sign_up. This change prepares accurate verified-account collection without reopening signup. SQL application must precede collector rollout; deployment and production SQL were not performed in this PR task.
