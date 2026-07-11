# iOS Launch Experience: Branded Splash + Skeleton-First Optimistic Launch

Shipped 2026-07-11. Both slices merged to `main` in one session.

## Problem
Every cold launch showed a blank `Color(.systemBackground)` while `SessionStore.restoreSession()` blocked on a `/me` network round-trip to learn who the user is. The sequence was: blank OS launch screen -> blank screen for the length of a network call -> content. No branding, and the round-trip sat on the perceived critical path.

The prior 2026-06-28 slice already did the data-loading work (trimmed Home payload, `Launch` OSLog timings, thumbnail disk cache, SwiftData `GearCache`). This slice pair addressed the launch *experience* only.

## Slice 1 - Branded LaunchView (shipped)
- [x] New `ios/Wisconsin/Views/LaunchView.swift` reusing LoginView's brand gradient (`brandSplashTop -> brandSplashMid -> brandPrimary`) + `Image("Badgers")` wordmark + delayed spinner (>500ms), reduce-motion aware.
- [x] `RootView` (`WisconsinApp.swift`) renders `LaunchView()` instead of the blank background during `isRestoring`, with a reduce-motion-aware cross-dissolve keyed on `session.isRestoring`.
- [x] New `LaunchBackground` color asset (= `brandSplashTop`) wired into the main target's `UILaunchScreen.UIColorName` so the pre-SwiftUI first frame matches.
- [x] Registered `LaunchView` as `exempt-tiny` in `scripts/ios-audit-inventory.sh`.
- Counterpart to the kiosk's existing `KioskResumeSplash`. No data/nav/auth behavior change.

## Slice 2 - Skeleton-first optimistic launch (shipped)
- [x] `SessionStore` caches a lightweight `CurrentUser` snapshot in UserDefaults (`SessionSnapshot`); saved on `login()` / `restoreSession()` / forced-password completion, cleared on `logout()`, `clearDeletedAccountLocally()`, `.sessionDidExpire`, and confirmed 401.
- [x] `init()` synchronously seeds `currentUser` from the snapshot (when present and `!forcePasswordChange`) and flips `isRestoring = false`, so `RootView` renders `AppTabView` immediately. Home's existing skeleton (`HomeView.mainContent`, `dashboard == nil`) covers the data-load gap - no cached content shown.
- [x] `restoreSession()` validates `/me` in the background: success refreshes snapshot; `APIError.unauthorized` clears snapshot + bounces to Login; network failure keeps the optimistic session with the offline banner.
- [x] `WisconsinApp` currentUser `onChange` gains `initial: true` so the optimistic launch still fires push-registration / live-activity side effects that otherwise only run on the nil->user transition (no-op on the signed-out launch).
- [x] New `launch.session.optimistic` OSLog line for before/after timing.

## Design notes / decisions
- UserDefaults, not Keychain: the auth **cookie** in `HTTPCookieStorage` is the real credential and source of truth; the snapshot is only a UI hint. A reinstall wipes the cookie too, so `me()` would 401 and fall through to Login regardless. (Contrast kiosk D-039, which persists an actual session token.)
- Trust: no relational/content data (bookings, gear, reservations) is ever shown before the session is confirmed. Only the shell chrome and the device owner's own identity render optimistically; every API still enforces auth server-side.

## Verification
- `xcodegen generate` + `xcodebuild -scheme Wisconsin -destination 'generic/platform=iOS Simulator'` -> BUILD SUCCEEDED for both slices.
- `npm run drift:ios` (0 anti-patterns / 74 files) and `npm run audit:ios:gaps` (100% covered, 0 gaps).
- Launch timing observable via the `Launch` OSLog category: `launch.session.restore` (cold) vs `launch.session.optimistic` (returning), plus `launch.home.firstUsefulRender`.
