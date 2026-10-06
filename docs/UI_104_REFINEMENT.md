# UI refinement — build 104

## Direction

Preserve the existing ivory canvas, orbit logo, nature photography, mountain mist and cosmic welcome screen. Improve editorial hierarchy without changing reading content, calculations, entitlement checks or pricing.

## Changes

- Shared 24pt screen gutter, 20pt card inset and 16pt button shape. Hero copy has stronger contrast and explicit multiline sizing.
- Nature cards have more breathing room and a lighter middle gradient; text remains white on a darkened photograph.
- Reading detail uses a single paper surface, subtle mountain wash, left-aligned 24pt scalable title, section divider and less decorative bottom padding. Existing chapter navigation and question action remain.
- Annual tags use muted rose, slate, moss, ochre and dusk tones.
- Charts use white bordered surfaces; chart grids collapse to one column at accessibility text sizes.
- Login logo has a quiet circular surround; social buttons match the shared corner radius. Apple sign-in remains the native component.
- Bookshelf status labels are small capsules; covers retain their spine and gain a softer dimensional shadow.
- Settings membership statistics have a separate inset surface; membership explanations are grouped into three feature cards.
- Profile selection sheets, consent forms and chat bubbles use the same palette and surface treatment.
- Composer panels and reader artwork use the common radius. Loading uses a subtle ivory gradient. Onboarding respects Reduce Motion.

## Coverage

Source review includes welcome/authentication, onboarding, self/couple reading lists and details, annual timelines, charts, profile/partner registration and editing, bookshelf, consultation composition and delivery, chat/history, settings, purchase sheets and loading/error/empty states. Shared components propagate the refinements to their callers.

Verified on iPhone 17 Pro Max simulator: reading list, reading detail, timeline, login, partner selection, profile, onboarding, bookshelf covers, consultation composer, delivered consultation, membership sheet, settings and loading. Reading detail and profile also inspected at accessibility-large; simulator returned to large afterward.

- Final iOS test suite: 131 tests, 2 pre-existing skips, 0 failures.
- Release archive: succeeded.
- Actual Apple purchase transaction: not performed.
- No backend or database changes.

 Preview data is synthetic where possible; preview layouts do not replace production navigation. No purchases, profile saves or manuscript edits are part of this UI change.
