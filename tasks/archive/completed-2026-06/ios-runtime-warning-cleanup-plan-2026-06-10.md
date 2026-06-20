# iOS Runtime Warning Cleanup Plan

## Scope
Reduce noisy iOS runtime warnings and the related app-shell tab crash seen while running the Wisconsin app without changing the scan, search, kiosk, schedule, or authentication product model.

## Checklist
- [x] Classify which warnings are app-actionable versus Apple framework diagnostics.
- [x] Tune native API URLSession configuration to avoid avoidable fallback churn.
- [x] Stop Scan result presentation from restarting VisionKit behind the result sheet.
- [x] Stabilize the native tab bar after `UITabBarController` crashed selecting Schedule.
- [x] Add focused source-contract tests for the runtime-warning cleanup.
- [x] Sync docs and verify the iOS gate.

## Review
- 2026-06-09: Started after runtime logs showed CFNetwork fallback, PointerUI service, repeated Liquid Glass frame updates, and dictation-button large-content diagnostics. Current source has no explicit `.glassEffect()` calls; the likely app-actionable source is ScanView restarting VisionKit while the system result sheet material is presented.
- 2026-06-09: Patched main API, kiosk API, and thumbnail URLSessions with explicit 15s request / 30s resource timeouts, `waitsForConnectivity = false`, and `multipathServiceType = .none`. Patched ScanView so results/errors leave VisionKit stopped until the result sheet dismisses, avoiding scanner updates behind system material.
- 2026-06-09: Verified with focused runtime, AppState refresh, and scan retry tests, `npm run drift:ios`, `npm run audit:ios:gaps`, touched-file whitespace check, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The sandboxed build could not access CoreSimulator/DerivedData, so the successful build used the approved unsandboxed fallback.
- 2026-06-09: User-provided main-thread trace confirmed an uncaught `NSInternalInconsistencyException` in `UITabBarController._viewControllerForTabBarItem` when selecting Schedule. Rolled `AppTabView` back from the iOS 26 `Tab(...)` builder, `TabRole.search`, and `.tabBarMinimizeBehavior(.onScrollDown)` to stable `.tabItem` + `.tag` tabs, and added a guard that resets selection if a role change removes the staff-only Users tab.
- 2026-06-09: Crash fix verification passed with `tests/ios-tabbar-stability.test.ts`, `tests/ios-appstate-refresh.test.ts`, `tests/ios-runtime-warning-cleanup.test.ts`, `tests/ios-scan-result-retry.test.ts`, `npm run drift:ios`, touched-file whitespace check, and XcodeBuildMCP simulator build for Wisconsin Debug. `npm run audit:ios:gaps` exited cleanly but reported an unrelated unregistered new `Components/UserAvatarView.swift` from the surrounding dirty worktree.
- 2026-06-10: User requested the newest SwiftUI tab surface. Restored `AppTabView` to typed value-based `Tab(...)` entries with `role: .search` for Scan, `.tabBarMinimizeBehavior(.onScrollDown)`, and `customizationID` values while keeping the Users role-change guard.
- 2026-06-10: User retest confirmed the modern `Tab(...)` shell still crashes when selecting Schedule. Reverted the app shell back to stable `.tabItem`/`.tag` tabs and restored the source-contract test that blocks `Tab("Schedule"`, `role: .search`, and `.tabBarMinimizeBehavior(` in `AppTabView`.
