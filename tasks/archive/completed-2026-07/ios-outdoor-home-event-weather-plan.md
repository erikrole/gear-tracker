# iOS Outdoor Home Event Weather Plan - 2026-07-23

## Goal
- Restore a quiet WeatherKit forecast signal on native Schedule rows and Event detail for upcoming home events that are known to take place outdoors.

## Route
- Owner area: Mobile
- Secondary area: Events
- Ledger: `tasks/archive/completed-2026-07/ios-outdoor-home-event-weather-plan.md`
- Existing plan/archive references: `tasks/schedule-ui-plan.md`, `tasks/audit-schedule-list-ios.md`, `tasks/audit-event-detail-ios.md`

## Source Checks
- `EventWeatherService` and the WeatherKit entitlement/framework remain registered in the Wisconsin target.
- `EventDetailView` still fetches and renders weather, while `EventRow` weather was removed in commit `80cdc0aa` to reduce row density and eliminate fetches with no visible payoff.
- `ScheduleEvent` already carries tolerant optional `isHome`, mapped `location`, and `rawLocationText` venue evidence from `/api/calendar-events`.
- The data model has no accepted outdoor-location flag. The user confirmed Kohl Center, UW Field House, and LaBahn Arena are the only covered venues, so identified home venues are weather-eligible unless they match one of those facilities. Outdoor-only sport fallback applies when venue evidence is absent.

## Stop Conditions
- Stop if the WeatherKit entitlement, framework, or Wisconsin target membership is missing.
- Stop if `/api/calendar-events` no longer returns `isHome`, `location`, or `rawLocationText`.
- Stop before adding schema or location-settings behavior because explicit outdoor venue administration is a separate product/data decision.
- Stop if the restored row signal requires a second line or reintroduces the dense badge cluster rejected in the prior Schedule cleanup.

## Slices
- [x] Slice 1: Add a testable outdoor-home eligibility contract and make WeatherKit fail quietly for covered, away, past, or forecast-distant events.
- [x] Slice 2: Restore one compact weather signal in the existing Schedule row metadata and include the temperature in the combined accessibility label.
- [x] Slice 3: Add focused source contracts and sync Mobile documentation without changing Events/API/schema behavior.

## Verification
- [x] Focused native weather source-contract tests
- [x] Full affected native source-contract suite
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Wisconsin Simulator build
- [x] Wisconsin generic-device build
- [ ] `npm run verify:docs` — blocked by pre-existing `docs/CODEMAPS/architecture.md` drift in the dirty worktree
- [x] `git diff --check`
- [x] Inspect the final scoped diff and preserve unrelated work

## Review
- Shipped: Outdoor-home eligibility now gates WeatherKit, excluding Kohl Center, UW Field House, and LaBahn Arena; Schedule rows again show one compact condition and temperature; Event detail retains Apple Weather attribution; VoiceOver includes the temperature.
- Corrected: Replaced the initial outdoor-venue allowlist after the user confirmed Kohl Center, UW Field House, and LaBahn Arena are the only covered facilities.
- Verified: Seven focused `ScheduleDateMathTests` pass, including three eligibility tests. Five focused native source contracts pass. XcodeBuildMCP builds, installs, and launches Wisconsin on the iPhone 17 Simulator. The unsigned generic iOS device build succeeds. Project drift, iOS drift, audit coverage, and whitespace checks pass.
- Deferred: A first-class `Location.isOutdoor` field and venue administration remain a separate data/product slice. Live WeatherKit data cannot be proven in Simulator because the existing service intentionally returns `nil` there.
- Blocked: The full native source suite has two unrelated current-tree failures in the Schedule filter marker and user-profile source contract. The full XCTest suite has one unrelated Welcome-step expectation failure. Docs verification stops on unrelated generated architecture codemap drift already present in the dirty worktree.
- Proof artifacts: XcodeBuildMCP build/run log `build_run_sim_2026-07-23T18-04-26-889Z_pid2807_1fe9710e.log`; final Simulator build log `build_sim_2026-07-23T18-30-39-001Z_pid2807_ff7b723d.log`; final focused XCTest result `test_sim_2026-07-23T18-30-09-077Z_pid2807_9cee577a.xcresult`; final generic-device build ended with `BUILD SUCCEEDED`.
- Next slice or stop: Stop. Confirm live forecast rendering on a WeatherKit-entitled physical device when one is available.
