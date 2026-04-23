# Wisconsin iOS App

Native SwiftUI app for gear.erikrole.com.

## Prerequisites

- Xcode 16+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`

## First-time setup

```bash
cd ios
xcodegen generate
open Wisconsin.xcodeproj
```

In Xcode:
1. Select the `Wisconsin` target → Signing & Capabilities
2. Set your **Team** to your Apple Developer account
3. Change **Bundle Identifier** if needed (`com.erikrole.creative`)

## Running on device

```bash
# Regenerate project after adding/removing files
xcodegen generate
```

Then build and run from Xcode (⌘R).

## TestFlight

1. Select **Any iOS Device (arm64)** as destination
2. Product → Archive
3. Distribute App → App Store Connect → Upload
4. In App Store Connect, add testers under TestFlight

## Architecture

```
Wisconsin/
  App/          — Entry point, root view
  Core/         — APIClient (URLSession), SessionStore (@Observable)
  Models/       — Codable models matching the API
  Views/        — SwiftUI screens
  Supporting/   — Info.plist (managed by XcodeGen)
```

## API

Talks directly to `https://gear.erikrole.com` using the same cookie-based session as the web app.
Authentication is shared — logging in on the app logs you in via the same session table.
