# Kiosk Student Hub Idle Compute Plan - 2026-08-07

## Goal

- Stop unattended Student Hub refreshes from waking Neon while preserving the immediate load when a student opens the hub and the existing three-minute freshness while the kiosk is active.

## Route

- Owner area: `AREA_MOBILE` / native kiosk
- Source: `ios/Wisconsin/Kiosk/KioskStudentHubView.swift`
- Store contract: `ios/Wisconsin/Kiosk/KioskStore.swift` (`isDeviceIdle` becomes true after 15 minutes without kiosk activity)
- Focused contract: `tests/kiosk-neon-compute-budget.test.ts`
- Existing compute-hardening plan: `tasks/neon-compute-polling-hardening-plan.md`

## Source Checks

- Student Hub currently refreshes every 180 seconds and calls `loadContext()` after each sleep without checking `store.isDeviceIdle`.
- Kiosk idle dashboard already skips its periodic load while idle and refetches immediately when activity resumes.
- Kiosk heartbeat already uses a five-minute active cadence and an hourly idle/night cadence.
- No API, schema, permission, custody, or response-shape changes are in scope.

## Stop Conditions

- Stop if the idle state is not observable from the existing `KioskStore` contract.
- Stop if the guard would suppress the initial `.task` load or an active student session refresh.
- Stop if project drift, source contracts, or the standalone kiosk target build fails for an unrelated dirty-worktree reason; report the exact blocker without rewriting unrelated files.

## Slices

- [x] Add an idle guard to the Student Hub periodic refresh loop after its sleep and cancellation checks.
- [x] Extend the existing Neon compute source-contract test to pin the idle guard.

## Verification

- [x] `npx vitest run tests/kiosk-neon-compute-budget.test.ts tests/ios-system-correctness-contract.test.ts` (2 files, 10 tests passed)
- [x] `npm run drift:ios` (84 Swift files, no anti-patterns)
- [x] `npm run audit:ios:gaps` (53/53 covered)
- [x] `npm run ios:project:check` (XcodeGen output matches)
- [ ] `npm run ios:xcode:verify:kiosk` (blocked before simulator build by an invalid CoreSimulatorService and no available simulator runtimes; generic unsigned device retry reached Swift compilation but failed asset catalog thinning for the same simulator-service condition)
- [x] `git diff --check`

## Review

- Shipped: no deployment or device distribution in this slice.
- Verified: focused source tests, static gates, project consistency, and a source-level kiosk target attempt completed. The Swift driver started for the unsigned generic iOS build, but Xcode could not finish asset catalog thinning because CoreSimulatorService is unavailable.
- Deferred: installed-device overnight proof and Neon active-time comparison require a deployed build and a real kiosk.
- Blocked: local target build remains blocked by the Mac's CoreSimulatorService (`Connection refused`, no simulator runtimes). A normal device build is also signing-gated because this target has a manual provisioning profile requirement; no provisioning changes were attempted.
- Next slice or stop: repair the local simulator/Xcode runtime and provide the kiosk signing profile before rerunning the target build. Deploy only with separate explicit authorization.
