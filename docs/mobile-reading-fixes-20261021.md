# Mobile reading fixes — 2026-10-21

Scope: Web only. No backend/iOS edits, SQL, production connections, push or deployment.

## Reported screenshots

1. Mountain moved from a standalone image into the hero background, with a light gradient for text contrast.
2. Top/onboarding birthday now has separate year/month/day selectors. Impossible dates and future dates cannot submit. Web input/select widths are constrained, including date/time controls.
3. Timeline example now uses responsive HTML with three years, tags and explanatory paragraphs. It is explicitly a fictional example, not a personal result.
4. AI copy explains independent reading data/calculations and balanced, direct answers as the service's aim. No unverified catalogue count or accuracy guarantee.
5. Real SSE progress now advances the three stages. Previously `pending` stopped the demo timer without receiving actual progress; stage one could remain displayed throughout. HTTP generation is limited to 120 seconds, saving to 30 seconds. Redundant divination preflight removed because the generator computes its own chart.
6. Missing-reading screen provides a saved-status check and a route back to birth information. Pending generation ID and input remain in user-scoped sessionStorage across reloads. Retrying the same input checks the generation status first; completed results are saved without repeating generation. Failed status clears that operation for the next explicit attempt. Pending/unknown status does not regenerate. Logout/deletion clears the current user's pending entry.
7. Top readiness now requires actual loaded years and chapters, rather than merely a birth profile. Missing results show a recovery panel instead of claiming the reading is prepared.

## Verification

- Frontend build and synthetic REMOTE build passed; existing large-chunk warning remains.
- Frontend unit suite: 125 passed. Added impossible-date validation and streamed-progress/completion/error tests.
- Existing mock-e2e six scripts (journey, guest, logic, bugs, probe3, crawl) passed without reported page errors.
- Responsive UI tests at 320, 390, 1280 pixels passed, including field containment.
- `reading_recovery.py`: synthetic REMOTE, every external request intercepted. Lost generation response → reload → recovered birth input → GET completed result → save → read. Exactly one generation POST, one status GET and one save. Empty results offer recovery and are not advertised as ready.
- Local 390px full-page screenshot visually inspected.

## Limits

Actual production failure cause is not proven from screenshots; no production logs inspected. The fixes address confirmed client behavior, not a claim that a backend failure is resolved.
Real iPhone Safari testing remains (only Chromium mobile-sized tests were available locally). No actual user's registration/generation was run.
Changing input while a different operation is unresolved is not automatic recovery of that earlier input. Session storage is tab-scoped, not cross-device recovery.
Production rollout requires approval and a post-deploy device check; current production is unchanged.
