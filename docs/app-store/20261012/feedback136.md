# Build 136 — initial profile consistency

Three TestFlight reports on build 134, 2026-10-12 15:48–15:49:
- Initial entry form layout and missing step-by-step onboarding.
- Unlabelled relationship-status menu.
- Old nickname still shown under the self icon in Couple after the recording data reset.

The server reset removed saved readings, but account-scoped defaults still contained the completion flag and birth profile. RootView used the flag to skip onboarding; Couple independently used the local draft nickname.

Changes:
- After server status/history confirm no saved self reading, check timeline profile before resetting completed local onboarding. Preserve unfinished onboarding drafts, pending generation/save operations, other accounts, and purchase storage. Network failures do not clear defaults.
- Couple uses the saved self reading's name and displays “あなた / 未設定” when absent, instead of presenting a local draft as a registered profile.
- Explicit relationship-status heading, purpose and optionality; menu choices and underlying calculation values unchanged.
- Add spacing below the input hero, remove double card padding and unnecessary bottom spacer. Existing artwork remains.

Validation:
- Four Feedback134Tests pass, including two reset/recovery regression tests.
- Debug and Release builds succeeded.
- Simulator: initial step 1/6 visible; input form scrolls to relationship-status heading/explanation above CTA, and menu opens correctly. DEBUG-only preview routes do not generate or purchase.
- Screenshots: outputs/build136-input.png. Logs: outputs/build136-{test,archive,upload}.log.
- iPhone 14 / iOS 18.7.8 confirmation remains on TestFlight after updating from 134 to 136.
- No backend deployment or additional production data reset.
