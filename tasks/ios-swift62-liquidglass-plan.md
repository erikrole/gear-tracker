# iOS Swift 6.2 + Liquid Glass Adoption Plan

**Status:** Draft (not started)
**Project:** ios/Wisconsin
**Current state:** Swift 5.10, iOS deployment target 17.0, zero Liquid Glass usage

## Why this is one bundle

Both changes require bumping the iOS deployment target. Doing them in sequence amortizes the cost of:
- Re-running every screen on a fresh OS baseline
- One TestFlight pass instead of two
- One App Store binary submission

But they ship as **separate slices** so each is independently revertible.

## Sliced execution

### Slice 1 — Bump deployment target to iOS 26 (¼ day)
- Per memory `project_ios_framework_plan.md`, this is the deferred prerequisite.
- Edit `IPHONEOS_DEPLOYMENT_TARGET = 17.0` → `26.0` in the Xcode project settings (or `project.yml` if XcodeGen — per memory `project_xcodegen.md`, regenerate after).
- Audit `@available(iOS 17, *)` annotations — most can be deleted.
- Build clean. Run on a real iOS 26 device or simulator.
- Acceptance: app launches, scan works, kiosk mode works, push registers.

### Slice 2 — Swift 6.2 Approachable Concurrency (½–1 day)
Swift 6.2 introduces single-threaded by default with explicit `@concurrent` for offload. This is a behavioral baseline change.

- Bump `SWIFT_VERSION = 5.10` → `6.0` (or `6.2` if the toolchain supports it pinned).
- Set `SWIFT_APPROACHABLE_CONCURRENCY = YES` and `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` per the Swift 6.2 single-threaded baseline.
- Address compiler errors as they surface:
  - Top-level functions that touch shared state need `@MainActor` (often already implied).
  - Network/disk I/O that ran on background QoS needs explicit `@concurrent` annotation OR moves into an `actor`.
  - `URLSession` callbacks already isolate properly — should not break.
- The 35 files using Task/MainActor today are the highest-risk surface. Audit them first.
- Use `swift build` warnings as a TODO list; do not silence them.
- Acceptance: app builds + runs identically. No new data race warnings under the strict checking that Swift 6 enables.

### Slice 3 — Liquid Glass adoption on Scan + Settings (½ day)
- Replace `.background(.ultraThinMaterial, in: Circle())` patterns in `ScanView.swift` and `ScanResultCard` with `.glassEffect(...)`.
- Apply Liquid Glass to:
  - Scan results card (lines 32-38 of `ScanView.swift`)
  - Floating search button (`FloatingSearchButton.swift`)
  - GlobalSearchSheet header
  - Bottom tab bar / nav chrome (if not already automatic on iOS 26)
- Test in light + dark + high-contrast accessibility modes.
- Per skill `liquid-glass-design`: avoid Liquid Glass on dense data tables; keep it for hero / interactive surfaces.

### Slice 4 — Liquid Glass on Kiosk surfaces (¼ day)
- Kiosk mode is landscape-locked, full-screen — perfect Liquid Glass canvas.
- Apply to `KioskPickupView` action buttons and confirmation modals.
- Avoid behind hot text (asset names, user names) — readability over flair.

### Slice 5 — Visual QA pass (¼ day)
- Walk every screen on a real device (iPhone 15+ ideally for proper Liquid Glass rendering — older devices fall back gracefully).
- Capture before/after screenshots for AREA_MOBILE.md.
- File any regressions as separate tickets — do not fix in this slice.

## Risks

- iOS 26 minimum cuts off any users still on iOS 17/18. Per memory the user base is small (UW Athletics staff with managed devices); confirm with the team before shipping.
- Swift 6.2 strict concurrency can surface latent data races that "happened to work" in Swift 5. These are real bugs, not migration noise — treat them as such.
- Liquid Glass over dynamic content (constantly-updating scan results) can feel busy. Be willing to roll back specific surfaces if the polish doesn't land.

## Out of scope (future phases per memory `project_ios_framework_plan.md`)

- AppIntents for Siri shortcuts
- BackgroundTasks framework integration
- WeatherKit
- Haptics richer than current

## Open questions

1. Is the Wisconsin Athletics device fleet on iOS 26 yet? If not, slip Slice 1 until they are.
2. Does the team want to wait for Swift 6.2 final release vs. adopting an earlier 6.x toolchain?
