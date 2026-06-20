# Kiosk and iOS Follow-ups - 2026-06-15

Moved from `tasks/todo.md` during orchestrator cleanup. These sections were fully checked off and are retained here for review/proof history. The 2026-06-12 kiosk pickup post-deploy verification remains in the live queue because it still has an unchecked item.

---

## Active: iOS hand-scanner debugger (2026-06-15)

- [x] Add a staff/admin Settings -> Tools entry for scanner debugging.
- [x] Capture hand-scanner HID keyboard input with the existing hidden scanner field pattern.
- [x] Submit scanner values through the native lookup service and reuse the scan hero-card sheet.
- [x] Show raw/trimmed scan value and lookup status for hardware debugging.
- [x] Harden Settings launch by presenting Scanner Debugger as its own sheet instead of a `ProfileDestination` value link.
- [x] Verify iOS drift, audit inventory, whitespace, and simulator build.

### Review
- 2026-06-15: Hardened the Scanner Debugger launcher after device testing surfaced SwiftUI's "no matching navigationDestination" warning for the `ProfileDestination.scannerDebugger` value link. The Settings row now presents the debugger modally, and the debugger keeps its own `NavigationStack` for scan-result item/booking pushes plus a Done control to close the tool.
- 2026-06-15: Shipped a staff/admin Scanner Debugger under Settings -> Tools. It captures HID hand-scanner input through the same hidden text-field pattern as kiosk, shows raw and trimmed scan values, submits through native `SearchService`, and reuses `ScanResultSheet` so a successful scan opens the existing serialized/item-family hero card. Added the focused audit note and registered the debugger plus previously unregistered shared scan/avatar components in the iOS audit inventory. Verification passed: `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated iOS simulator `xcodebuild` (`BUILD SUCCEEDED`).

---

## Active: Kiosk activation reset fallback (2026-06-15)

- [x] Audit why the current admin flow makes rebuild reactivation painful.
- [x] Allow active kiosk devices to generate a new one-time code without deleting the device row.
- [x] Revoke the previous kiosk session when a new code is generated.
- [x] Confirm Settings copy makes the reset/sign-out behavior explicit.
- [x] Sync kiosk docs and lessons.
- [x] Verify focused tests, typecheck/build, and whitespace.

### Review
- 2026-06-15: Settings -> Kiosk Devices can now reset an existing active kiosk's activation code without deleting the device row. Resetting confirms the sign-out behavior, revokes the old kiosk session, clears activation/last-seen state, shows a fresh one-time code, and reloads the device list back to pending activation.
- Verification: `npx vitest run tests/settings-kiosk-devices-location-state.test.ts`, focused `npx eslint` on the touched route/page/test, `git diff --check`, and `npx next build` passed. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.

---

## Active: Wiscard profile capture (2026-06-15)

- [x] Add a unique nullable Wiscard value field on user profiles so existing accounts migrate safely.
- [x] Require Wiscard value during invite-gated signup.
- [x] Expose Wiscard value on self-profile and staff/admin user profile editing.
- [x] Block duplicate Wiscard values with clear API errors.
- [x] Let kiosk idle resolve a scanned Wiscard to the location-scoped user selection.
- [x] Reconcile serialized item locations to the kiosk location on kiosk scan, pickup, checkout, and return completion.
- [x] Flag kiosk custody scans when an item's stored location does not match the kiosk/booking expected location before reconciliation.
- [x] Update user/profile docs for the new required signup field and kiosk identity direction.
- [x] Verify TypeScript, Prisma generation/build, and affected tests.

### Review
- 2026-06-15: Added `User.wiscardNumber` with a nullable unique migration, required it on invite-gated registration, exposed it on self-profile and staff/admin user detail editing, and kept duplicate conflicts explicit without writing the raw value into audit after state.
- 2026-06-15: Added kiosk Wiscard selection through `POST /api/kiosk/identify` and native idle scanner handling. Successful Wiscard scans open the student hub for active users scoped to the kiosk location; the roster grid remains the fallback.
- 2026-06-15: Serialized kiosk checkout/pickup/return scans now reconcile `Asset.locationId` to the kiosk location. Pickup and return scan events store expected and actual location IDs plus `locationMismatch` evidence so wrong-location handoffs are visible after the fact.
- Verification: `npm run prisma:generate`, `npm run db:migrate:check`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, `npx next build`, and iOS simulator `xcodebuild` all passed. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning. Full `npm run build` was not run to completion because its migration-deploy step needs external Neon access and escalation was rejected as database-mutating.

---

## Active: Kiosk numbered battery scanner hardening (2026-06-15)

- [x] Add optional photo payloads to kiosk checkout scan results.
- [x] Render scanned checkout rows with asset/SKU thumbnails and resilient fallbacks.
- [x] Verify checkout photo rail tests, iOS drift/audit, TypeScript, web build, whitespace, and simulator build.
- [x] Trace kiosk pickup/return scan flow for numbered battery units.
- [x] Harden derived battery QR parsing for scanner-shaped values.
- [x] Harden the iOS HID scanner field for scanners without a Return suffix.
- [x] Add focused parser and kiosk service regression tests.
- [x] Verify focused tests, iOS drift/audit, whitespace, web build, and simulator build.
- [x] Harden direct-checkout completion for old/new iOS battery cart payloads.
- [x] Include checked-out numbered battery units in kiosk dashboard stats, active-items, and checkout previews.
- [x] Verify battery persistence/display tests, TypeScript, web build, iOS drift/audit, whitespace, and simulator build.

### Review
- 2026-06-15: Kiosk checkout UI follow-up from device screenshot: scan responses now carry optional `imageUrl` for serialized assets and numbered bulk units, `KioskCartItem` preserves it, and the checkout scanned-items rail renders 56pt thumbnails with battery/camera fallbacks plus a slightly wider, denser row layout. The server field is additive and Swift keeps it optional for API rollout skew.
- Verification: `npx vitest run tests/kiosk-checkout-scan-badges.test.ts tests/ios-api-contract.test.ts tests/kiosk-checkout-complete-bulk-units.test.ts tests/kiosk-dashboard-route.test.ts tests/bulk-unit-qr.test.ts tests/bulk-unit-kiosk-scans.test.ts` passed 50 tests, focused `npx eslint` on touched files passed, `npm run drift:ios` passed, `npm run audit:ios:gaps` passed, `git diff --check` passed, `npx next build` passed with existing repo warnings, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` exited cleanly with only the existing AppIntents metadata warning. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.
- 2026-06-15: Follow-up after device testing showed scanned batteries did not persist/display from direct kiosk checkout. Root cause: scan lookup could return a synthetic cart ID (`bulk:{sku}:unit:{n}`) while older native builds could still submit it as `assetId`; checkout completion now normalizes that legacy shape into the numbered bulk write path, creating the same booking bulk item/unit allocation as the newer typed payload. The kiosk idle dashboard now includes checked-out numbered units in Items Out, active-items, and active checkout previews, so battery-only checkouts are visible from the idle screen.
- Verification: `npx vitest run tests/kiosk-checkout-complete-bulk-units.test.ts tests/kiosk-dashboard-route.test.ts tests/kiosk-checkout-scan-badges.test.ts tests/bulk-unit-qr.test.ts tests/bulk-unit-kiosk-scans.test.ts` passed 30 tests, focused `npx eslint` on touched files passed, `npm run drift:ios` passed, `npm run audit:ios:gaps` passed, `git diff --check` passed, `npx next build` passed with existing repo warnings, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` exited cleanly with only the existing AppIntents metadata warning. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.
- 2026-06-15: Kiosk numbered battery scans now normalize scanner-shaped derived QR values before custody flows fall back to serialized asset lookup: legacy `QR-` prefixes, URL/query wrappers, Unicode dash separators, and non-printing scanner control bytes resolve to the same `{binQrCodeValue}-{unitNumber}` identity. Direct kiosk checkout now supports scanned battery units end-to-end by carrying `{bulkSkuId, unitNumber}` through the native cart and complete request, creating booking bulk rows/unit allocations, marking units checked out, and decrementing bulk balance. The shared native `KioskScannerField` also submits buffered HID input after a conservative idle window, so hand-scanner profiles without a Return suffix still trigger the kiosk scan without submitting partial values before the unit suffix arrives.
- Verification: `npx vitest run tests/bulk-unit-qr.test.ts tests/bulk-unit-kiosk-scans.test.ts` passed 22 tests, `npm run drift:ios` passed, `npm run audit:ios:gaps` passed, `git diff --check` passed, `npx next build` passed, and iOS simulator `xcodebuild` completed with only the existing App Intents metadata warning. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.

---

## Active: Kiosk checkout event context (2026-06-15)

- [x] Add a kiosk-authenticated upcoming-events feed capped to the next 7 days.
- [x] Require every kiosk direct checkout to include either a selected event or custom purpose.
- [x] Use the selected event or custom purpose as the booking title instead of a generic kiosk title.
- [x] Link selected events through both `Booking.eventId` and `BookingEvent`.
- [x] Add native kiosk UI for choosing an event and typing custom details before checkout completion.
- [x] Verify focused tests, TypeScript, iOS drift/audit, whitespace, web build, and simulator build.
- [x] Add selected-student/location/context summaries across setup, scan, review, and success states.
- [x] Add quick custom-purpose chips and a clearer no-events state.
- [x] Add scanner health/troubleshooting status in scan mode.
- [x] Group numbered batteries in the scanned-items rail.
- [x] Add a final review sheet before submitting checkout.
- [x] Verify focused tests, iOS drift/audit, whitespace, and simulator build after polish.
- [x] Add kiosk checkout due-back time support with event-based defaults.
- [x] Add kiosk-authenticated availability/conflict checks for scanned checkout carts.
- [x] Enforce the same conflict checks inside checkout completion.
- [x] Show conflict status in the native checkout setup, scan rail, and review sheet.
- [x] Verify focused tests, TypeScript status, iOS drift/audit, whitespace, and simulator build.

### Review
- 2026-06-15: Kiosk checkout now requires an event or custom purpose before completion. Native checkout loads kiosk-authenticated upcoming events from the next 7 days, shows a required Event or Purpose card, sends `eventId` plus optional custom details, and disables completion until context exists. The server enforces the same rule, titles the booking from the event or typed purpose, and writes selected events to both `Booking.eventId` and `BookingEvent`.
- 2026-06-15 follow-up: Moved the event/purpose form into a pre-scan setup phase. The hidden HID scanner field is now only mounted after Start Scanning, so typing a custom purpose no longer gets intercepted as an item code. Scan mode keeps a compact context summary with Edit to return to the setup phase without clearing the cart.
- 2026-06-15 polish pass: Checkout now passes the selected `KioskUser` into the flow, shows student/location/context summaries in setup, scan, side rail, review, and success copy, offers quick purpose chips for no-event days, exposes scanner health/troubleshooting from scan mode, groups numbered battery units into one row with unit chips, and adds a final review sheet before the checkout mutation. Editing context after scans now confirms that the cart will be preserved.
- Verification: `npx vitest run tests/kiosk-events-route.test.ts tests/kiosk-checkout-complete-bulk-units.test.ts tests/ios-api-contract.test.ts` passed 26 tests, focused `npx eslint` on touched API/test files passed, `npm run drift:ios` passed, `npm run audit:ios:gaps` passed, `git diff --check` passed, `npx next build` passed with existing repo warnings, and escalated iOS simulator `xcodebuild` ended with `BUILD SUCCEEDED`. `npx tsc --noEmit --pretty false` remains blocked only by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.
- 2026-06-15 due-back/conflict pass: Checkout details now keep pickup as the actual completion time and ask staff only for a return date/time. Selected events prefill due-back from event end, quick time buttons cover common flows, the iPad preflights scanned carts through `/api/kiosk/checkout/availability`, scan/review surfaces show blocking conflicts and tight-turnaround warnings, and completion repeats the same availability check inside the transaction before booking/allocation writes.
- Verification: `npx vitest run tests/kiosk-checkout-complete-bulk-units.test.ts tests/kiosk-checkout-availability-route.test.ts tests/ios-api-contract.test.ts tests/kiosk-events-route.test.ts` passed 29 tests, focused `npx eslint` on touched API/test files passed, `npm run drift:ios` passed, `npm run audit:ios:gaps` passed, `git diff --check` passed, and escalated iOS simulator `xcodebuild` exited cleanly with only the existing AppIntents metadata warning. `npx tsc --noEmit --pretty false` remains blocked only by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.

---

## Active: Kiosk iOS UI consolidation + brand polish (2026-06-13)

Goal: `/frontend-design` pass on all 9 iOS kiosk SwiftUI views, **within the
existing design system** (COLOR_SYSTEM.md + DESIGN_LANGUAGE.md operational/calm
personality). The code is already mature; this pass removes design-system drift
and duplication and adds restrained Wisconsin-brand polish. User chose **full
consolidation** + **Gotham on brand moments**.

### Findings (audit)
- `FeedbackBanner` reimplemented 4x (checkout/pickup/return + camera overlay).
- `BatteryScanStatus` + `FlexibleUnitChips` duplicated pickup↔return; `progressRing`,
  the Back/Title/Camera header, the wifi-error state, avatar→initials all repeated.
- No shared token scale: base bg differs per screen (#0B0B0D/#08080A/#0A0A0C),
  12+ ad-hoc white-opacity fills (0.02–0.18), radii 9–24 with no scale.
- Inconsistencies: pickup ring red vs return ring blue; pickup CTA green vs
  checkout/return CTA red; pickup green accents vs COLOR_SYSTEM PENDING_PICKUP=orange;
  overdue rendered orange in places (COLOR_SYSTEM OVERDUE=red); sub-44px buttons.

### Design decisions (documented; tracing to COLOR_SYSTEM)
- **kioskRed** = brand primary actions (CTAs, numpad ✓, checkout count, hero icon).
- **Completion CTAs** (Complete Checkout / Confirm Pickup / Complete Return) →
  kioskRed when ready (pickup changes green→red to match the other two).
- **Progress ring/bar** in-progress = blue, complete = green (pickup changes red→blue).
- **Hub action icons**: Checkout=kioskRed, Pickup=orange (awaiting), Return=blue
  (overdue→red).
- **Overdue** = red everywhere (was orange in return label + hub return icon).
- **Green** reserved for success/done states + scan-success. **Mono clock unchanged**
  (documented anti-jitter decision). Gotham Black/Bold on flow titles, activation
  hero, success message (matches web PageHeader).

### Slices
- [x] Slice 1 -- Foundation: new `KioskDesign.swift` (KioskSurface/Stroke/Radius/Text
      tokens, `kioskCard()` modifier, `KioskBannerTone`, kiosk font helpers) +
      `KioskComponents.swift` (KioskFlowHeader, KioskFeedbackBanner, KioskProgressRing,
      KioskAvatar, KioskChecklistRow, KioskBatteryScanStatus, KioskUnitChips,
      KioskErrorState, KioskCompletionButton). `xcodegen generate` + restore
      entitlements + build.
- [x] Slice 2 -- Migrate flow views (checkout/pickup/return) onto shared components;
      apply ring/CTA/overdue color fixes; 44px targets on header + remove buttons.
- [x] Slice 3 -- Migrate idle/studentHub/activation/success onto tokens + KioskAvatar;
      unify surface base; Gotham brand moments; hub pickup icon→orange, return
      overdue→red. Keep mono clock + sleep mode behavior.
- [x] Slice 4 -- Verify (`xcodebuild` un-sandboxed, `npm run drift:ios`,
      `audit:ios:gaps`, `git diff --check`) + docs (AREA_KIOSK change log,
      COLOR_SYSTEM iOS rules note, lessons). Commit/push pending user review.

### Constraints
- No behavior/logic/API changes -- UI only. No decorative gradients/grain (design
  language forbids). Verification is compile + source review (cannot boot the live
  iPad UI here). New files require `xcodegen generate`; restore `Wisconsin.entitlements`
  after (xcodegen quirk). xcodebuild must run un-sandboxed (CoreSimulator perms).

### Review
- 2026-06-13: Shipped the full consolidation. Two new files -- `KioskDesign.swift`
  (137 lines of tokens) and `KioskComponents.swift` (445 lines of shared views) --
  now back all nine kiosk screens. The migration removed 863 lines from the views
  for 296 added (net -567 in the existing files), with the feedback banner alone
  collapsing from four copies to one.
- Cross-view inconsistencies resolved against COLOR_SYSTEM: progress rings are
  blue→green everywhere (pickup was red), completion CTAs are brand red everywhere
  (pickup was green), the student-hub pickup action is orange (awaiting), and
  overdue is red (was orange in the return label + hub return icon). Gotham now
  carries the activation hero, flow titles, and success message; the monospaced
  idle clock is intentionally unchanged (documented anti-jitter decision).
- Idle/standby was light-touched on purpose: it was tuned over ~10 iterations and
  its bespoke dashboard fills differ from the new rungs by <0.02 alpha, so only the
  clean, risk-free swaps landed there (event-sheet base color, two avatars →
  `KioskAvatar`). The event-avatar stack and the overdue-ring checkout avatar stay
  bespoke. Full idle tokenization is an optional follow-up.
- 44pt touch targets added to the flow header back/camera buttons and the checkout
  remove-item control. Surface base unified to #0B0B0D across shell/activation/sheet.
- UI-only: no API, model, or flow-logic changes. New files registered as exempt in
  `scripts/ios-audit-inventory.sh`. Stale "restore entitlements after xcodegen"
  belief corrected -- `project.yml` now declares the entitlement properties, so
  regeneration is byte-identical (sha-verified).
- Verification: `xcodebuild` BUILD SUCCEEDED (×3, one per slice), `npm run drift:ios`
  clean (50 files), `npm run audit:ios:gaps` 35/35 covered, `git diff --check` clean.
  Cannot boot the live iPad UI here, so visual sign-off on device is the user's.
- Pre-existing uncommitted WIP from the prior session (KioskAPIClient/Store/Idle,
  project.yml, etc.) was built on but is logically separate; flagged for the user
  before committing.

