# Plan 005: Split iOS profile and availability views out of AppTabView

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- ios/Wisconsin/Views/AppTabView.swift ios/Wisconsin.xcodeproj tests/ios-tabbar-stability.test.ts tests/ios-settings-first-class.test.ts tests/student-field-contracts.test.ts docs/AREA_MOBILE.md docs/AREA_SHIFTS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `e8566c54`, 2026-06-10
- **Result**: DONE ON MAIN, 2026-06-19

## Why This Matters

`AppTabView.swift` is now 1,480 lines and contains much more than the tab shell. The same file includes profile, notification settings, account security, and student availability editor code. Recent docs and tests show the tab shell is crash-sensitive, so unrelated settings/profile churn should not keep touching the file that owns the stable tab-bar implementation.

## Current State

- `ios/Wisconsin/Views/AppTabView.swift:4-84` is the actual tab shell.
- `ios/Wisconsin/Views/AppTabView.swift:88` starts `ProfileView`.
- `ios/Wisconsin/Views/AppTabView.swift:636` starts `NotificationSettingsView`.
- `ios/Wisconsin/Views/AppTabView.swift:990` starts `AccountSecuritySettingsView`.
- `ios/Wisconsin/Views/AppTabView.swift:1255` starts `AvailabilityView`.
- `docs/AREA_SHIFTS.md:93` says availability views were placed in `AppTabView.swift` to avoid a new project file.
- `docs/AREA_MOBILE.md:136-140` records recent tab-shell crash recovery and the stable `.tabItem`/`.tag` approach.
- `tests/ios-tabbar-stability.test.ts:13-24` pins the stable tab shell and rejects modern `Tab("Schedule"` plus `TabRole.search`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused source tests | `npx vitest run tests/ios-tabbar-stability.test.ts tests/ios-settings-first-class.test.ts tests/student-field-contracts.test.ts` | exit 0 |
| iOS drift check | `npm run drift:ios` | exit 0 |
| iOS build | `xcodebuild -scheme Tend -destination 'generic/platform=iOS Simulator' -configuration Debug build` if this repo's current scheme is still Tend, otherwise use the workspace's actual iOS scheme | BUILD SUCCEEDED |
| Full tests | `npm test` | exit 0 |

## Scope

**In scope**:
- `ios/Wisconsin/Views/AppTabView.swift`
- New Swift files under `ios/Wisconsin/Views/`, for example `ProfileView.swift`, `NotificationSettingsView.swift`, `AccountSecuritySettingsView.swift`, `AvailabilityView.swift`
- Xcode project file updates if this project requires explicit file membership
- Source tests that reference the old monolithic file
- `docs/AREA_MOBILE.md` and `docs/AREA_SHIFTS.md` changelog entries

**Out of scope**:
- Do not change tab labels, tags, badges, routing, or role gating.
- Do not reintroduce SwiftUI `Tab(...)`, `TabRole.search`, or tab-bar minimization.
- Do not redesign Profile, Notifications, Account Security, or Availability UX.
- Do not move API clients or models.

## Git Workflow

- Branch: `codex/005-split-ios-app-tab-view`
- Commit message: `chore: isolate iOS tab shell from settings views`

## Steps

### Step 1: Move views without changing behavior

Extract code below `// MARK: - Profile` into focused files. Keep access levels compatible with current call sites. A safe split is:

- `ProfileView.swift`
- `NotificationSettingsView.swift`
- `AccountSecuritySettingsView.swift`
- `AvailabilityView.swift`

Leave `AppTabView.swift` with the shell and `routePendingEventPush()` only unless shared helpers must remain there.

**Verify**: `npx vitest run tests/ios-tabbar-stability.test.ts` -> exit 0.

### Step 2: Update project membership

If the Xcode project uses explicit file references, add the new Swift files to the Wisconsin target. Use the repo's existing project-generation or Xcode project editing pattern. Do not hand-edit unrelated project settings.

**Verify**: `npm run drift:ios` -> exit 0.

### Step 3: Update source-contract tests

Some tests intentionally read `ios/Wisconsin/Views/AppTabView.swift` for settings/profile strings. Update only those tests that are now testing moved code so they read the new file paths. Keep `tests/ios-tabbar-stability.test.ts` focused on the shell before `// MARK: - Profile` or update its helper if that marker is removed.

**Verify**: `npx vitest run tests/ios-tabbar-stability.test.ts tests/ios-settings-first-class.test.ts tests/student-field-contracts.test.ts` -> exit 0.

### Step 4: Document the refactor

Update:

- `docs/AREA_MOBILE.md`: note the tab shell is now isolated from profile/settings views.
- `docs/AREA_SHIFTS.md`: replace the old note that availability lives in `AppTabView.swift` to avoid a new project file.

**Verify**: `rg -n "AvailabilityView|ProfileView|AppTabView.swift.*avoid a new project file" docs ios tests` -> no stale doc claim remains.

## Test Plan

- Existing source-contract tests listed above.
- iOS build must succeed.
- Manual reviewer check: app tab shell still uses `.tabItem` and `.tag`, staff-only Users tab remains gated, Schedule tag remains `4`, role-change guard remains.

## Done Criteria

- [x] `AppTabView.swift` contains the tab shell and only minimal shell helpers.
- [x] Profile, notification settings, account security, and availability code live in separate Swift files.
- [x] No user-facing iOS behavior changes.
- [x] `npx vitest run tests/ios-tabbar-stability.test.ts tests/ios-settings-first-class.test.ts tests/student-field-contracts.test.ts` exits 0.
- [x] `npm run drift:ios` exits 0.
- [x] iOS build succeeds.
- [x] `npm test` exits 0.
- [x] Docs no longer claim availability lives in `AppTabView.swift` to avoid a new file.
- [x] `plans/README.md` status row updated.

## STOP Conditions

- Xcode project structure cannot add new files without breaking signing or target membership.
- Tests reveal behavior changes outside file organization.
- The current branch already contains a conflicting AppTabView refactor.

## Maintenance Notes

Reviewers should treat this as a behavior-preserving refactor. The main risk is accidentally touching the stable tab shell that was restored after the Schedule selection crash.

## Review

- Shipped 2026-06-19: `AppTabView.swift` now owns the native tab shell and push routing only. Profile, notification settings, account security, account avatar, and student availability code moved into focused Swift files under `ios/Wisconsin/Views/`.
- Behavior scope: no tab labels, tags, badges, role gating, Schedule routing, API clients, or models changed.
- Verification: focused source-contract tests, `npm run drift:ios`, XcodeBuildMCP simulator build, `npm test`, `npm run lint`, `npm run verify:docs`, and `git diff --check` passed.
