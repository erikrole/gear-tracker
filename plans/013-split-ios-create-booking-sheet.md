# Plan 013: Split iOS CreateBookingSheet into focused pieces

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- ios/Wisconsin/Views/CreateBookingSheet.swift ios/Wisconsin/Views/Components/UserAvatarView.swift ios/Wisconsin.xcodeproj tests/ios-create-booking-picker-parity.test.ts tests/ios-api-contract.test.ts docs/AREA_MOBILE.md`
> If any in-scope file changed since this plan was written, compare the "Current State" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 011
- **Category**: tech-debt
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

`CreateBookingSheet.swift` is now a feature module in one file. It owns the observable view model, loading options, asset search, scan-to-add, advisory conflict checks, bulk quantity state, three-step navigation, review UI, picker screens, and reusable form rows. The recent booking refresh is valuable, but the file is now large enough that small changes risk touching unrelated booking behavior.

## Current State

- `ios/Wisconsin/Views/CreateBookingSheet.swift:15-297` defines `CreateBookingViewModel`.
- `ios/Wisconsin/Views/CreateBookingSheet.swift:299-1162` defines the sheet and its detail, equipment, and review steps.
- `ios/Wisconsin/Views/CreateBookingSheet.swift:1166-1214` defines form card and picker row components.
- `ios/Wisconsin/Views/CreateBookingSheet.swift:1218-1261` defines `OptionPickerView`.
- `ios/Wisconsin/Views/CreateBookingSheet.swift:1267-1325` defines `RequesterPickerView`.
- `tests/ios-create-booking-picker-parity.test.ts:17-64` pins scan-to-add, bulk item selection, and typed bulk submission through source-string tests.
- `docs/AREA_MOBILE.md:128-133` records the latest booking picker, review step, and bulk selection work.
- Existing Plan 005 already covers AppTabView refactoring. This plan is separate and should not touch the tab shell.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused booking tests | `npx vitest run tests/ios-create-booking-picker-parity.test.ts tests/ios-api-contract.test.ts` | exit 0 |
| Related iOS tests | `npx vitest run tests/student-field-contracts.test.ts` | exit 0 |
| iOS drift check | `npm run drift:ios` | exit 0 |
| Audit inventory | `npm run audit:ios:gaps` | no gaps |
| iOS build | `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` | BUILD SUCCEEDED |

## Scope

**In scope**:
- `ios/Wisconsin/Views/CreateBookingSheet.swift`
- New Swift files under `ios/Wisconsin/Views/Bookings/` or `ios/Wisconsin/Views/CreateBooking/`
- `ios/Wisconsin.xcodeproj` or XcodeGen outputs if explicit file membership is required
- Tests that read `CreateBookingSheet.swift`
- `docs/AREA_MOBILE.md`
- `scripts/ios-audit-inventory.sh` if new routeable sheets need registration

**Out of scope**:
- Do not change the booking creation API payload.
- Do not change scan lookup scope or kiosk custody boundaries.
- Do not change the three-step Details, Equipment, Confirm flow.
- Do not redesign picker UI.
- Do not move `CreateBookingViewModel` into Core unless there is a clear testability win.

## Git Workflow

- Branch: `codex/013-split-ios-create-booking-sheet`
- Commit message: `chore: split iOS booking creation views`

## Steps

### Step 1: Split passive components first

Move reusable passive UI components out first:

- `FormCard`
- `FormPickerRow`
- selected equipment rows
- review fact rows

Keep names stable where tests or call sites rely on them.

**Verify**: `npx vitest run tests/ios-create-booking-picker-parity.test.ts` -> exit 0.

### Step 2: Split picker views

Move `OptionPickerView` and `RequesterPickerView` into focused files.

If Plan 011 has landed, make sure these pickers use the consolidated avatar component. If Plan 011 has not landed, stop and either execute it first or adjust this plan with maintainer approval.

**Verify**: `rg -n "struct OptionPickerView|struct RequesterPickerView|UserAvatarView" ios/Wisconsin/Views` -> definitions and usages are in expected files.

### Step 3: Keep the sheet as orchestration

After passive components and pickers are moved, leave `CreateBookingSheet.swift` responsible for:

- sheet state
- step navigation
- calling the view model
- wiring submit and scanner presentation

Do not change user-facing behavior during the split.

**Verify**: focused booking tests pass.

### Step 4: Consider view-model extraction only if still useful

If `CreateBookingSheet.swift` remains large and unstable after the view split, move `CreateBookingViewModel` to `CreateBookingViewModel.swift`.

Only do this if it does not complicate Xcode membership or test paths.

**Verify**: iOS simulator build succeeds.

### Step 5: Update tests and docs

Update source-contract tests so they read the new files where appropriate. Avoid weakening the assertions: scan-to-add, bulk item selection, selected bulk review rows, and typed bulk submission must remain pinned.

Update `docs/AREA_MOBILE.md` with a behavior-preserving refactor note.

**Verify**: `rg -n "CreateBookingSheet.swift" tests docs ios` -> no stale path assumptions remain except where the sheet file is still the correct source.

## Test Plan

- `npx vitest run tests/ios-create-booking-picker-parity.test.ts tests/ios-api-contract.test.ts tests/student-field-contracts.test.ts`
- `npm run drift:ios`
- `npm run audit:ios:gaps`
- iOS simulator build

Manual reviewer check:

- Details step still auto-selects the current user when present.
- Equipment step still supports search, scan-to-add, serialized assets, and bulk quantities.
- Confirm step still blocks submit until equipment is selected and uses the prominent inline submit action.
- Conflict hints remain advisory only.

## Done Criteria

- [ ] `CreateBookingSheet.swift` is reduced to orchestration and view model wiring.
- [ ] Picker and passive row components live in focused files.
- [ ] No booking creation behavior changes.
- [ ] Source-contract tests still pin scan-to-add and bulk submission behavior.
- [ ] `npm run drift:ios` exits 0.
- [ ] `npm run audit:ios:gaps` exits 0.
- [ ] iOS simulator build succeeds.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

- New Swift files cannot be added to the target cleanly.
- Tests reveal behavior changes in booking creation.
- Plan 011 has not landed and this split would create conflicting avatar edits.
- The current branch already contains a booking creation refactor.

## Maintenance Notes

This should be a behavior-preserving refactor. If the executor finds a booking bug while moving code, record it and either add a separate fix plan or stop for maintainer approval before mixing fixes into the split.

