# iOS HIG and iOS 27 Readiness Plan

**Status:** Active, slices 1-18 shipped
**Created:** 2026-06-05
**Scope:** `ios/Wisconsin`
**Goal:** Refresh the native iOS app against current Apple Human Interface Guidelines, improve the highest-impact UI/UX gaps now, and keep the code ready for WWDC26/iOS 27 changes starting June 8, 2026.

## Source Grounding

- Apple current HIG: hierarchy, harmony, consistency, layout, materials, accessibility, tab bars, and standard components.
- Apple WWDC26 schedule: Keynote June 8 at 10 a.m. PT, Platforms State of the Union June 8 at 1 p.m. PT, sessions and labs through June 12.
- Existing repo contract: mobile stays student-first, action-first, role-adaptive, scan one tap away, and 44pt minimum touch targets.
- Existing task records: `tasks/hig-audit-ios.md`, `tasks/ios-swift62-liquidglass-plan.md`, `tasks/ios-first-class-upgrade-plan.md`, and recent iOS control-clarity plans.
- Repo truth: current SwiftUI source, `docs/AREA_MOBILE.md`, relevant `docs/AREA_*.md`, `docs/DECISIONS.md`, `docs/GAPS_AND_RISKS.md`, and `prisma/schema.prisma`.

## Slice 1 — Refresh Audit Before Code

- [x] Read all `docs/BRIEF_*` and `docs/AREA_*` files before choosing implementation scope.
- [x] Cross-reference `prisma/schema.prisma`, `docs/DECISIONS.md`, and `docs/GAPS_AND_RISKS.md` for mobile-sensitive contracts.
- [x] Reconcile the older `tasks/hig-audit-ios.md` findings against current Swift files so closed items do not get reopened.
- [x] Audit the app shell and high-frequency student surfaces first: `AppTabView`, `HomeView`, `BookingsView`, `BookingDetailView`, `CreateBookingSheet`, `ItemsView`, `ScanView`, `ScheduleView`, `EventDetailSheet`, and Profile.
- [x] Use HIG lenses that matter for this product: navigation grammar, control clarity, tab/toolbar stability, accessibility, Dynamic Type, safe areas, materials, color semantics, haptics, and interruption cost.
- [x] Create or refresh `tasks/hig-audit-ios.md` with current findings ranked P0/P1/P2 and explicit source references.

## Slice 2 — Pick One Improvement Slice

- [x] Choose the smallest coherent HIG improvement with broad daily impact.
- [x] Prefer a change that preserves the current mobile product contract over desktop parity.
- [x] Avoid deployment-target or Swift-toolchain bumps until after WWDC26 guidance is confirmed.
- [x] Update `docs/AREA_MOBILE.md` and any relevant feature area docs in the same change.
- [x] Add focused tests or static contract coverage when the change affects copy, API payloads, role gating, or navigation.

## Slice 3 — Bookings Empty-State Recovery

- [x] Re-audit `BookingsView` against the current mobile contract and stale booking audit notes.
- [x] Preserve active-only mobile booking scope and avoid web parity filters.
- [x] Add clear recovery actions for search-empty, Mine-empty, and reservation-empty states.
- [x] Add focused static coverage for the native empty-state actions.
- [x] Sync mobile, checkout, reservation, and audit docs.

## Slice 4 — Login Account Recovery Parity

- [x] Re-audit `LoginView` against onboarding, allowlist, and walkthrough expectations.
- [x] Preserve D-029/D-037 invite-gated registration; do not add native open signup.
- [x] Restore the native `Need an account?` link to web `/register`.
- [x] Add focused static coverage for native login recovery links.
- [x] Sync mobile, users, login audit, and HIG plan docs.

## Slice 5 — Forced-Password Form Guidance

- [x] Re-audit `PasswordSetupView` against onboarding and text-field guidance.
- [x] Preserve the existing `/api/me/change-password` forced-password flow.
- [x] Add persistent password requirement feedback while the user types.
- [x] Add focused static coverage for the native requirement checklist.
- [x] Sync mobile, users, login audit, and HIG plan docs.

## Slice 6 — Schedule Calendar Day Hit Targets

- [x] Re-audit `ScheduleView` calendar mode against mobile and shift contracts.
- [x] Preserve the existing List/Calendar scope and avoid adding deferred web-only filters.
- [x] Raise calendar day cells to a 44pt minimum interactive width while keeping the compact visual circle.
- [x] Add focused static coverage for the native calendar day hit target.
- [x] Sync mobile, shifts, schedule audit, and HIG plan docs.

