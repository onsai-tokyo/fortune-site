# Build 134 — feedback on build 133

## Changes
- Settings: the entire membership summary is black with white text and a white status badge. Copy and status placement retained.
- Settings: active/canceled-but-unexpired members can open “月額・年間プランを見る”. Both plans can be compared; changes/restarts open Apple's subscription management. Nonmembers retain the purchase flow.
- Plan comparison explicitly follows the selected segment instead of overriding monthly details with the user's current annual entitlement. Privacy link also opens the native legal view.
- Native legal document typography, section spacing, and the AI disclosure card improved. Legal text/resources unchanged.
- User explicitly chose first-use AI consent on this turn. The composer now shows only a terms link and the normal “鑑定する” action. Before the first send, a native consent sheet identifies Anthropic and all shared data for books and questions. Acceptance is scoped to account + disclosure revision on this device. Cancel/swipe dismissal sends nothing. After accepting, continuation waits for dismissal before generation/purchase flow. Subsequent sends and retries verify acknowledgement; account changes invalidate pending continuations. A reinstall/new device or new disclosure revision asks again.
- Server acknowledgement/header remains the existing accepted disclosure scope; backend entitlements, generation, and reading logic were not changed.

## Remaining external limitation
The “FATE / LAB” wrap occurs in Apple's subscription-management screen. The prior NBSP name correction is saved in App Store Connect for the next App Store version. A TestFlight binary alone does not establish its propagation; this is not marked fixed on-device. No additional metadata or App Review submission performed.

## Validation
- 4 focused tests pass: native legal resources, partner report reuse, explicit consent/first-use persistence/cancellation, and account/revision isolation.
- Simulator visual checks: consent sheet, simplified composer, AI terms section. Screenshots outputs/build134-{consent,compose,terms}.png.
- Release archive succeeded. TestFlight upload succeeded at 2026-10-12 01:41:59 JST (outputs/build134-upload.log); Apple processing remains separate from upload completion.
- No live AI calls or purchases were executed for validation.
