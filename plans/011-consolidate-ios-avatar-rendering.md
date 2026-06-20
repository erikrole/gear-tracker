# Plan 011: Consolidate iOS avatar rendering

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- ios/Wisconsin/Views/Components/UserAvatarView.swift ios/Wisconsin/Views/AppTabView.swift ios/Wisconsin/Views/HomeView.swift ios/Wisconsin/Views/UserDetailView.swift ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift ios/Wisconsin/Views/CreateBookingSheet.swift tests docs/AREA_MOBILE.md`
> If any in-scope file changed since this plan was written, compare the "Current State" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P2
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: 009
- **Category**: tech-debt
- **Planned at**: commit `e8566c54`, 2026-06-10
- **Result**: DONE ON MAIN, 2026-06-19

## Why This Matters

The app now has a shared `UserAvatarView`, but several iOS surfaces still hand-roll the same AsyncImage plus initials fallback logic. That duplication makes future avatar fixes easy to miss and keeps visual fallback behavior inconsistent across Profile, Users, Schedule assignment, and reservation creation.

## Current State

- `ios/Wisconsin/Views/Components/UserAvatarView.swift:5-41` defines the shared component.
- `ios/Wisconsin/Views/CreateBookingSheet.swift:497`, `:509`, and `:1298` use `UserAvatarView`.
- `ios/Wisconsin/Views/UsersView.swift:247` uses `UserAvatarView`.
- `ios/Wisconsin/Views/AppTabView.swift:1205-1244` defines a separate `AccountAvatar`.
- `ios/Wisconsin/Views/HomeView.swift:187` uses `AccountAvatar` for the profile toolbar button.
- `ios/Wisconsin/Views/UserDetailView.swift:208-232` defines `profileAvatar` with local AsyncImage fallback logic.
- `ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift:198-225` defines another local avatar renderer.
- `docs/AREA_MOBILE.md:137` says `UserAvatarView` was introduced as a shared avatar for user lists and pickers.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Avatar source search | `rg -n "struct AccountAvatar|profileAvatar|private var avatar|AsyncImage\\(url: url\\).*phase|UserAvatarView" ios/Wisconsin/Views` | no unnecessary duplicate avatar renderers |
| Focused tests | `npx vitest run tests/ios-settings-first-class.test.ts tests/ios-create-booking-picker-parity.test.ts tests/student-field-contracts.test.ts` | exit 0 |
| iOS drift check | `npm run drift:ios` | exit 0 |
| Audit inventory | `npm run audit:ios:gaps` | no gaps |
| iOS build | `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` | BUILD SUCCEEDED |

## Scope

**In scope**:
- `ios/Wisconsin/Views/Components/UserAvatarView.swift`
- `ios/Wisconsin/Views/AppTabView.swift`
- `ios/Wisconsin/Views/HomeView.swift`
- `ios/Wisconsin/Views/UserDetailView.swift`
- `ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift`
- Focused source-contract tests if they reference avatar implementation details
- `docs/AREA_MOBILE.md`

**Out of scope**:
- Do not change user, requester, or current-user data models.
- Do not redesign Profile or Schedule assignment rows.
- Do not move Profile out of `AppTabView.swift`; that is Plan 005.
- Do not touch kiosk avatar implementations in this plan unless they already depend on the same component cleanly.

## Git Workflow

- Branch: `codex/011-consolidate-ios-avatar-rendering`
- Commit message: `chore: consolidate iOS avatar rendering`

## Steps

### Step 1: Extend UserAvatarView only as much as needed

Add narrow customization points if needed, for example:

- `tone: StatusTone?` or explicit background/foreground style inputs for tone-aware initials fallback.
- `showsBorder: Bool` for toolbar and profile use.
- A current-user convenience wrapper only if it removes `AccountAvatar` without coupling the component to `SessionStore`.

Keep the default behavior unchanged for Users and Create Booking.

**Verify**: `npx vitest run tests/ios-create-booking-picker-parity.test.ts` -> exit 0.

### Step 2: Replace local duplicate avatar renderers

Replace local AsyncImage fallback logic in:

- `AccountAvatar` in `AppTabView.swift`, or replace its body with `UserAvatarView`.
- `UserDetailView.profileAvatar`.
- `AssignStudentSheet.avatar`.

Preserve accessibility labels already handled by parent rows. Do not make decorative avatar images noisy for VoiceOver.

**Verify**: `rg -n "struct AccountAvatar|profileAvatar|private var avatar|AsyncImage\\(url: url\\).*phase" ios/Wisconsin/Views` -> any remaining hits are intentional and documented.

### Step 3: Update tests and docs

Add or update a focused source-contract test if useful to prevent new duplicate avatar renderers from appearing outside approved components.

Update `docs/AREA_MOBILE.md` with a short changelog note for avatar rendering consolidation.

**Verify**: focused tests and `npm run drift:ios` pass.

## Test Plan

- `npx vitest run tests/ios-settings-first-class.test.ts tests/ios-create-booking-picker-parity.test.ts tests/student-field-contracts.test.ts`
- `npm run drift:ios`
- `npm run audit:ios:gaps`
- iOS simulator build

Manual reviewer check:

- Profile toolbar avatar still fits the 32 pt toolbar button.
- Settings header avatar still reads clearly at 58 pt.
- User detail avatar preserves role/status tone.
- Assign picker rows still combine VoiceOver labels cleanly.

## Done Criteria

- [x] Shared avatar code handles user list, requester picker, profile, user detail, and assign picker cases.
- [x] Duplicate AsyncImage plus initials fallback implementations are removed or documented as intentional.
- [x] Existing avatar-facing source tests pass.
- [x] `npm run drift:ios` exits 0.
- [x] `npm run audit:ios:gaps` exits 0.
- [x] iOS simulator build succeeds.
- [x] `plans/README.md` status row updated.

## STOP Conditions

- Consolidation would erase a meaningful surface-specific tone or accessibility behavior.
- Plan 005 has already moved Profile code and the touched file list no longer matches.
- The current branch contains conflicting avatar work.

## Maintenance Notes

Keep this as a consolidation pass. If a surface wants a different visual language, express that as parameters on the shared component rather than another full renderer.

## Review

- Shipped 2026-06-19: `UserAvatarView` now supports tone-aware initials fallback colors and optional border rendering while preserving its default list/picker behavior. `AccountAvatar` became a thin current-user wrapper, and User detail plus Schedule assignment rows now use the shared avatar component.
- Intentional remaining `AsyncImage` users are non-user thumbnails and scan/result media surfaces, not duplicate user-avatar renderers.
- Verification: avatar source search, focused iOS settings/create-booking/student tests, `npm run drift:ios`, `npm run audit:ios:gaps`, XcodeBuildMCP simulator build, `npm test`, `npm run lint`, `npm run verify:docs`, and `git diff --check` passed.
