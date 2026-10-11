# Build 133 — feedback follow-up

## Implemented
- Native in-app terms and privacy pages with bundled copies of the current web document sections. The terms link in AI consent opens the AI consultation section. Settings and purchase links also stay in the app; no consent is granted merely by opening the page.
- Partner reading model belongs to the relationship hub, prefetches on entry, and reuses the loaded result across tab switches. Identity includes account epoch and conversation ID; late results cannot display across account/conversation changes. First entry still requires network access.
- Membership status badge restored to black with white text, preserving wording and layout.
- App Store Japanese name changed only at the FATE/LAB separator from regular space to nonbreaking space (U+00A0). App Store Connect saved successfully. Apple purchase-management rendering/cache refresh remains device verification, not guaranteed by the metadata save.

## Explained / retained
- Screenshot at 01:04 shows canceled annual access remains valid until Oct 12 15:06 JST, so registration up to ten partners is expected until expiry. Entitlements and limits were not altered.
- Kept a short explicit third-party sharing notice before sending. Full details are available in the new native terms page; disclosure was not hidden solely in terms.

## Validation
- Two focused iOS tests passed: partner report reuse/conversation isolation and complete native legal resources with sharing disclosure.
- Native terms opened from Settings in Simulator, showing text and Close control without Safari.
- Privacy: 12 sections/45 paragraphs; terms: 13 sections/52 paragraphs, copied from web sources without changing wording.
- Store metadata proof: outputs/build133-store-name.png.
