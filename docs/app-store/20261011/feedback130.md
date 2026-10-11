# Build 130 — compose and feedback polish

- Compose: removes the bottom safe-area inset. Credits, disclosure, create button and membership link now scroll with the form, preserving every disclosure and purchase continuation action.
- Loading: replaces the lower indeterminate spinner with a light moving along the central FATE LAB logo ellipse. Real operation percentages remain. Reduce Motion pauses the orbit.
- Birth time: preserves information and nil/selected-time behavior while grouping the optional wheel and separating the skip explanation.
- Account feedback ADRCM_XJuzdNhFjncL7ZusU: screenshot showed restore invitation, not premium status. Existing local StoreKit entitlement detection spans the Apple account, while server access is scoped to the FATE LAB account. Clarifies this distinction and removes promise that another account can restore successfully. No entitlement transfer or billing logic changed.
- Loading feedback AJHuoJdkBmhhfEF8jztmTTU, build 128 at 20:09 JST reviewed.

Verification: simulator build and Release archive passed; compose input area, birth-time screen, and loading preview visually inspected. Archive version/privacy/debug-only exclusion checks passed. Upload log: outputs/build130-upload.log. Simulator previews use synthetic data; real iPhone validation remains with TestFlight.
