# Completed Booking Flow and Notification Category Cleanup - 2026-06-10

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: Booking Flow Follow-up (2026-06-10)
- [x] **Open slice plan** - Started `tasks/booking-flow-followup-plan.md` for the handoff from the visual booking-flow refresh.
- [x] **Web duration parity** - Preserve the booking duration when the web Step 1 start date changes.
- [x] **Native picker parity** - Add scan-to-add and bulk/countable item selection to iOS booking creation, including typed `bulkItems` submission.
- [x] **Focused coverage** - Add regression coverage for duration-preserving web date edits.
- [x] **Verification and review** - Run focused tests, typecheck, whitespace checks, iOS drift/audit checks, and record the authenticated browser-smoke status.

**Review**
- 2026-06-10: Web checkout/reservation creation now preserves the booking duration when the Step 1 start date changes, matching iOS `adjustStart(to:)`. Invalid existing windows stay invalid so validation still blocks them.
- 2026-06-10: Authenticated local browser smoke passed on `/checkouts/new` using the seeded admin account. Moving Pickup from 7:00 AM to 9:30 AM shifted Return by from the next day at 7:00 AM to 9:30 AM; no visible `\u2026` escape literals and no console warnings/errors were found. Screenshot proof saved at `tasks/archive/proofs/booking-flow-followup-checkout-new.png`.
- 2026-06-10: Native picker parity remains the next first-class booking-flow slice: scan-to-add, bulk battery selection, and advisory availability context are real gaps, but they touch the iOS picker model/API contract rather than this web reducer fix.
- 2026-06-10: Native picker parity shipped for iOS reservation creation. The Equipment step can scan serialized gear into the selection, add countable/bulk supplies such as batteries by quantity, carry those selections into the selected tray and Review step, and submit typed `bulkItems` through the existing reservation create API. Richer bulk/next-use advisory context remains follow-up polish.

## Completed: iOS Notifications Category Parity Slice (2026-06-10)
- [x] **Open slice plan** - Started `tasks/archive/completed-2026-06/ios-notifications-category-parity-plan-2026-06-10.md` for native Profile notification type toggles.
- [x] **Native category controls** - Add iOS Profile toggles for checkout due, checkout overdue, reservation, and license expiry notification categories.
- [x] **Preference save helpers** - Route single-category changes through `NotificationPrefsViewModel` while preserving legacy missing-category defaults.
- [x] **Focused contract coverage** - Add source tests proving API defaults, native model fields, web labels, Profile labels, and native save path stay aligned.
- [x] **Docs and verification** - Sync mobile/notification docs and run the iOS verification stack.

**Review**
- 2026-06-10: Native Profile now exposes the existing web-backed `Notification types` controls for checkout due reminders, checkout overdue alerts, reservation updates, and license expiry reminders. This changes the iOS control surface only; server delivery rules, category names, and in-app inbox behavior are unchanged.
- 2026-06-10: `NotificationPrefsViewModel` defaults missing legacy category JSON to all enabled before applying a single toggle, then saves the full category object through the existing optimistic preference save path.
- 2026-06-10: Focused contract coverage pins the API defaults, native model fields, web labels, native Profile labels, and native category save path so future category drift fails in tests.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-notification-categories-profile.test.ts tests/ios-api-contract.test.ts tests/ios-notifications-token-honesty.test.ts tests/ios-notifications-tapthrough.test.ts tests/ios-notifications-read-recovery.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.
