# Fate Lab iOS

SwiftUI + StoreKit 2 client for the existing Fate Lab API.

## Setup

1. Install XcodeGen and run `xcodegen generate` in this directory.
2. Add the production Supabase URL and publishable/anon key as Xcode build settings.
3. Set the Apple Developer Team in Signing & Capabilities.
4. Create the auto-renewable subscription `com.onsai.fatelab.premium.monthly` in App Store Connect.
5. Configure the App Store Server Notifications V2 URL as `https://fate-lab.com/api/apple/notifications`.
6. Add Apple root certificates and App Store identifiers to the backend environment variables documented in `backend/.env.example`.

Never put App Store private keys or Supabase service keys in this iOS target.