## Slice 7 — Notifications Read-Recovery Honesty

- [x] Re-audit `NotificationsSheet` against mobile and notification contracts.
- [x] Preserve the existing inbox scope, grouping, routing, and mark-read behavior.
- [x] Route notification read mutations through the shared API error handler.
- [x] Restore optimistic unread state when mark-read or mark-all-read fails.
- [x] Add visible recovery and error haptics for read-action failures.
- [x] Add focused static coverage for the native notification recovery contract.
- [x] Sync mobile, notifications, notification audit, and HIG plan docs.

## Slice 8 — Trade Board Cancel Honesty

- [x] Re-audit `TradeBoardSheet` cancellation against shift-trade route contracts.
- [x] Preserve existing trade board browse, claim, post, and swipe-cancel scope.
- [x] Align native cancel with the server `PATCH /api/shift-trades/[id]/cancel` route.
- [x] Decode the returned trade through the shared API error handler.
- [x] Update the local board from server truth instead of deleting after an unchecked request.
- [x] Add focused static coverage for the native cancel contract.
- [x] Sync mobile, shifts, trade-board audit, and HIG plan docs.

## Slice 9 — Trade Board Error Recovery

- [x] Re-audit `TradeBoardSheet` action failure feedback against the current recovery patterns.
- [x] Preserve existing trade board browse, claim, post, and swipe-cancel scope.
- [x] Replace the generic OK-only action alert with an in-sheet recovery banner.
- [x] Add Refresh and Dismiss actions without holding ambiguous retry state for claim versus cancel.
- [x] Add error haptic feedback through SwiftUI sensory feedback.
- [x] Add focused static coverage for the native recovery contract.
- [x] Sync mobile, shifts, trade-board audit, and HIG plan docs.

## Slice 10 — Login Password Visibility Accessibility

- [x] Re-audit `LoginView` against current auth and onboarding contracts.
- [x] Preserve existing cookie login, forgot-password, and invite-gated registration links.
- [x] Give the password visibility button explicit VoiceOver action copy.
- [x] Expose the current password visibility state through an accessibility value.
- [x] Add focused static coverage for the native login accessibility contract.
- [x] Sync mobile, users, login audit, and HIG plan docs.

## Slice 11 — Forced-Password Visibility Accessibility

- [x] Re-audit `PasswordSetupView` against current onboarding and forced-password contracts.
- [x] Preserve existing temporary-password setup, requirement checklist, sign-out, and `/api/me/change-password` flow.
- [x] Keep the shared show/hide-passwords button action-oriented for VoiceOver users.
- [x] Expose the current shared password visibility state through an accessibility value.
- [x] Add focused static coverage for the native forced-password accessibility contract.
- [x] Sync mobile, users, login audit, and HIG plan docs.

## Slice 12 — Items Row Detail Hint

- [x] Re-audit `ItemsView` against current Items, Mobile, and prior iOS item-list audit records.
- [x] Preserve existing search, favorites/status controls, swipe actions, context menus, and row-to-detail navigation.
- [x] Keep item rows as combined accessibility elements with the existing operational status label.
- [x] Add an explicit VoiceOver hint that double-tap opens item details.
- [x] Add focused static coverage for the native item-row accessibility contract.
- [x] Sync mobile, items, item-list audit, and HIG plan docs.

## Slice 13 — Items Favorite Failure Recovery

- [x] Re-audit `ItemsView` against current Items, Mobile, favorite route, and prior item-list audit records.
- [x] Preserve existing optimistic favorite toggles, server-authoritative reconciliation, swipe actions, context menus, and Favorites filter behavior.
- [x] Keep rollback on favorite-update failure.
- [x] Add visible non-blocking recovery feedback when the rollback happens.
- [x] Reuse the shared native `Toast` component instead of adding a blocking alert.
- [x] Add focused static coverage for the native favorite failure recovery contract.
- [x] Sync mobile, items, item-list audit, and HIG plan docs.

## Slice 14 — Items Retired Reserve Gating

- [x] Re-audit `ItemsView` and `ItemDetailView` against current Items, Mobile, derived-status decisions, and prior item-list audit records.
- [x] Preserve tag-first list/detail identity, favorite actions, copy-tag actions, row navigation, and status display.
- [x] Keep retired items visible with the Retired status.
- [x] Remove native Reserve handoff affordances for retired items in list swipe actions, context menus, and detail primary actions.
- [x] Add focused static coverage for retired reserve gating on native list and detail surfaces.
- [x] Sync mobile, items, item-list audit, and HIG plan docs.

