# Completed iOS HIG and Schedule Trade Cleanup - 2026-06-05

Archived from `tasks/todo.md` on 2026-06-18. Internal Public Beta Launch Readiness remains active because its release-cut item is unchecked.

## Completed: iOS HIG and iOS 27 Readiness (2026-06-05)
- [x] Create the active goal for HIG/iOS 27 readiness.
- [x] Open a source-grounded slice plan in `tasks/ios-hig-ios27-readiness-plan.md`.
- [x] Refresh the existing Apple HIG audit against current SwiftUI source and current Apple guidance.
- [x] Pick one narrow HIG improvement slice after the refreshed audit.
- [x] Implement the global-search QR scanner HIG polish slice.
- [x] Sync docs and run the iOS verification stack.

**Review**
- Active tracking lives in `tasks/ios-hig-ios27-readiness-plan.md`.
- Current root issue: `tasks/hig-audit-ios.md` and `tasks/ios-swift62-liquidglass-plan.md` already exist, but the app has shipped several iOS control-clarity and readiness slices since then. The audit needs to be reconciled against current source before any new UI change is safe.
- Direction: treat WWDC26 on June 8, 2026 as the point where iOS 27 specifics become actionable. Until then, improve against the current HIG and avoid deployment-target or Swift-toolchain changes without fleet confirmation.
- Selected slice: the global-search QR scanner shortcut still lagged behind the primary Scan tab's HIG posture. It used a cold permission request, 36pt overlay controls, alert-based manual entry, a white-tinted progress indicator, auto-clearing errors, and no error haptic. The implementation keeps lookup behavior unchanged while aligning the QR shortcut with current scanner recovery patterns.
- Shipped: the QR shortcut now uses the shared scan permission pre-prompt/denied recovery, 44pt overlay controls, safe-area controls, sheet-based manual entry, a VoiceOver keyboard path, persistent recovery actions for lookup errors, and error haptics.
- Follow-up shipped: Trade Board claim/cancel failures now stay in the sheet with a recoverable banner, Refresh, Dismiss, and error haptics instead of a generic OK-only alert.
- Verified: `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build for `Wisconsin` Debug passed. `npx tsc --noEmit` was skipped because this slice did not touch shared TypeScript or API code.
- Follow-up shipped: native Bookings empty states now recover directly. Search-empty offers Clear search, Mine-empty offers Show all visible bookings, and the empty Reservations tab can open New Reservation. This improves HIG-style recovery without adding deferred desktop status/sort filters.
- Follow-up shipped: native Login now restores the `Need an account?` link to the web register page, matching the allowlist onboarding contract and device walkthrough without adding native open signup.
- Follow-up shipped: native forced-password setup now keeps password requirements visible while users complete first sign-in, preserving the existing `/api/me/change-password` flow while making the form feedback clearer.
- Follow-up shipped: native Schedule Calendar day cells now keep their compact date-circle look while expanding the interactive day target to the 44pt mobile baseline.
- Follow-up shipped: native Notifications mark-read and mark-all-read now restore unread state and show recovery if the server rejects the mutation, instead of silently presenting a false read state.
- Follow-up shipped: native Trade Board cancellation now calls the current PATCH route and updates from the returned trade, preventing a false local cancel when the server rejects the mutation.
- Follow-up shipped: native Login password visibility now has explicit VoiceOver action and state copy, so the eye button reads as Show password or Hide password with Password hidden or Password visible state.
- Follow-up shipped: native forced-password setup now matches that accessibility pattern, so the shared show/hide-passwords button exposes Passwords hidden or Passwords visible state.
- Follow-up shipped: native Items rows now preserve the combined operational VoiceOver label and add a Double-tap to view item details hint.
- Follow-up shipped: native Items favorite actions now keep optimistic update plus rollback behavior and show a shared non-blocking toast when the server rejects the favorite change, closing the prior silent-revert audit item.
- Follow-up shipped: native retired Items stay visible as Retired but no longer expose Reserve from list swipe actions, row context menus, or item detail, keeping reservation affordances state-appropriate.
- Follow-up shipped: native Items initial-load and pagination failures now show recovery-oriented copy instead of raw Swift error descriptions while preserving Retry and pull-to-refresh behavior.
- Follow-up shipped: native Items filtered empty states now recover directly. Search-empty offers Clear search, and Favorites-only empty states offer Show all items without changing search, Favorites, Status scope, row actions, or the no-inventory copy.
- Follow-up shipped: native Schedule list microcopy now uses semantic SwiftUI fonts instead of fixed point sizes for date headers, My Shift chips, Home/Away labels, coverage icons, shift labels, and weather text, with the date rail widened by minimum width instead of a fixed width.
- Verified: focused Schedule Dynamic Type tests, iOS drift, iOS audit inventory, whitespace check, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` passed. XcodeBuildMCP was unavailable because its transport closed twice, so the simulator build used the shell fallback.
- Follow-up shipped: native Scan result errors now offer Try again before Type code instead, retry the last scanned value after clearing same-code dedupe, and keep lookup-only scope plus kiosk custody boundaries unchanged.
- Verified: focused Scan retry tests, iOS drift, iOS audit inventory, whitespace check, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` passed. XcodeBuildMCP was unavailable because its transport closed, so the simulator build used the shell fallback.

## Completed: iOS Schedule Detail and Trade Control Clarity (2026-06-03)
- [x] Audit mobile, shifts, walkthrough, event-detail audit notes, trade-board audit notes, post-trade audit notes, and current Swift files.
- [x] Write active slice plan in `tasks/archive/completed-2026-06/ios-schedule-detail-trade-control-clarity-plan-2026-06-03.md`.
- [x] Make Event Detail shift actions visibly self-describing.
- [x] Make Trade Board and Post Trade controls visibly self-describing.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking lives in `tasks/archive/completed-2026-06/ios-schedule-detail-trade-control-clarity-plan-2026-06-03.md`.
- Current root issue: Schedule detail and trade flows are functionally hardened, but dense rows still use short visible action copy such as Assign, Request, Approve, Decline, Claim Shift, and Post.
- Implemented: Event Detail now labels Add shift, Assign person, Request shift, and pending request approvals/declines with names; Trade Board/Post Trade now label Post trade, Claim this shift, Choose Shift to Trade, and Post Trade.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.
