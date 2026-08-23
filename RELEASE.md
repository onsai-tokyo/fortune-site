# FATE LAB release procedure

1. Increment `CURRENT_PROJECT_VERSION` in `ios/project.yml`. Never edit the generated
   `ios/FateLab.xcodeproj/project.pbxproj` by hand.
2. Run `cd ios && xcodegen generate` and confirm the generated project contains the
   same build number.
3. Run the backend test/build and an iOS Release build.
4. Archive from Xcode and generate the Privacy Report. Confirm the UserDefaults
   declaration uses reason `CA92.1`.
5. Confirm the Release binary does not contain `sample@fate-lab.com` or screenshot
   gallery symbols.
6. Upload the archive, complete the TestFlight launch checklist, then submit the
   selected build and its first subscription together for review.

Required production setup before the release candidate:

- Apply `backend/supabase/apple_sign_in_tokens_launch.sql`.
- Configure `APPLE_TEAM_ID`, `APPLE_SIGN_IN_KEY_ID`, and
  `APPLE_SIGN_IN_PRIVATE_KEY` on Render. Never commit the `.p8` contents.
- Configure App Store Server Notifications V2 to POST to
  `https://fortune-site-iuzo.onrender.com/api/apple/notifications`.
- Keep `REQUIRE_READING_AUTH=true` and `DETERMINISTIC_SCOPE` empty for the first
  launch.