## Slice 15 — Items Load Error Copy

- [x] Re-audit `ItemsView` against current Items, Mobile, API error handling, and prior item-list audit records.
- [x] Preserve existing initial-load error state, pagination retry row, pull-to-refresh, cancellation, filters, search, and row actions.
- [x] Replace raw `localizedDescription` display for Items list load errors with recovery-oriented copy.
- [x] Keep server/API errors useful while mapping network and decode failures to friendly messages.
- [x] Add focused static coverage for initial-load and pagination error-copy paths.
- [x] Sync mobile, items, item-list audit, and HIG plan docs.

## Slice 16 — Items Empty-State Recovery

- [x] Re-audit `ItemsView` against current Items, Mobile, HIG empty-state guidance, and prior item-list audit records.
- [x] Preserve existing search, Favorites, Status controls, pull-to-refresh, row navigation, swipe actions, and context menus.
- [x] Add direct recovery actions for no-result search and Favorites-only empty states.
- [x] Keep empty Inventory copy unchanged when no filters explain the empty state.
- [x] Add focused static coverage for the native empty-state recovery contract.
- [x] Sync mobile, items, item-list audit, and HIG plan docs.

## Slice 17 — Schedule List Dynamic Type

- [x] Re-audit `ScheduleView` list rows against current Mobile, Shifts, and HIG typography guidance.
- [x] Preserve existing List/Calendar scope, filters, trade/calendar actions, row routing, coverage chips, and weather context.
- [x] Replace fixed point-size schedule list microcopy with semantic SwiftUI font styles.
- [x] Keep monospaced digits where date, time, and crew counts need stable scanning.
- [x] Let the date rail use a minimum width instead of a fixed width so larger text has room to scale.
- [x] Add focused static coverage for the native Schedule Dynamic Type contract.
- [x] Sync mobile, shifts, HIG audit, and readiness plan docs.

## Slice 18 — Scan Result Retry Recovery

- [x] Re-audit `ScanView` against current Mobile, Scan, Search, and prior scan audit records.
- [x] Preserve lookup-only Scan scope, kiosk custody boundaries, camera permission recovery, torch, manual entry, and single-asset auto-jump behavior.
- [x] Wire the existing result-sheet retry callback into scan lookup failures.
- [x] Reset same-code dedupe before retrying the last scanned code so the recovery action works immediately.
- [x] Keep manual code entry as the secondary recovery path when retry is not enough.
- [x] Add focused static coverage for native Scan retry recovery.
- [x] Sync mobile, scan, search, scan audit, HIG audit, and readiness plan docs.

## iOS 27 Watch Items

- [ ] Re-check Apple HIG and developer sessions after the June 8 Keynote and Platforms State of the Union.
- [ ] Confirm whether iOS 27 changes alter Liquid Glass, tab bars, toolbars, search, sheets, materials, or accessibility guidance.
- [ ] Keep iOS 26/Liquid Glass migration separate from everyday UX polish unless Apple makes it a direct compatibility requirement.
- [ ] Do not raise the deployment target without explicit fleet readiness confirmation.

## Verification Bar

- [x] `npx tsc --noEmit` if shared TypeScript/API code changes.
- [x] `npm run drift:ios`.
- [x] `npm run audit:ios:gaps`.
- [x] `git diff --check`.
- [x] `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`.
- [ ] Browser or simulator visual proof for any user-facing UI change when feasible.

## Review

