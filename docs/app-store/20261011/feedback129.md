# Build 129: settings and inline disclosure polish

- Responds to build 128 feedback submitted around 20:04–20:05 JST.
- User selected shorter inline explanation with no additional consent screen.
- Shortens the Anthropic disclosure while retaining destination, data categories, linked terms, and the explicit consent action.
- Settings groups membership status, cancellation expiry, management and restore into consistent rows. Restore outcome is dismissible and no longer repeats expiry.
- Purchase and entitlement logic is unchanged. This does not change the Apple subscription expiration date.

Validation: Debug simulator build passed; guest settings and isolated inline consent preview visually inspected. Release archive/upload results are in outputs/build129-*.log. Signed-in real-device settings should be checked in TestFlight.