- 2026-06-05: Goal created and plan opened. No implementation changes yet. The first required step is a refresh audit because the existing HIG and Liquid Glass notes are older than the current iOS source and several listed findings have already shipped.
- 2026-06-05: Refreshed source and Apple guidance context. Most older P0/P1 findings are already closed in current source. Selected the smallest useful HIG slice: bring the global-search QR scanner shortcut up to the Scan tab's current standard for permission framing, 44pt controls, manual-entry recovery, persistent errors, and haptics without changing scan lookup APIs or mobile product scope.
- 2026-06-05: Shipped the global-search QR scanner HIG polish slice. `npx tsc --noEmit` was not needed because no shared TypeScript or API code changed. Verification passed with `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build for `Wisconsin` Debug on iOS Simulator. Visual proof remains a follow-up because this was a compile-only simulator build.
- 2026-06-05: Shipped the Bookings empty-state recovery slice. The native booking list now gives no-result states direct actions: Clear search, Show all visible bookings, or New Reservation when appropriate. The change keeps GAP-34's active-only mobile scope intact and avoids desktop status/sort parity. Added `tests/ios-bookings-empty-state.test.ts` to guard the copy and reload behavior.
- 2026-06-05: Verified the Bookings empty-state slice with `npx vitest run tests/ios-bookings-empty-state.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build for `Wisconsin` Debug on iOS Simulator. `npx tsc --noEmit` was not needed because no shared TypeScript or API code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-05: Shipped the Login account-recovery parity slice. Current source contradicted `tasks/audit-login-ios.md` and `docs/IOS_DEVICE_WALKTHROUGH.md`: the native login screen had forgot-password recovery but no `Need an account?` path. `LoginView` now links to the allowlist-backed web registration page while preserving D-029/D-037 invite gating. Added `tests/ios-login-recovery-links.test.ts`.
- 2026-06-05: Verified the Login account-recovery parity slice with `npx vitest run tests/ios-login-recovery-links.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API code changed.
- 2026-06-05: Shipped the forced-password form guidance slice. `PasswordSetupView` now keeps a persistent requirement checklist visible while users complete first sign-in: temporary password entered, 8-character minimum, matching confirmation, and different-from-temporary-password. The slice keeps the existing `/api/me/change-password` flow unchanged and adds focused source coverage in `tests/ios-forced-password.test.ts`.
- 2026-06-05: Verified the forced-password form guidance slice with `npx vitest run tests/ios-forced-password.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. First simulator build caught a Swift `ShapeStyle`/`Color` ternary mismatch in the checklist icon tint; fixed it and reran the gates successfully. `npx tsc --noEmit` was not needed because no shared TypeScript or API code changed.
- 2026-06-05: Shipped the Schedule calendar day hit-target slice. `DayCell` now keeps its compact 34pt visual date circle but gives the interactive calendar day label a 44pt minimum width and rectangular content shape. This keeps the existing native List/Calendar workflow intact while aligning the month grid with the current HIG button hit-region baseline. Added `tests/ios-schedule-calendar-hit-targets.test.ts`.
- 2026-06-05: Verified the Schedule calendar day hit-target slice with `npx vitest run tests/ios-schedule-calendar-hit-targets.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-05: Shipped the Notifications read-recovery slice. Native notification mark-read and mark-all-read mutations now use the shared API response handler instead of raw `session.data`, restore optimistic unread state if the server rejects the mutation, and show a recoverable error banner with Refresh plus an error haptic. Added `tests/ios-notifications-read-recovery.test.ts`.
- 2026-06-05: Verified the Notifications read-recovery slice with `npx vitest run tests/ios-notifications-read-recovery.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-05: Shipped the Trade Board cancel-honesty slice. Native trade cancellation now calls the server's actual `PATCH /api/shift-trades/[id]/cancel` route, decodes the returned `ShiftTrade` through the shared API handler, and updates the board from the returned status instead of removing a row after an unchecked raw response. Added `tests/ios-trade-cancel-contract.test.ts`.
- 2026-06-05: Verified the Trade Board cancel-honesty slice with `npx vitest run tests/ios-trade-cancel-contract.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-05: Shipped the Trade Board error-recovery slice. Failed claim and cancel actions now keep the sheet visible and show an inline banner with Refresh and Dismiss actions instead of interrupting with a generic OK-only alert. Added `tests/ios-trade-board-recovery.test.ts`.
- 2026-06-05: Verified the Trade Board error-recovery slice with `npx vitest run tests/ios-trade-board-recovery.test.ts tests/ios-trade-cancel-contract.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-05: Shipped the Login password-visibility accessibility slice. The native login eye button now speaks as Show password or Hide password and exposes Password hidden or Password visible as state instead of relying on SF Symbol names. Updated `tests/ios-login-recovery-links.test.ts`.
- 2026-06-05: Verified the Login password-visibility accessibility slice with `npx vitest run tests/ios-login-recovery-links.test.ts tests/ios-forced-password.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the TypeScript edit is a focused Vitest source contract.
- 2026-06-05: Shipped the forced-password visibility accessibility slice. The native first-login password setup eye button already spoke as Show passwords or Hide passwords; it now also exposes Passwords hidden or Passwords visible as state. Updated `tests/ios-forced-password.test.ts`.
- 2026-06-05: Verified the forced-password visibility accessibility slice with `npx vitest run tests/ios-forced-password.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the TypeScript edit is a focused Vitest source contract.
- 2026-06-05: Shipped the Items row detail-hint slice. `AssetRow` keeps its combined operational VoiceOver label and now adds "Double-tap to view item details" so row navigation is explicit without changing search, filters, swipe actions, context menus, or item API behavior. Added `tests/ios-items-row-accessibility.test.ts`.
- 2026-06-05: Verified the Items row detail-hint slice with `npx vitest run tests/ios-items-row-accessibility.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-05: Shipped the Items favorite failure-recovery slice. Native Items list favorite actions now keep the existing optimistic update and rollback behavior, but failed updates show a shared bottom toast saying the favorite could not be updated. This closes the silent-revert item from the prior Items iOS audit without changing the favorite API, list filters, swipe actions, context menus, or V1 mobile scope. Added `tests/ios-items-favorite-recovery.test.ts`.
- 2026-06-05: Verified the Items favorite failure-recovery slice with `npx vitest run tests/ios-items-favorite-recovery.test.ts tests/ios-items-row-accessibility.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-05: Shipped the Items retired reserve-gating slice. Native retired items still appear with their derived Retired status, but iOS no longer exposes Reserve from list trailing swipe actions, list context menus, or the item detail primary action. This closes the prior item-list audit note about retired rows exposing Reserve without changing item APIs, row navigation, favorite/copy-tag actions, or the V1 mobile deferral for admin lifecycle actions. Added `tests/ios-items-retired-reserve-gating.test.ts`.
- 2026-06-05: Verified the Items retired reserve-gating slice with `npx vitest run tests/ios-items-retired-reserve-gating.test.ts tests/ios-items-favorite-recovery.test.ts tests/ios-items-row-accessibility.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-06: Shipped the Items load error-copy slice. Native Items initial-load and pagination failures now use an Items-specific recovery helper instead of rendering raw Swift `localizedDescription` text. Network and decode failures now get friendly Retry/Refresh-oriented copy while existing API/server messages remain available. Added `tests/ios-items-error-copy.test.ts`.
- 2026-06-06: Verified the Items load error-copy slice with `npx vitest run tests/ios-items-error-copy.test.ts tests/ios-items-retired-reserve-gating.test.ts tests/ios-items-favorite-recovery.test.ts tests/ios-items-row-accessibility.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-06: Shipped the Items empty-state recovery slice. Native Items no-result states now offer Clear search when search text hides matches and Show all items when the Favorites filter produces an empty view. The slice preserves search, Favorites, Status scopes, pull-to-refresh, row actions, and the unfiltered no-inventory copy. Added `tests/ios-items-empty-state-recovery.test.ts`.
- 2026-06-06: Verified the Items empty-state recovery slice with `npx vitest run tests/ios-items-empty-state-recovery.test.ts tests/ios-items-error-copy.test.ts tests/ios-items-retired-reserve-gating.test.ts tests/ios-items-favorite-recovery.test.ts tests/ios-items-row-accessibility.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build/run for `Wisconsin` Debug on `iPhone 17 Pro`. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-06: Shipped the Schedule list Dynamic Type slice. Native Schedule list date headers, My Shift chips, Home/Away labels, crew coverage icons, shift labels, and weather microcopy now use semantic SwiftUI fonts instead of fixed point sizes. The date rail uses `minWidth` instead of a fixed width so larger text has room to scale, while monospaced digits remain for scanning dates, times, and crew counts. Added `tests/ios-schedule-dynamic-type.test.ts`.
- 2026-06-06: Verified the Schedule list Dynamic Type slice with `npx vitest run tests/ios-schedule-dynamic-type.test.ts tests/ios-schedule-calendar-hit-targets.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. XcodeBuildMCP was unavailable because `session_show_defaults` closed its transport twice, so the build used the shell fallback. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed; the new TypeScript file is a focused Vitest source contract.
- 2026-06-06: Shipped the Scan result retry-recovery slice. Native Scan lookup failures now show Try again before Type code instead, retry the last scanned code in place, and clear the same-code dedupe guard before retrying so the recovery action is immediate. The slice keeps lookup-only scope, kiosk custody boundaries, camera permission recovery, torch/manual entry, and single-asset auto-jump behavior intact. Added `tests/ios-scan-result-retry.test.ts`.
- 2026-06-06: Verified the Scan result retry-recovery slice with `npx vitest run tests/ios-scan-result-retry.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. XcodeBuildMCP was unavailable because `session_show_defaults` closed its transport, so the build used the shell fallback. `npx tsc --noEmit` was not needed because no shared TypeScript or API route code changed.
