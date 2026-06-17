# Task Queue

Last updated: 2026-06-16

---

## Active: iOS Schedule all-day display correction (2026-06-16)

- [x] Trace the latest screenshots to regular native Schedule and EventDetailSheet, not kiosk.
- [x] Preserve manual event titles when sport metadata has no opponent.
- [x] Use all-day display fallback for list-row timing, EventDetail call-time prompts, and crew-row time columns.
- [x] Add focused source-contract coverage for the iPhone Schedule regression.
- [ ] Verify focused tests, iOS drift/audit, whitespace, and simulator build status.

### Review
- Pending verification.

---

## Active: Kiosk all-day fallback correction (2026-06-16)

- [x] Re-check the kiosk screenshot and identify every visible time still leaking for the all-day event.
- [x] Add server fallback detection for local midnight-to-midnight event spans when `CalendarEvent.allDay` is stale.
- [x] Add native fallback detection for all-day display when the deployed API payload is stale or missing the flag.
- [x] Suppress aggregate call times and worker call ranges for derived all-day events.
- [x] Verify kiosk route coverage, iOS source contract, drift/audit, whitespace, build status.

### Review
- 2026-06-16: The kiosk now treats local midnight-to-midnight event spans as all-day even when the stored `CalendarEvent.allDay` flag is stale or an older API payload omits it. `/api/kiosk/dashboard` derives `allDay`, nulls aggregate event call ranges, and nulls worker call ranges for those derived all-day events. Native `KioskEvent.displayAllDay` applies the same fallback before rendering the idle row, detail timing rows, and worker sublines.
- Verification: `npx vitest run tests/kiosk-dashboard-route.test.ts tests/ios-kiosk-all-day-contract.test.ts`, focused `npx eslint`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, `npx next build`, and XcodeBuildMCP `build_sim` on iPad Pro 13-inch (M5) passed. `npx tsc --noEmit --pretty false` remains blocked only by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.

---

## Active: Dashboard upcoming event title cleanup (2026-06-16)

- [x] Trace the web Upcoming Events row formatter from the screenshot symptom.
- [x] Confirm the API already provides the real event title plus sport metadata.
- [x] Preserve manual event titles when no opponent exists.
- [x] Add focused regression coverage for the Lambeau-style case.
- [x] Verify focused test, lint, whitespace, typecheck/build status.

### Review
- 2026-06-16: Dashboard Upcoming Events now preserves manual event titles when `sportCode` exists without an opponent, so the Lambeau Field Visit card renders as `Lambeau Field Visit` instead of falling back to `Football`. Structured sport matchups still render with sport plus vs/at opponent copy.
- Verification: `npx vitest run tests/dashboard-event-title.test.ts`, focused `npx eslint`, `git diff --check`, and `npx next build` passed. The first `npx tsc --noEmit --pretty false` run failed before build because stale `.next/types` files were missing; after `npx next build`, `tsc` returned only the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.

---

## Active: iOS kiosk all-day call-time cleanup (2026-06-16)

- [x] Audit kiosk docs, mobile/event/shift contracts, Prisma event/shift fields, and prior kiosk event/call split.
- [x] Confirm `/api/kiosk/dashboard` owns the iOS idle event payload and currently omits `allDay`.
- [x] Add `allDay` to the kiosk dashboard event contract with rollout-safe Swift decoding.
- [x] Suppress kiosk call-time rows for all-day events while preserving timed event call ranges.
- [x] Add focused regression coverage and verify web/API plus iOS checks.

### Review
- 2026-06-16: iOS kiosk now receives `allDay` on idle dashboard events, decodes it safely in `KioskEvent`, shows all-day rows as `All day`, hides the event detail `Call` row, and removes worker call ranges for all-day events. Timed kiosk events still show event and call ranges separately.
- Verification: `npx vitest run tests/kiosk-dashboard-route.test.ts tests/ios-kiosk-all-day-contract.test.ts`, focused `npx eslint`, `git diff --check`, `npm run drift:ios`, `npm run audit:ios:gaps`, XcodeBuildMCP `build_sim` on iPad Pro 13-inch (M5), and `npx next build` passed. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning. The broad `tests/student-field-contracts.test.ts` suite also has pre-existing stale source assertions unrelated to this slice.

---

## Active: Laowa 10mm item detail crash trace (2026-06-16)

- [x] Trace the items-list click path for the Laowa 10mm lens.
- [x] Inspect the newly-created item row and compare it with working item rows.
- [x] Identify whether the failure is route construction, API shape, data shape, or client rendering.
- [x] Fix the smallest root cause if code is responsible.
- [x] Verify with focused tests/build checks and browser/API proof where the environment allows.

### Review
- 2026-06-16: Root cause was client rendering, not route construction. Item detail treated `serialNumber` as a required string even though `Asset.serialNumber` is nullable; a newly-created Laowa 10mm lens with no serial number passed `null` into the Serial text field, which called `.trim()` during render and tripped the app error boundary. The shared item-detail text field now normalizes null/undefined values to an empty string, the detail type reflects nullable serial numbers, and the serial copy callback plus image-search seed helper are null-safe.
- Verification: focused Vitest (`tests/item-detail-firmware-display.test.ts`, `tests/items-response-parsing.test.ts`, `tests/item-detail-actions-source.test.ts`), focused ESLint, `git diff --check`, and `npx next build` passed. `npx tsc --noEmit --pretty false` is still blocked only by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning. Live Prisma/API proof for the real Laowa row could not run because this environment cannot reach the Neon database, even with approval.

---

## Active: Event all-day call-window display cleanup (2026-06-16)

- [x] Reproduce the visible issue from the screenshot: the event header shows the all-day date and a duplicate inherited `Call Jun 17, 12:00 AM - Jun 18, 12:00 AM` range.
- [x] Confirm the route uses `CalendarEvent.allDay` with exclusive end dates and shift default windows inherited from the event boundary.
- [x] Hide inherited midnight-to-midnight call windows on all-day event detail chrome while preserving explicit slot or personal call-time overrides.
- [x] Add focused regression coverage for hidden inherited all-day windows and visible explicit overrides.
- [x] Verify focused tests, typecheck status, whitespace, and build. Browser smoke was attempted but blocked because Neon was unreachable from this environment.

### Review
- 2026-06-16: The double label was display duplication, not two separate operational call times. The event title cluster already owns the all-day event date; default shift and assignment call windows were inheriting the same local full-day boundary and rendering it as midnight-to-midnight. Event detail and schedule list now suppress inherited full-day default windows, leaving the date-only event label and crew rows without the redundant time.
- Verification: `npx vitest run tests/shift-call-windows.test.ts tests/calendar-event-dates.test.ts`, focused `npx eslint`, `git diff --check`, `npm run db:migrate:check`, and `npx next build` passed. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning. Browser smoke could not reach the real event because both sandboxed and approved Prisma reads could not connect to Neon.

---

## Active: Kiosk-only custody contract (2026-06-15)

Plan: `tasks/kiosk-only-custody-plan.md`

- [x] Capture the product decision: app/web cannot check out or return gear; only kiosk custody flows can.
- [x] Ground the plan in current checkout, reservation, scan, kiosk, and schema contracts.
- [x] Decide the source-reservation close state when kiosk pickup creates the active checkout.
- [x] Slice 1: Contract docs and decision sync.
- [x] Slice 2: Server-side custody boundary enforcement.
- [x] Slice 3: Web/app affordance removal and reservation-first creation.
- [ ] Slice 4: Kiosk reservation pickup path.
- [ ] Slice 5: Reporting, search, wording, tests, and browser/iOS verification.

### Review
- 2026-06-15: Product direction is now explicit: checkout in its current web/app form is eliminated. If a user is not physically at a kiosk picking gear up, they reserve gear. Direct immediate checkout remains kiosk-only. Return remains kiosk-only. `PENDING_PICKUP` may survive as a derived waiting state once a reservation reaches its start window but has not yet been collected, not as a web/app-created custody path.
- 2026-06-15: Slice 1 synced the durable contract into `DECISIONS.md`, checkout/reservation/kiosk/scan area docs, and `GAPS_AND_RISKS.md`. Source reservations fulfilled by kiosk pickup should close as `COMPLETED`, preserving `sourceReservationId` on the linked checkout.
- 2026-06-15: Slice 2 shipped the server boundary: regular authenticated checkout creation, reservation conversion, checkout pickup completion, check-in completion, item/bulk returns, and custody scan-session starts now return kiosk-boundary errors. Focused Vitest coverage passed; TypeScript still stops on the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` warning.
- 2026-06-15: Slice 3 removed non-kiosk checkout creation, conversion, and return affordances from web and native non-kiosk surfaces. Dashboard, item detail, bookings, event missing-gear, and `/checkouts/new` now route remote booking creation to reservations; checkout detail/list views remain for active custody and history.

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

---

## Active: Kiosk pickup scan 500 + kiosk UI pass (2026-06-12)

Root cause: `scan_events.phase` is `text` in the live DB while schema declares
enum `ScanPhase` (table predates the migration baseline). Prisma generates
`phase = $1::"ScanPhase"`; Postgres rejects `text = "ScanPhase"` (42883).
Inserts bind as text and succeed, so drift surfaced only when the duplicate-scan
guard (`scanEvent.findFirst({ phase })`) shipped on the kiosk pickup path.
Secondary: DB-applied migration `0077_add_bulk_sku_image_rehost_attempts`
missing locally (lives on advisor/codex branches; schema field already on main).

- [x] Restore `0077_add_bulk_sku_image_rehost_attempts/` (exact name matches `_prisma_migrations` row)
- [x] Allow 0077 prefix collision in `scripts/check-migration-prefixes.mjs` (both already applied in prod)
- [x] Migration `0078_fix_scan_events_phase_enum`: `ALTER ... TYPE "ScanPhase" USING phase::"ScanPhase"`
- [x] `db:migrate:check` passes (80 migrations, no collisions); prod apply rides the Vercel build on push
- [ ] Post-deploy: verify `scan_events.phase` udt is `ScanPhase` and a kiosk pickup scan succeeds
- [x] Kiosk UI improvement pass (iOS `Kiosk/` views: idle, pickup, return + API error copy)
- [x] `npm run build` (passes), `xcodebuild` (BUILD SUCCEEDED), doc sync, commit + push

### Review
- Root cause was schema drift, not the scan code: `scan_events` predates the migration
  baseline, so `phase` stayed `text` while the schema declares enum `ScanPhase`. The
  2026-06-02 duplicate-scan guard added the first typed comparison on that column and
  every serialized pickup scan started 500ing. Inserts kept working (text binding),
  which is why the drift was invisible until then.
- Local `prisma migrate dev/deploy` can't reach Neon on 5432 from this network;
  `prisma-migrate-deploy.mjs` now also falls back to Neon HTTP on P1001, and the
  actual prod apply rides the normal Vercel build (`prisma migrate deploy`).
- iOS kiosk UI pass: friendlier 5xx copy, bigger rings + white guidance text,
  checklist progress summaries, smarter disabled CTAs, idle-screen empty state and
  stronger hierarchy. Compile-verified; visual sign-off on the iPad is the user's.
- Pre-existing test failures (2) on main flagged as a separate background task.

## Active: Kiosk dashboard final polish (2026-06-12)

Scope: close the remaining iPad kiosk dashboard polish before moving into the
user-specific kiosk pages. Data alignment is fixed; this pass is layout density,
readability, and debug-noise cleanup.

- [x] Compact event sections: remove noisy count badges and quiet empty rows.
- [x] Make event detail read-only sheet stop truncating real event/call ranges.
- [x] Make assigned-worker rows denser and clearer.
- [x] De-emphasize the DEBUG sleep toggle when inactive and hide debug capability logs outside DEBUG.
- [x] Sync kiosk docs and record verification.

### Review
- 2026-06-12: Final dashboard polish keeps the data model unchanged and tightens
  the iPad surface: Today/Tomorrow no longer show tiny count noise, empty event
  rows are plain muted text, stat selection has a clearer bottom marker, the
  event detail sheet uses full-width Event/Call rows to avoid truncating 3-5 and
  2-6 ranges, worker rows are compact enough for real crew lists, and the DEBUG
  sleep affordance/logging is quieter.

## Active: Kiosk iPad activation + idle polish (2026-06-12)

- [x] Add hardware keyboard entry for the kiosk activation code.
- [x] Replace fragile activation paste affordance with a dependable paste action.
- [x] Improve activation layout, contrast, and Dynamic Type resilience on iPad.
- [x] Tighten idle screen clock, event, checkout, and roster typography/contrast.
- [x] Switch the idle clock to Gotham Black.
- [x] Add burn-in mitigation sleep mode for night hours and truly idle kiosk windows.
- [x] Add pixel-shift movement to the sleep-mode overlay.
- [x] Add DEBUG top-right moon toggle to force sleep/night mode on and off.
- [x] Fix idle regression feedback: bigger single-line clock, higher-contrast date, no iPad deactivate button, kiosk name plus location header, clickable stat detail panels, upcoming event labeling, checkout-title rows, and denser roster cards.
- [x] Sync kiosk docs and attempt the Swift build path.

### Review
- 2026-06-12: Activation now supports hardware keyboard entry, delete, Return,
  Command-V via the focused hidden input, and a visible Paste Code action with
  clearer invalid/short-code feedback. Idle now uses Gotham Black for the clock,
  stronger contrast, adaptive roster sizing, and a server-driven burn-in
  mitigation sleep overlay. Sleep mode triggers during 10 PM-6 AM or truly idle
  windows, uses a very dim pixel-shifted clock cluster, and tap-to-wake gives
  staff 10 minutes before sleep can resume.
- 2026-06-12 follow-up: Idle regression pass restores the large glanceable
  single-line clock, removes the iPad deactivate affordance, changes the header
  to kiosk name plus location, makes stat cards select Items Out, Active
  Checkouts, and Overdue lists, adds asset image/name rows for active items,
  treats near/tomorrow events as Upcoming instead of Today, and adds a DEBUG
  moon toggle to force sleep/night mode for testing.
- Verification: `git diff --check` passed; `npx eslint src/app/api/kiosk/dashboard/route.ts`
  passed. `npx tsc --noEmit` remains blocked by pre-existing
  `tests/bulk-unit-adjustment-routes.test.ts:171`. iOS `xcodebuild` is blocked
  by local CoreSimulator `simdiskimaged` failures before useful Swift diagnostics.

## Active: Always-on kiosk — session persistence + standby display (2026-06-12)

Report: every Xcode rebuild bounced the iPad back to activation. Cause: the
kiosk_session cookie and KioskInfo live in the app container (HTTPCookieStorage
/ UserDefaults), which reinstalls wipe; plus the fixed 7-day session would have
forced weekly re-activation even on a healthy kiosk.

- [x] Server: `requireKiosk()` slides `sessionExpiresAt` on activity (~daily write throttle), cookie re-issued with slid expiry (D-039)
- [x] Server: `/api/kiosk/me` returns device `name` so the app can rebuild info after a wipe
- [x] iOS: session token mirrored to Keychain (`AfterFirstUnlock`), cookie re-created on launch, info rebuilt from /me; cleared on deactivate/401
- [x] iOS: activation also extracts `kiosk_session` from `Set-Cookie` when JSON `sessionToken` is absent during API rollout skew
- [x] iOS: XcodeGen bundle ID aligned with the checked-in Xcode project so regenerated builds keep the same Keychain access identity
- [x] iOS: kiosk shell disables system idle timer (screen never sleeps)
- [x] iOS: idle screen redesigned as standby display — live HH:MM:SS clock (1s TimelineView), Gotham date in brand red, TODAY event rows bolder
- [x] Tests updated (KioskContext mocks + kioskMe contract), tsc/vitest/xcodebuild/next build all pass
- [x] Docs: D-039, AREA_KIOSK change log

### Review
- The 7-day expiry now only ends sessions for kiosks dark a full week; admin
  deactivation still revokes instantly. Keychain copy outlives app deletion by
  design — deactivate() and the 401 path both clear it.
- Follow-up correction: persistence still failed on device because native
  activation only saved the token when the API JSON already included
  `sessionToken`. The app now falls back to extracting `kiosk_session` from
  `Set-Cookie`, so one more activation after this build should seed Keychain
  even if the deployed API and native build are briefly out of sync.
- Second persistence hazard fixed: `ios/project.yml` still used
  `com.erikrole.creative` while the checked-in Xcode project uses
  `com.erikrole.Wisconsin`. Any `xcodegen generate` would install a different
  app identity and leave the prior Keychain item unreachable.
- Visual sign-off on the standby clock needs the user's iPad rebuild.

---

## Active: Roadmap ideas intake (2026-06-12)

Plan: `tasks/roadmap-ideas-2026-06-12.md`

- [x] Flesh out direct user custody for daily-use gear.
- [x] Flesh out MacBook and laptop lifecycle inventory.
- [x] Flesh out Brand Communications schedule-first access.
- [x] Flesh out stronger badge gamification with accountability.
- [x] Add guest gear request intake for external partners.
- [x] Add football-owned gear warning and alternative suggestions.
- [x] Add smart student graduation dates and graduated archive state.
- [x] Add Athletic Calendar Wrapped product/data plan.
- [x] Add iOS shift widgets, Apple Calendar hardening, and Gotham greeting plan.
- [x] Add smarter notifications, missing alert families, and notification orchestration plan.
- [x] Add return exception reporting for damaged/lost gear, evidence requirements, and urgent admin notifications.
- [x] Add adjacent roadmap ideas and recommended slice order.

### Review
- 2026-06-12: Logged roadmap intake as a doc-only plan. Recommended first bet is direct user custody because it supports daily-use gear truth, MacBook lifecycle planning, offboarding, and custody reporting without weakening kiosk-owned checkout/return flows.
- 2026-06-12: Added external partner guest gear requests and football-owned gear warnings. Guest requests should start staff-only before any public form, while football-owned gear should begin as non-blocking picker guidance with available Creative/shared alternatives.
- 2026-06-12: Added Student Lifecycle planning: smart graduation-date defaults from existing grad-year data, explicit graduated/archive state distinct from generic deactivation, and offboarding gates for gear, shifts, licenses, sessions, and custody.
- 2026-06-12: Added Athletic Calendar Wrapped planning. The first slice should lock the season boundary and data dictionary, then collect durable missing facts like scan method/session telemetry and future acknowledgement events before building the recap player.
- 2026-06-12: Added Shift Glance planning: WidgetKit shift snapshots, hardened Apple Calendar metadata/reconciliation, and a Gotham Home/AFM greeting summary driven by the same upcoming-shift contract.
- 2026-06-12: Added Smart Alerts planning. Existing notification triggers already cover checkout escalation, shift changes, trade lifecycle, reservations, badges, licenses, firmware, damage/lost reports, and low stock, so the next slice should define taxonomy, digesting, preferences, quiet hours, and deep-link contracts before adding more one-off nudges.
- 2026-06-12: Added Return Exception Reporting planning. The current backend can store damaged/lost reports and notify supervisors, but the retired booking-mode scan UI leaves a product gap; next slice should harden damaged photo/description requirements, add return-flow reporting, add active-checkout lost reporting, and make admin notification urgency explicit.

---

## Active: Project folder cleanup (2026-06-12)

Plan: `tasks/project-folder-cleanup-plan.md`

- [x] Snapshot current repo status and identify pre-existing dirty files.
- [x] Archive completed plan files from the active todo queue.
- [x] Move proof PNGs to `tasks/archive/proofs/`.
- [x] Reconcile duplicate active/archive audit files.
- [x] Update `tasks/todo.md` with a cleanup review.
- [x] Verify status, archive locations, and whitespace.
- [x] Move root import, report, prompt, and smoke-proof artifacts into archive locations.
- [x] Update references and ignore rules for the new artifact locations.
- [x] Add generated codemaps and a check command so repo mapping stays current.
- [x] Replace deprecated `next lint` with a working ESLint CLI baseline.

### Review
- 2026-06-12: Cleanup pass preserved pre-existing dirty product changes in `ios/project.yml`, the roadmap intake update in this file, and the untracked roadmap plans. Completed iOS plan files moved to `tasks/archive/completed-2026-06/`; proof images moved to `tasks/archive/proofs/`. Duplicate root/archive audit filenames were left in place because their contents differ.
- 2026-06-12: Verification passed: no root `tasks/*.png` files remain, the completed iOS plan archive contains both moved plans, stale root plan-path references are gone, and `git diff --check` is clean.
- 2026-06-12: Second cleanup pass moved root import/report/prompt artifacts into `docs/archive/`, moved tracked `.tmp` smoke images into `tasks/archive/proofs/browser-smoke/`, removed the empty root folders, updated path references, and added ignore rules to prevent root temp/report/proof clutter from returning.
- 2026-06-12: Repo map pass added generated codemaps for architecture, backend, frontend, data, dependencies, routes, schema, and area ownership. Added `npm run codemap`, `npm run codemap:check`, and `npm run verify:docs`; verification passed for generator syntax, codemap check mode, and whitespace.
- 2026-06-12: Lint pass replaced deprecated `next lint` with ESLint CLI, pinned the Next 15 ESLint config, added `eslint.config.mjs`, fixed the first hard source errors, and got `npm run lint` passing with 0 errors and the existing warning backlog visible.

---

## Recently Reconciled: iOS booking event linking and showtime polish (2026-06-11)

Plan: `tasks/archive/completed-2026-06/ios-booking-event-linking-polish-plan.md`

- [x] Add native event linking to reservation creation.
- [x] Refresh the three-step iOS booking UI for showtime.
- [x] Add focused tests and doc sync.
- [x] Run the iOS verification stack and record results.

### Review
- 2026-06-11: Native reservation creation now links up to 3 upcoming events, submits `eventIds[]`, preserves event-detail prefill behavior, and has cleaner Apple-style Details/Equipment/Confirm context.
- 2026-06-11: Verification passed with focused iOS source tests, whitespace check, iOS drift check, iOS gap audit, and XcodeBuildMCP simulator build. TypeScript remains blocked by the unrelated pre-existing conflicted `tests/booking-create-ux.test.ts`.

---

## Recently Reconciled: iOS Scan bulk unit QR resolution (2026-06-11)

Plan: `tasks/archive/completed-2026-06/ios-scan-bulk-unit-qr-plan.md`

- [x] Decode `/api/assets` item-family `bulkItems` in native iOS.
- [x] Render resolved numbered battery unit results in Scan instead of "Nothing found."
- [x] Add focused contract coverage and sync docs.
- [x] Run focused tests and iOS verification.

### Review
- 2026-06-11: Native Scan/global search now decode `/api/assets.bulkItems`, render item-family battery results with scanned unit context, and keep reservation scan-to-add explicit by directing item-family matches back to quantity controls.
- 2026-06-11: Verification passed with focused Vitest tests, iOS drift check, iOS gap audit, whitespace check, and escalated iOS Simulator build. `npx tsc --noEmit` remains blocked by unrelated `tests/bulk-unit-adjustment-routes.test.ts:171`.

---

## Active: Remove ambient quick search type-to-search (2026-06-10)

Root cause: even after tightening the input guard, ambient type-to-search remains too collision-prone for a data-entry-heavy app. The explicit top-bar/mobile Search trigger and `Cmd/Ctrl+K` shortcut cover the command-palette workflow without stealing printable typing from page surfaces.

- [x] Remove printable-key type-to-search from AppShell.
- [x] Keep `Cmd/Ctrl+K` and top-bar/mobile Search triggers.
- [x] Add focused regression coverage that printable keys do not seed/open quick search.
- [x] Sync Search docs and record verification.

### Review
- 2026-06-10: Removed ambient type-to-search from the global command palette. Quick Search now opens only through the visible Search trigger or `Cmd/Ctrl+K`.
- 2026-06-10: Corrected removal verification passed: focused AppShell regression test, TypeScript, migration-prefix check, whitespace check, and authenticated in-app browser smoke on `http://127.0.0.1:3015/items`. With page focus, typing `x` did not open a command dialog or command input; the visible top Search trigger still opened the command palette. Browser shortcut injection could not reliably deliver `Cmd/Ctrl+K`, so the shortcut path is pinned by source regression coverage.
- 2026-06-10: AppShell type-to-search now exits when another handler already called `preventDefault()` and checks both the key event target and `document.activeElement` for text-entry/search/combobox/dialog ownership before opening the global palette.
- 2026-06-10: Authenticated in-app browser smoke on `http://127.0.0.1:3014/items?q=sony` passed. Typing in the Items search field kept the local `sony` query, filtered rows rendered, no command dialog or command input appeared, and browser console warnings/errors were empty.
- 2026-06-10: Verification passed: `npx vitest run tests/app-shell-search-source.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, and `git diff --check`.
- 2026-06-10: `npm run build` was attempted but the sandboxed run failed on blocked Neon DNS, and the escalated run was rejected because this repo's build script can apply pending migrations to Neon. Safer `npx next build` compiled the app, then failed on unrelated in-progress firmware-watch Prisma client drift: `FirmwareSupportMode` is present in the dirty schema/source but not generated in `@prisma/client`.

---

## Active: Fix B&H images in the asset image picker (2026-06-10)

Root cause (verified with curl): Brave returns B&H image URLs on `www.bhphotovideo.com/cdn-cgi/...`, which sits behind Cloudflare bot protection that 403s hotlinked `<img>` loads, server-side rehost fetches, AND Brave's own thumbnail proxy ("Source image is unreachable"). The identical file paths on `static.bhphoto.com` serve openly (200, no special headers) in 500/1000/1500/2500px square variants.

- [x] `src/lib/bhphoto-image.ts` -- pure `toBhStaticImageUrl(url, size?)` rewriter (handles cdn-cgi-wrapped + direct URLs)
- [x] `src/lib/image-search.ts` -- map B&H results to static host: hero-size `url` (1000px), original-size `thumbnailUrl`
- [x] `src/lib/blob.ts` -- rewrite B&H URLs before rehost fetch; browser-like UA/Accept headers
- [x] `src/components/ChooseImageModal.tsx` -- grid renders `thumbnailUrl` first (hotlink-safe), falls back to `url`
- [x] Tests: new `tests/bhphoto-image.test.ts` + extend `tests/image-search.test.ts`
- [x] Doc sync: AREA_ITEMS.md changelog
- [x] `npm run build` + test suite green

### Review
B&H picker tiles now render from `static.bhphoto.com` and saving a B&H result rehosts the 1000x1000 hero image to Vercel Blob. Non-B&H tiles got more reliable too (Brave thumbnail preferred over hotlinked originals). If a 1000px variant ever 404s, the existing client fallback saves the 500px thumbnail instead.

Follow-up (same day, from live screenshot): two more real-world B&H URL shapes surfaced. `multiple_images/imagesNxN/` gallery paths now rewrite (and size-upgrade) like regular product images, and `static.bhphotovideo.com/explora/...` blog images, verified 403 on every host AND via Brave's thumbnail proxy, are dropped from results entirely rather than shown as blank tiles.

**Current release**: Beta — CalVer versioning adopted.
**Release workflow**: `npm run release` creates CalVer tag + GitHub Release.

---

## Recently Shipped

### Design System Cleanup (2026-04-14)
- [x] **Badge variants** — Removed 4 unused variants (ghost, link, mixed, yellow); consolidated from 13 → 9
- [x] **Typography** — 15 settings page headings migrated from hardcoded `text-[22px]` → `text-2xl` token
- [x] **Legacy CSS** — ~240 lines removed: `ops-row*` (dashboard columns), `possession-card*` (no consumers), `data-table*` (TradeBoard + ShiftConfigTable) all migrated to Tailwind
- [x] **Accent naming** — 3 direct `var(--accent)` usages replaced with `var(--primary)` / `hover:border-primary`
- [x] **Theme toggle** — `.theme-toggle-row` CSS block migrated to inline Tailwind (`data-[state=on]:`, `hover:`) in Sidebar.tsx

### Guides Feature (2026-04-14)
- [x] **Slice 1** — Guide model + migration (0032), service layer (`src/lib/guides.ts`), 5 API routes with auth + audit logging
- [x] **Slice 2** — `/guides` list page (category chips, search, card grid), `/guides/[slug]` BlockNote reader, sidebar nav entry
- [x] **Slice 3** — `/guides/new` create page, `/guides/[slug]/edit` edit page (publish toggle, admin delete with AlertDialog)
- [x] **Doc sync** — `AREA_GUIDES.md` created, `guides-plan.md` archived

### Kiosk Mode — Full Flow (2026-04-14)
- [x] **Verified all 12 kiosk API routes** — all use `withKiosk`, correct auth on all mutations
- [x] **Confirmed `source: "KIOSK"`** on checkout/complete and checkin/complete audit entries
- [x] **Confirmed 5-min inactivity timer** in KioskShell
- [x] **Updated AREA_KIOSK.md** — all 11 ACs marked complete, full implementation documented
- [x] **Archived `tasks/kiosk-plan.md`** → `tasks/archive/`

### Scan Flow Hardening (2026-04-09)
- [x] **Stress test** — 4 issues found, 4 fixed: scanValue normalization, bulk bin case-insensitive match, cross-booking numbered bulk unit integrity, completeCheckinScan status guard
- [x] **Harden pass** — 6 fixes across 4 files: Badge components, dark-mode color consistency, finally blocks on both hooks, Page Visibility refresh, camera error UX

### Booking Flow Overhaul (2026-04-09)
- [x] **Multi-step wizard** — `/checkouts/new` and `/reservations/new` replace `CreateBookingSheet`. 3 steps: Context & Details → Equipment → Confirmation.
- [x] **BookingDetailsSheet Equipment tab** — 3rd tab with unreturned badge count, scan-to-return (inline camera, local QR lookup, audio/haptic), full EquipmentPicker in edit mode.
- [x] **Thumbnails everywhere** — `<AssetImage size={36}>` on all equipment rows. Bulk qty stepper capped at max, 44px touch targets.
- [x] **Stress test** — 12 issues found, 8 fixed (broken redirect URL, stale scan state, date validation, audit log deps, draft save await, form-options error state).
- [x] **Cleanup** — `CreateBookingSheet` and `BookingEquipmentEditor` deleted. Dashboard wired to wizard navigation.

---

## Open Items

### Item Info Sidebar Hardening (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/item-info-sidebar-hardening-plan.md` for smarter item detail field behavior.
- [x] **Field smarts** - Hardened USD purchase price handling and product link normalization/source context.
- [x] **Focused coverage** - Added source-contract coverage for the sidebar field behavior.
- [x] **Docs and verification** - Synced Items docs/tasks and reran focused plus deploy-shaped checks.

**Review**
- 2026-06-10: Item Info purchase price now behaves as a strict USD field with a dollar affordance, decimal input semantics, two-decimal display formatting, and parser-backed save normalization.
- 2026-06-10: Product links now normalize missing schemes to `https://`, reject non-http(s) URLs, open/copy the normalized target, and show the stored source host inline when valid.
- 2026-06-10: Authenticated browser smoke passed on `http://127.0.0.1:3017/items/cmmvmbdhe001hjx04hb39a7mk`; the sidebar rendered Identity/Firmware/Product/Organization/Procurement/Notes rows, the firmware modal opened, and no console warnings/errors were reported.
- 2026-06-10: Verification passed: `npx vitest run tests/item-info-sidebar-hardening.test.ts tests/item-detail-firmware-display.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome DevTools smoke.

### Item Detail Identity Firmware Refresh (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/item-detail-identity-firmware-refresh-plan.md` to integrate firmware into the admin identity block.
- [x] **Identity surface** - Renamed Scan identity to Identity and kept QR/serial in the same admin-labeled cluster.
- [x] **Firmware placement** - Moved firmware into the QR/serial row grammar with only the firmware badge inline and newest/check/release/source metadata in the badge modal.
- [x] **Docs and verification** - Synced docs/tasks and reran focused plus deploy-shaped checks.

**Review**
- 2026-06-10: Identity now renders QR, Serial, and Firmware as compact rows with QR preview on the right. Firmware no longer renders as a full nested card or repeats the badge status as adjacent text.
- 2026-06-10: Clicking the firmware badge opens a cleaned-up modal with a summary block for current/newest/checked/released values, installed-version input, Mark updated to latest, and the official Sony update-page link.
- 2026-06-10: Authenticated in-app browser smoke passed on real FX3 item `cmmvmbdhe001hjx04hb39a7mk`; no current-page console warnings/errors were reported and the smoke did not mutate live item firmware.

### Item Detail Firmware Badge (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/item-detail-firmware-badge-plan.md` to make item firmware status a compact editable badge.
- [x] **Installed firmware metadata** - Store the per-asset installed firmware version in item metadata without adding schema.
- [x] **Badge and dialog** - Show green updated / orange outdated / gray unset firmware badge with an edit dialog and Sony source link.
- [x] **Docs and verification** - Sync docs/tasks and rerun focused plus deploy-shaped checks.

**Review**
- 2026-06-10: Item detail firmware now renders as a compact badge backed by `metadata.installedFirmwareVersion`. The badge is green when installed matches latest, orange/yellow when installed differs from latest, and gray when no installed version is recorded or latest is unknown.
- 2026-06-10: Clicking the firmware badge opens an edit dialog with installed/latest/release/check context, a saveable installed-version input, a Mark updated to latest action, and the official Sony update page link.
- 2026-06-10: Authenticated in-app browser smoke passed on real FX3 item `cmmvmbdhe001hjx04hb39a7mk`; unset state showed `Set firmware`, latest `7.02`, released `Mar 17, 2026`, and the dialog exposed the installed-version input, Mark updated to latest, and Sony update-page link with no console warnings/errors. The smoke did not mutate the live item firmware value.
- 2026-06-10: Verification passed: `npx vitest run tests/item-detail-firmware-display.test.ts tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, authenticated browser smoke, and approved-network `npm run build`.

### Item Detail Firmware Display (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/item-detail-firmware-display-plan.md` to surface model-level firmware watch data on item detail.
- [x] **Detail API data** - Return matching firmware watch target metadata from `/api/assets/[id]`.
- [x] **Info tab display** - Show latest available firmware, release date, support mode, and source link in the item information card.
- [x] **Docs and verification** - Sync docs/tasks and rerun focused plus deploy-shaped checks.

**Review**
- 2026-06-10: `/api/assets/[id]` now matches serialized item brand/model to enabled `FirmwareWatchTarget` rows and returns read-only firmware watch metadata.
- 2026-06-10: The Info tab item information card now renders a firmware panel when a watch target exists, showing latest available version, release date, support mode, last check status, and official source link.
- 2026-06-10: Authenticated in-app browser smoke passed on real FX3 item `cmmvmbdhe001hjx04hb39a7mk`; the Info card showed Firmware, Active, latest `7.02`, `Released Mar 17, 2026`, last checked date, and the Sony official-source link with no console warnings/errors. Release/check dates render with a UTC formatter so vendor date-only releases do not shift by local timezone.
- 2026-06-10: Verification passed: `npx vitest run tests/item-detail-firmware-display.test.ts tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and approved-network `npm run build`. The first build attempt failed during page-data collection for stale route module paths, then the immediate rerun succeeded.

### Firmware Watch Daily Notifications (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/firmware-watch-plan.md` for daily official-source firmware polling.
- [x] **Durable watcher state** - Add a firmware watch model for official source URL, latest version/date, baseline state, and parse status.
- [x] **Official-source adapters** - Add tested Sony page parsing for latest firmware version and release date.
- [x] **Daily notification job** - Run enabled targets from `morning-refresh`, baseline silently on first successful check, and notify active admins once per new version.
- [x] **Docs and verification** - Sync area docs/decisions and run focused tests plus deploy-shaped checks.

**Review**
- 2026-06-10: Daily firmware watch foundation shipped. Enabled official support targets are polled by `morning-refresh`; first successful checks baseline silently, later version changes create deduped admin `firmware_update_released` inbox rows and best-effort push fanout. Follow-up narrowed active targets to verified Sony support pages from live inventory.
- 2026-06-10: Added migration `0075_add_firmware_watch_targets` and deployed it to Neon. Live health confirmed 76/76 local migrations applied with newest local migration `0075_add_firmware_watch_targets`.
- 2026-06-10: Verification passed: `npx vitest run tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx prisma validate`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, approved-network `npm run db:migrate:deploy`, approved-network `npm run db:migrate:health`, and approved-network `npm run build`. The first sandboxed deploy/health/build attempts failed only on blocked Neon DNS.

### Firmware Watch Inventory Seed Follow-up (2026-06-10)
- [x] **Open follow-up plan** - Started and archived `tasks/archive/firmware-watch-inventory-seed-plan.md` to make the watcher inventory-driven and Sony-only.
- [x] **Live inventory read** - Identify existing camera body model groups and maintenance-status counts from Neon.
- [x] **Support mode note** - Store active versus maintenance firmware support mode on watch targets.
- [x] **Seed live targets** - Add official Sony support targets for existing camera bodies and baseline them without notifying.
- [x] **Docs and verification** - Sync docs/tasks and rerun focused plus deploy-shaped checks.

**Review**
- 2026-06-10: Dry-run seed found five verified official Sony support targets from the live camera-body inventory: a1, a7 III, a7 IV, a7S III, and FX6. A7 III is marked maintenance firmware; the rest are active firmware support.
- 2026-06-10: Non-Sony bodies and unresolved Sony models are skipped with reasons in `tasks/firmware-watch-inventory-report.md` rather than seeded with guessed URLs.
- 2026-06-10: Applied migration `0076_add_firmware_watch_support_mode` and seeded five baselined live `FirmwareWatchTarget` rows. Live readback confirmed a1 `4.00` (active), a7 III `4.04` (maintenance), a7 IV `6.02` (active), a7S III `5.01` (active), and FX6 `6.00` (active).
- 2026-06-10: Verification passed: `node --check scripts/seed-firmware-watch-targets.mjs`, `npx vitest run tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx prisma validate`, `npm run db:migrate:check`, `npx tsc --noEmit`, `git diff --check`, approved-network `npm run db:migrate:deploy`, approved-network `npm run db:migrate:health`, live target readback, and approved-network `npm run build`.
- 2026-06-10: Added the official Sony FX3 and FX3A downloads paths from user-provided Sony URLs. The seed now tracks FX3 `7.02` and FX3A `2.02` as separate active firmware branches, both released 2026-03-17.

### Add Item Flow Quick Fixes (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/add-item-flow-quick-fixes-plan.md` for Standard add-item flow fixes.
- [x] **Repeat tag count** - Show matching serialized item count and next likely tag for repeated tags such as `FX3 2`.
- [x] **Procurement fixes** - Treat purchase price as USD and save fiscal year to detail-compatible metadata.
- [x] **Inline photo upload** - Add a Standard item photo upload field and upload the selected photo after asset creation.
- [x] **Docs and verification** - Sync Items docs, archive the plan, and run focused tests plus build checks.

**Review**
- 2026-06-10: Standard Add item now checks repeat-family tags on blur and shows current count plus next likely tag. Local browser smoke verified `FX3 3` showed `2 existing FX3 items. Next tag should be FX3 3.`
- 2026-06-10 follow-up: Repeat-family suggestions now update while typing and prefix-match existing tag families, so typing `F`, `FX`, `FX3`, or `70-200` can suggest the next tag without entering a number first.
- 2026-06-10: Purchase price now reads as USD, accepts common USD formatting, and asset create accepts nonnegative values to match item detail. Fiscal year now writes `metadata.fiscalYearPurchased`, the key read by item detail.
- 2026-06-10: Standard Add item now includes an inline photo upload field. Selected files are validated client-side and uploaded through the existing asset image endpoint after the asset create returns an id.
- 2026-06-10: Verification passed: focused Add item tests, TypeScript, migration-prefix check, whitespace check, approved-network production build, and authenticated Chrome DevTools smoke on `/items`. The first sandboxed build failed only on blocked Neon DNS.

### QR Code Generation Simplification (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/qr-code-generation-plan.md` for shorter generated item tracking codes.
- [x] **Generation format** - New generated asset QR codes now use 8 uppercase hex characters without the `QR-` prefix.
- [x] **Compatibility** - Existing stored `QR-...` codes remain valid because scan lookup still accepts prefixed fallbacks.
- [x] **Docs and verification** - Sync Items docs and run focused format, type, migration, whitespace, and build checks.

**Review**
- 2026-06-10: Existing item QR generation, duplicated asset generation, and the Add item sheet generator now share one prefixless asset QR helper. No migration rewrites existing labels.
- 2026-06-10: Verification passed with `npx vitest run tests/asset-qr-code-format.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and approved-network `npm run build`. The first sandboxed build failed only on blocked Neon DNS.

### iOS Settings Detail Menus Slice (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/ios-settings-detail-menus-plan.md` for native Settings drill-downs.
- [x] **Notifications detail menu** - Move notification delivery, pause, channel, and category controls out of the root Settings list into a dedicated native Notifications destination.
- [x] **Account & Security detail menu** - Add a native Account & Security destination with account identity, role, password change, optional other-session revocation, and web handoff for full profile/session management.
- [x] **Focused coverage** - Add source-contract tests for the new navigation destinations, notification detail ownership, and password-change UI/API wiring.
- [x] **Docs and verification** - Sync mobile/settings/notification/user docs and run the iOS verification stack.

**Review**
- 2026-06-10: Native Settings now keeps root Account and Notifications as scannable menu rows. Notifications opens a dedicated detail screen with delivery status, OS push recovery, pause controls, email/push channel toggles, and the four category toggles. Account & Security opens a native password-change workflow with account identity, role, show/hide password control, confirm-password validation, and optional sign-out-other-devices behavior through the existing `/api/me/change-password` client.
- 2026-06-10: Full profile editing and active-session review remain linked to web Settings for this slice. No schema, backend contract, or tab-shell architecture changed.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-settings-detail-menus.test.ts tests/ios-settings-first-class.test.ts tests/ios-notification-categories-profile.test.ts tests/student-field-contracts.test.ts tests/ios-forced-password.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.

### iOS Settings First-Class Slice (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/ios-settings-first-class-plan.md` for the native Settings/Profile hub upgrade.
- [x] **Native settings IA** - Refactor Profile into a first-class iOS Settings surface with stronger account, notification, schedule, appearance, tools, and app grouping.
- [x] **Focused coverage** - Add source-contract tests for settings row labels, role-gated entries, and preserved notification controls.
- [x] **Docs and verification** - Sync mobile/settings docs and run the iOS verification stack.

**Review**
- 2026-06-10: Native Profile now presents as Settings, with an account summary, shift/overdue/alert metrics, first-class settings rows, grouped schedule/account/notifications/appearance/tools/app sections, student-only Availability, staff/admin-only Link Sticker Codes, and a named sign-out row.
- 2026-06-10: No API, schema, or notification delivery contract changed. The stable `.tabItem`/`.tag` tab shell remains in place after the previously reproduced `Tab(...)` Schedule crash.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-settings-first-class.test.ts tests/ios-notification-categories-profile.test.ts tests/student-field-contracts.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.

### Booking Flow Follow-up (2026-06-10)
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

### iOS Notifications Category Parity Slice (2026-06-10)
- [x] **Open slice plan** - Started `tasks/ios-notifications-category-parity-plan.md` for native Profile notification type toggles.
- [x] **Native category controls** - Add iOS Profile toggles for checkout due, checkout overdue, reservation, and license expiry notification categories.
- [x] **Preference save helpers** - Route single-category changes through `NotificationPrefsViewModel` while preserving legacy missing-category defaults.
- [x] **Focused contract coverage** - Add source tests proving API defaults, native model fields, web labels, Profile labels, and native save path stay aligned.
- [x] **Docs and verification** - Sync mobile/notification docs and run the iOS verification stack.

**Review**
- 2026-06-10: Native Profile now exposes the existing web-backed `Notification types` controls for checkout due reminders, checkout overdue alerts, reservation updates, and license expiry reminders. This changes the iOS control surface only; server delivery rules, category names, and in-app inbox behavior are unchanged.
- 2026-06-10: `NotificationPrefsViewModel` defaults missing legacy category JSON to all enabled before applying a single toggle, then saves the full category object through the existing optimistic preference save path.
- 2026-06-10: Focused contract coverage pins the API defaults, native model fields, web labels, native Profile labels, and native category save path so future category drift fails in tests.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-notification-categories-profile.test.ts tests/ios-api-contract.test.ts tests/ios-notifications-token-honesty.test.ts tests/ios-notifications-tapthrough.test.ts tests/ios-notifications-read-recovery.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.

### iOS Notifications Token Honesty Slice (2026-06-10)
- [x] **Open slice plan** - Started `tasks/ios-notifications-token-honesty-plan.md` for APNs token registration/revocation error handling.
- [x] **Shared API handling** - Route native device-token register/revoke calls through `perform` and `SuccessResponse`.
- [x] **Focused contract coverage** - Add source tests proving `/api/devices` returns success and iOS no longer uses raw `session.data(for:)` for those calls.
- [x] **Docs and verification** - Sync mobile/notification docs and run the iOS verification stack.

**Review**
- 2026-06-10: `APIClient.registerDeviceToken(_:)` and `revokeAllDeviceTokens()` now decode the `/api/devices` `{ success: true }` response through the shared `perform` handler instead of raw `URLSession.data`, so non-2xx responses are real errors and 401s broadcast `sessionDidExpire`.
- 2026-06-10: Focused contract coverage pins both sides of the device-token contract: the route returns success envelopes for register/revoke, and native register/revoke do not drift back to raw `session.data(for:)`.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-notifications-token-honesty.test.ts tests/ios-notifications-tapthrough.test.ts tests/ios-notifications-read-recovery.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.

### iOS Notifications Tap-Through Slice (2026-06-10)
- [x] **Open slice plan** - Started `tasks/ios-notifications-tapthrough-plan.md` for the narrow shift push routing fix.
- [x] **Shift APNs payloads** - Include event routing context on shift gear-up and shift schedule push payloads.
- [x] **Native Schedule routing** - Switch to the Schedule tab when a tapped push sets `pendingPushEventId`, leaving `ScheduleView` to open the event.
- [x] **Focused contract coverage** - Add source tests for server push payloads and native pending-event tab routing.
- [x] **Docs and verification** - Sync mobile/notification docs and run the iOS verification stack.

**Review**
- 2026-06-10: Shift gear-up and shift schedule pushes now include `eventId`, `assignmentId`, and `shiftId` in the APNs payload. The inbox payloads already carried those fields; the fix closes the native push gap without changing email or in-app notification creation.
- 2026-06-10: `AppDelegate` already stores tapped `eventId` as `AppState.pendingPushEventId`, and `ScheduleView` already consumes that value. `AppTabView` now watches for the pending event, switches to the Schedule tab, and leaves `ScheduleView` to clear/open the event so the tab shell does not consume the navigation intent too early.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-notifications-tapthrough.test.ts tests/ios-notifications-read-recovery.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.

### iOS Notifications Audit (2026-06-10)
- [x] **Plan audit scope** - Audit native notification permission, registration, inbox, tap-through, badge refresh, and server push contracts without changing code first.
- [x] **Source grounding** - Read mobile/notification docs, current iOS notification source, API push paths, schema, and Apple notification guidance.
- [x] **Findings** - Rank concrete improvement opportunities by user impact, implementation risk, and verification path.
- [x] **Review** - Document recommendations and whether a narrow implementation slice should follow.

**Review**
- 2026-06-10: Current notification foundation is credible: native push uses APNs token registration, a soft pre-prompt, foreground banner/sound/badge presentation, unread badge refresh, in-app inbox pagination, optimistic mark-read rollback, quiet-hours and channel preferences, and APNs revocation cleanup.
- 2026-06-10: Best next slice is tap-through correctness for non-booking push targets. The server creates shift notifications with `eventId` in the inbox payload, but `sendPushToUser` calls for `shift_gear_up` and shift schedule updates omit that payload. `AppDelegate` can store `pendingPushEventId`, and `ScheduleView` can consume it, but `AppTabView` does not switch to Schedule when an event push arrives. Result: booking pushes are reliable, while shift pushes can land without opening the relevant schedule context.
- 2026-06-10: Second slice is push delivery honesty. `APIClient.registerDeviceToken` and `revokeAllDeviceTokens` use raw `session.data(for:)` instead of the shared `perform` path, so token registration failures do not surface shared API error handling or 401 routing. Add a small success response decode, route 401 through `sessionDidExpire`, and consider last registration status in Profile so a user who enabled OS push is not left thinking server delivery is active when token upsert failed.
- 2026-06-10: Third slice is preference granularity parity. Web settings document category toggles for checkout due, checkout overdue, reservation, and license expiry; native Profile only exposes pause, email, and push master switches while preserving category JSON. That is safe, but it hides controls students and staff may expect once alerts increase.
- 2026-06-10: Lower-priority follow-ups: align `AREA_NOTIFICATIONS.md` with current push reality because overdue and license pushes now exist despite the older V1.2 text saying overdue batch push was deferred; decide whether badge-award push should remain deferred; add source-contract tests for push payload routing and token-registration handling.
- 2026-06-10: Verification for this audit-only pass: `npm run audit:ios:gaps` passed with 35/35 covered audit-worthy surfaces and the known unrelated unregistered `Components/UserAvatarView.swift` warning; `git diff --check` passed.

### iOS Runtime Warning Cleanup (2026-06-09)
- [x] **Open warning-cleanup plan** - Started `tasks/ios-runtime-warning-cleanup-plan.md` for the narrow native warning slice.
- [x] **Patch foreground badge refresh energy** - Throttle opportunistic AppState badge refreshes while preserving forced refresh after notification and trade-board dismissals.
- [x] **Patch URLSession fallback churn** - Main API, kiosk API, and thumbnail image sessions now use explicit mobile timeouts and no multipath service.
- [x] **Patch Scan material/frame churn** - VisionKit now stays stopped while the Scan result/error sheet is visible and restarts only when the sheet dismisses.
- [x] **Patch tab-bar crash** - AppTabView now uses stable `.tabItem`/`.tag` tabs instead of the iOS 26 `Tab(...)` builder plus tab minimization that desynced UIKit's tab item/controller map.
- [x] **Reject crashing newest SwiftUI tabs** - User retest proved the typed value-based `Tab(...)` shell still crashes on Schedule; AppTabView is back on stable `.tabItem`/`.tag` tabs with the Users role-change guard.
- [x] **Focused warning tests** - Added source-contract coverage for AppState throttling, the session changes, ScanView changes, and tab-bar stability.
- [x] **Verification** - Focused warning and scan retry tests, iOS drift, iOS gap audit, touched-file whitespace, and the Wisconsin simulator build passed.

**Review**
- 2026-06-09: The Xcode Energy trace showed sparse Network/Overhead spikes rather than sustained thermal pressure. AppState badge refresh was the clearest repo-owned fan-out because each foreground activation could launch dashboard stats, notification count, and open-trade requests. Non-forced refreshes are now limited to one attempt per minute; notification and trade-board dismissals still force refresh because the user may have changed visible badge state.
- 2026-06-09: Classified the pasted logs. `nw_endpoint_fallback_get_timeout_nanos` is CFNetwork path fallback noise, `PointerUI` and `_dictationButton` are Apple framework diagnostics, and the app-actionable warning is the repeated material/frame update around Scan result presentation. The patch should reduce app-triggered churn while preserving lookup-only Scan scope.
- 2026-06-09: Verification passed: `npx vitest run tests/ios-appstate-refresh.test.ts tests/ios-runtime-warning-cleanup.test.ts tests/ios-scan-result-retry.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, touched-file `git diff --check`, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The sandboxed build could not access CoreSimulator/DerivedData, so the successful build used the approved unsandboxed fallback.
- 2026-06-09: Attached crash trace showed `UITabBarController._viewControllerForTabBarItem` failing on Schedule selection. Rolled the app shell back to stable `.tabItem`/`.tag` tabs and added `tests/ios-tabbar-stability.test.ts`. A broader `student-field-contracts` run still has unrelated dirty-worktree drift around CreateBooking copy, so this crash slice verifies with focused tab/runtime tests plus the simulator build.
- 2026-06-09: Crash fix verification passed with focused tab/runtime tests, `npm run drift:ios`, touched-file whitespace check, and XcodeBuildMCP `build_sim` for Wisconsin Debug. `npm run audit:ios:gaps` exited cleanly but noted unrelated unregistered `Components/UserAvatarView.swift` from the surrounding in-progress iOS work.
- 2026-06-10: User asked to use the newest and best SwiftUI tab surface. The implementation should prefer the SDK-native `Tab` API with typed selection rather than reverting to legacy `.tabItem` once the focused tests and simulator build pass.
- 2026-06-10: Restored the modern SwiftUI tab shell. Focused tab/runtime tests, `npm run drift:ios`, touched-file whitespace, and XcodeBuildMCP simulator build passed. `npm run audit:ios:gaps` still exits cleanly with the unrelated unregistered `Components/UserAvatarView.swift` warning.
- 2026-06-10: User retest crashed again on Schedule with the modern `Tab(...)` shell. Root issue is the SwiftUI `Tab` builder path desynchronizing UIKit's tab item/controller mapping in this app, likely amplified by the conditional Users tab and/or tab-bar minimization/search role. Reverted to stable `.tabItem`/`.tag` and updated the guard test to keep that path out.

### Internal Public Beta Launch Readiness (2026-06-08)
- [x] **Flag launch work in this todo** - Added the Wednesday, June 10, 2026 readiness checklist and moved onboarding closeout to the top of the active queue.
- [x] **Onboarding bulk-admin guard** - Bulk temporary-password onboarding now rejects Admin rows even for admin operators, keeping roster onboarding scoped to Staff and Student accounts.
- [x] **Onboarding bulk-create rate limit** - `/api/users/bulk-create` now uses the shared settings mutation budget before generating temporary passwords or creating users.
- [x] **Focused onboarding guard verification** - `npx vitest run tests/onboarding-lifecycle.test.ts tests/allowed-emails-preview.test.ts tests/users-bulk-create-route.test.ts` passed 13 tests.
- [x] **Onboarding launch smoke** - Ran the real production access path: invite-to-register, stale invite removal, `/register?email=...` prefill, and forced-password recovery setup.
- [x] **Production verification gate** - `npm run build`, `npm run db:migrate:health`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, focused launch tests, and full Vitest passed.
- [x] **Authenticated core browser smoke** - Smoked `/`, `/items`, `/bookings`, `/checkouts/new`, `/reservations/new`, `/users`, `/users/onboarding-status`, `/settings/allowed-emails`, `/settings/calendar-sources`, `/admin/fix-today`, and `/notifications`.
- [x] **iOS beta gate** - `npm run drift:ios`, `npm run audit:ios:gaps`, and the Wisconsin simulator build passed.
- [x] **Vercel environment check** - Neon URLs, Blob, Redis/KV, Brave image search, APNS, session envs, cron schedules, and production `CRON_SECRET` are present. `RESEND_API_KEY` is not configured, so email delivery remains disabled by optional config.
- [x] **Launch data prep** - Confirmed beta users, locations, calendar source, common gear, kits, and created representative active reservation `RV-0039` through the production API.
- [x] **One-page beta runbook** - Documented onboarding, checkout creation, returns, stale invitation recovery, audit-log lookup, and escalation contacts for beta operators in `tasks/internal-public-beta-runbook.md`.
- [x] **No-temp-password onboarding pivot** - First-time temporary-password account creation is retired; operators add allowlist invitations and users set their own password during registration.
- [ ] **Release cut** - Run `npm run release` only after the production verification gate and launch smoke pass.

**Review**
- 2026-06-08: Started launch work with onboarding hardening. Focused onboarding tests, TypeScript, migration-prefix check, whitespace check, and `npx next build` passed.
- 2026-06-08: After explicit approval, `npm run build` passed. The migration deploy step reached Neon, found no pending migrations, and the Next production build completed.
- 2026-06-08: Added the one-page internal public beta runbook for Wednesday operator readiness.
- 2026-06-08: `npm run db:migrate:health` passed against Neon: 75 local migrations, 75 applied, newest local migration `0074_student_availability_ad_hoc` applied, no pending local migrations, no unresolved failed rows, no DB-only migrations.
- 2026-06-08: Initial Vercel connector project fetch returned 403, but the escalated read-only Vercel CLI env inventory succeeded.
- 2026-06-08: Launch data read-only counts: 9 active users (4 admin, 4 staff, 1 student), 0 pending invites, 3 active locations, 1 enabled calendar source, 183 available assets, 3 active kits, 1 recent booking, and 0 active bookings. Launch data prep stays open until at least one representative active reservation or checkout exists in the launch environment.
- 2026-06-08: iOS beta gate passed. `npm run drift:ios` found no anti-patterns across 46 Swift files, `npm run audit:ios:gaps` reported 35/35 audit-worthy surfaces covered, and the Wisconsin Debug simulator build exited successfully with only the AppIntents metadata extraction warning.
- 2026-06-08: Full Vitest gate now passes: `npm test` passed 174 files and 1055 tests after correcting stale shift-trade test fixtures that expected Field while constructing default VIDEO shifts. Follow-up `npx tsc --noEmit`, `npm run db:migrate:check`, and `git diff --check` passed.
- 2026-06-08: Live Vercel production env inventory verified by `vercel env list production --format json`. Present before the fix: `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`, `BRAVE_SEARCH_API_KEY`, Redis/KV envs accepted by the rate limiter, session envs, APNS envs, and `BADGES_ENABLED`. Missing before the fix: `CRON_SECRET` and `RESEND_API_KEY`. `CRON_SECRET` was required before beta because all `/api/cron/*` routes use `withCron()`.
- 2026-06-08: Added production `CRON_SECRET`, deployed production `dpl_CfUk2zg8gsd2cvyAukv7wJTkiyjH`, and verified `/api/cron/notifications` through `vercel curl` on `https://gear-tracker-ma6hqcpxk-erikroles-projects.vercel.app`. Cron response: `ok: true`, `scanned: 0`, `notificationsCreated: 0`, license nag and expiry counts zero. Production is aliased to `https://gear.erikrole.com`.
- 2026-06-08: Launch data prep next step is a representative future reservation. A direct production SQL insert was intentionally blocked because it would bypass the app booking API/service validation and side effects; create this through the authenticated app/API instead.
- 2026-06-08: Created representative production reservation `RV-0039` (`Internal Public Beta Smoke Reservation`) through authenticated `/api/reservations`. `/api/bookings?active=true` now returns 1 active booking and includes `RV-0039` in `BOOKED` status.
- 2026-06-08: Authenticated production browser smoke passed for `/`, `/items`, `/bookings`, `/checkouts/new`, `/reservations/new`, `/users`, `/users/onboarding-status`, `/settings/allowed-emails`, `/settings/calendar-sources`, `/admin/fix-today`, and `/notifications`. Each route loaded without login bounce or obvious app error state; selected-page console errors were empty.
- 2026-06-08: Opened `tasks/no-temp-password-onboarding-plan.md` after deciding first-time onboarding should not use temporary passwords. The narrow beta slice retires direct temp-password onboarding and keeps invite-to-register as the first access path.
- 2026-06-08: Updated the beta runbook and launch smoke target for invite-first onboarding plus admin password-reset recovery instead of direct-created temporary-password first login.
- 2026-06-08: No-temp-password onboarding pivot passed focused onboarding tests, TypeScript, migration-prefix check, whitespace check, and `npx next build`.
- 2026-06-08: Production onboarding launch smoke passed. Created a disposable allowlist invite, registered it through the public registration endpoint, verified `/register?email=...` prefill for an unclaimed invite, verified forced-password setup through `/api/me/change-password` after fixing the API wrapper allowlist, deleted the stale unclaimed invite, and deactivated disposable smoke users.
- 2026-06-08: No-temp-password onboarding pivot shipped for beta. `/api/users` POST and `/api/users/bulk-create` now return retired-flow responses after auth and role checks; the shared onboarding dialog no longer exposes direct-create, bulk-create, temporary password generation, or CSV password handoff.
- 2026-06-08: Latest release gate passed after the invite-first pivot: focused onboarding/API tests passed 37 tests, `npx tsc --noEmit` passed, `npm run db:migrate:check` passed, `git diff --check` passed, full `npm test` passed 174 files and 1056 tests, and escalated `npm run build` reached Neon, found no pending migrations, and completed the Next production build.
- 2026-06-08: Deployed the invite-first pivot to production as `dpl_AwBTqZsUvTGKbi3eTC5ar8LXNwHu` (`https://gear-tracker-p4axgdyb5-erikroles-projects.vercel.app`) and aliased it to `https://gear.erikrole.com`. Final authenticated browser smoke on the latest deployment is pending a fresh login.
- 2026-06-08: Active development loop selected Onboarding Flow Plan Slice 7: final tests, hardening, docs sync, and plan lifecycle for the no-temp-password beta pivot. Release cut remains separate.
- 2026-06-08: Slice 7 exact build gate passed after explicit approval. `npm run build` reached Neon, found no pending migrations through the HTTP fallback, and completed the Next production build.
- 2026-06-08: Local unauthenticated browser smoke passed for login/register and redirects from change-password, Users, Allowed Emails, and Onboarding Status with no console errors.
- 2026-06-08: Authenticated local browser smoke passed after signing in with the documented local admin account. `/users` and `/settings/allowed-emails` loaded without login bounce, both Onboard users entry points opened the invite-only dialog, bulk paste and one-email tabs rendered without temporary-password/direct-create controls, and selected-page console warnings/errors were empty.

### iOS HIG and iOS 27 Readiness (2026-06-05)
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

### iOS Schedule Detail and Trade Control Clarity (2026-06-03)
- [x] Audit mobile, shifts, walkthrough, event-detail audit notes, trade-board audit notes, post-trade audit notes, and current Swift files.
- [x] Write active slice plan in `tasks/ios-schedule-detail-trade-control-clarity-plan.md`.
- [x] Make Event Detail shift actions visibly self-describing.
- [x] Make Trade Board and Post Trade controls visibly self-describing.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking lives in `tasks/ios-schedule-detail-trade-control-clarity-plan.md`.
- Current root issue: Schedule detail and trade flows are functionally hardened, but dense rows still use short visible action copy such as Assign, Request, Approve, Decline, Claim Shift, and Post.
- Implemented: Event Detail now labels Add shift, Assign person, Request shift, and pending request approvals/declines with names; Trade Board/Post Trade now label Post trade, Claim this shift, Choose Shift to Trade, and Post Trade.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

### iOS Create Booking Control Clarity (2026-06-03)
- [x] Audit mobile, checkout, reservation, iOS patterns, walkthrough, create-booking audit notes, and current `CreateBookingSheet`.
- [x] Write active slice plan in `tasks/ios-create-booking-control-clarity-plan.md`.
- [x] Make Create Booking step actions self-describing.
- [x] Add selected-equipment visibility and one-tap removal.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking lives in `tasks/ios-create-booking-control-clarity-plan.md`.
- Current root issue: CreateBookingSheet is functionally hardened, but Step 2 only shows a selected count, so removing already-picked equipment can require finding it again in the search results.
- Implemented: Step 1 advances with Choose Equipment, final submit reads Create Reservation, and Step 2 shows selected equipment with visible Remove controls backed by selected asset snapshots.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

### iOS Profile Controls Clarity (2026-06-03)
- [x] Audit mobile, users, shifts, notifications, availability brief, walkthrough, profile audit notes, and current `AppTabView`.
- [x] Write active slice plan in `tasks/ios-profile-controls-clarity-plan.md`.
- [x] Make Profile notification and availability controls self-describing.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking lives in `tasks/ios-profile-controls-clarity-plan.md`.
- Current root issue: Profile has the right mobile settings, but some high-use controls still rely on short labels or icon-only toolbar actions that are easy to forget in field use.
- Implemented: notification controls now read Pause alerts, Email alerts, and Push alerts; My Availability now exposes Add availability block in the list and Add block in the toolbar.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

### iOS Booking Detail Control Clarity (2026-06-03)
- [x] Audit mobile, checkout, reservation, walkthrough, booking-detail audit notes, and current `BookingDetailView`.
- [x] Write active slice plan in `tasks/ios-booking-detail-control-clarity-plan.md`.
- [x] Make Booking Detail edit state self-describing.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking lives in `tasks/ios-booking-detail-control-clarity-plan.md`.
- Current root issue: Booking Detail still relies on a top-right pencil that disappears when a student-owned booking moves past the editable state.
- Implemented: editable bookings now show a labeled Edit action, and owner-access locked bookings show an Editing locked notice with Extend/kiosk handoff copy.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

### iOS Items Control Clarity (2026-06-03)
- [x] Audit mobile, items, iOS patterns, walkthrough, items audit notes, and current native item/booking detail controls.
- [x] Write active slice plan in `tasks/ios-items-control-clarity-plan.md`.
- [x] Replace icon-only Items filters with visible labeled controls.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking lives in `tasks/ios-items-control-clarity-plan.md`.
- Current root issue: Items list still scopes the whole list through icon-only Favorites and Status controls, which is easy to forget in field use.
- Implemented: Items now shows Favorites and All statuses controls above the list instead of using the top-right icon-only filter cluster.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

### iOS Schedule Control Clarity (2026-06-03)
- [x] Audit mobile, shifts, iOS patterns, walkthrough, Schedule audit notes, and current `ScheduleView`.
- [x] Write active slice plan in `tasks/ios-schedule-control-clarity-plan.md`.
- [x] Replace icon-only Schedule toggles with visible labeled controls.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking lives in `tasks/ios-schedule-control-clarity-plan.md`.
- Current root issue: Schedule has too many toolbar icons whose meaning must be memorized, especially List/Calendar, My Shifts, Past, Trade Board, and calendar subscribe.
- Implemented: Schedule now shows labeled List/Calendar, My shifts, and Past events controls above content, while toolbar actions read Trades and Calendar.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

### iOS Tabs And Buttons Readiness (2026-06-03)
- [x] Audit mobile, reservations, checkouts, kiosk, scan, iOS patterns, decisions, gaps, current native shell, booking detail, API client, model, and booking PATCH route.
- [x] Write active slice plan in `tasks/ios-tabs-buttons-readiness-plan.md`.
- [x] Fix native booking edit optimistic-lock headers.
- [x] Clarify iOS tabs, booking list titles, and toolbar buttons without adding desktop filters.
- [x] Sync docs and run focused native/API verification.

**Review**
- Active tracking lives in `tasks/ios-tabs-buttons-readiness-plan.md`.
- Root issue: iOS booking edits still PATCH without the required booking snapshot header, while the native Bookings shell uses generic and icon-only controls that make field actions harder to parse.
- Shipped: native booking edits now pass `If-Unmodified-Since` from optional `Booking.updatedAt`; student tabs now read Home, My Gear, Items, Scan, Schedule; Users is staff/admin-only; the booking list titles itself as Reservations or Checkouts; and toolbar actions visibly say Mine/All and New.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

### Onboarding Flow Plan (2026-06-03)
- [x] Audit Users, Settings, Mobile, decisions, gaps, briefs, schema, auth routes, allowed-email routes, web forced-password flow, and iOS login/session source.
- [x] Write active slice plan in `tasks/onboarding-flow-plan.md`.
- [x] Slice 1: Onboarding brief and decision sync.
- [x] Slice 2: Server invitation service for shared allowlist/user lifecycle behavior.
- [x] Slice 3: Bulk-first web operator onboarding surface across Users and Allowed Emails.
- [x] Slice 4: Bulk security and operational hardening.
- [x] Slice 5: Native iOS forced-password setup.
- [x] Slice 6: iOS registration/recovery polish.
- [ ] Slice 7: Tests, hardening, docs sync, and plan archive.

**Review**
- Current root issue: account access exists as separate partial flows. Operators can create users, allowlist emails, or reset passwords, but the product does not present a single invitation lifecycle.
- Updated direction: onboarding should handle roster-sized batches through paste/CSV preview, role-safe validation, aggregate commit, and auditable status tracking while preserving the allowlist gate.
- Source-confirmed iOS blocker: admin-created accounts require `forcePasswordChange`, protected API/web routes enforce that state, and iOS currently does not decode or handle the forced-password path.
- Active tracking lives in `tasks/onboarding-flow-plan.md`.
- Slice 1 shipped with `docs/BRIEF_ONBOARDING_V1.md` and D-037 in `docs/DECISIONS.md`.
- Slice 2 shipped `src/lib/services/onboarding-lifecycle.ts`, wired `/api/users` and `/api/allowed-emails` through it, and verified the shared lifecycle with focused service and route tests plus TypeScript.
- Slice 3A shipped shared web onboarding entry points: `/users` and `/settings/allowed-emails` now open the same bulk-invite/direct-create dialog. CSV preview and row grouping are still pending in Slice 3.
- Slice 3B shipped local preview for bulk invites: pasted email lists and CSV-like `email, role` rows now group ready, duplicate, invalid, and role-blocked rows before submit. Server-backed existing-user/pending-invite preview remains pending.
- Slice 3C shipped server-backed bulk invite preview: authenticated operators now see ready, duplicate, existing-user, pending-invite, and claimed-invite groups before commit, and the dialog blocks saving until account-status issues are resolved.
- Slice 5 shipped native first-login password setup: iOS decodes `forcePasswordChange`, keeps forced users out of the app tabs, lets them set a new password through `/api/me/change-password`, refreshes `/api/me`, and then lands them in the app without needing a computer.
- Slice 3D/4 handoff shipped: the onboarding dialog now shows post-commit requested/added/skipped counts, keeps direct-created temporary passwords visible only in the result handoff, and supports CSV download for one-time temporary-password distribution.
- Slice 3E shipped onboarding status: `/users/onboarding-status` now gives staff/admin a searchable status page for total, pending, stale pending, and claimed onboarding access, linked from Users, Settings > Allowed Emails, and onboarding completion.
- Slice 3F/4 shipped bulk direct-create hardening: bulk `name,email,role,location` account creation supports role/location defaults, server-generated one-time temporary passwords, claimed allowlist rows, a 50-row cap, route-level rate limiting, and an explicit Admin-row rejection so onboarding remains scoped to Staff and Student accounts.
- Slice 6 shipped with web-owned registration recovery: native Login links invited users to the web `/register` page, `/register?email=...` prepopulates the email field for phone-first onboarding, and forced-password users complete setup natively through `/api/me/change-password`.
- Remaining launch work: run real end-to-end onboarding smoke in the launch environment, then complete Slice 7 verification/docs/archive.

### Booking Create UX Ownership Pass (2026-05-30)
- [x] Audit checkout and reservation create docs, schema, routes, services, wizard components, picker, and peer surfaces.
- [x] Write active slice plan in `tasks/booking-create-ux-goal-plan.md`.
- [x] Improve Step 1 event/ad hoc context clarity.
- [x] Improve Step 2 availability warning hierarchy and mobile-friendly summary.
- [x] Improve Step 3 confirmation handoff and submit confidence.
- [x] Add focused helper/component-flow coverage.
- [x] Sync checkout/reservation docs and run required verification.

**Review**
- Active tracking lives in `tasks/booking-create-ux-goal-plan.md`.
- Shipped: Step 1 now explains calendar-linked versus ad hoc booking mode, shows selected-event count, previews the derived window/location, and gives no-event users a direct ad hoc recovery action.
- Shipped: Step 2 now receives selected hard-conflict, next-use, serialized-turnaround, and bulk-turnaround counts from `EquipmentPicker`, then separates those states in the summary strip and footer CTA.
- Shipped: Step 3 now repeats selected availability warnings before submit, while checkout and reservation success toasts name the highlighted destination in `/bookings`.
- Peer patterns checked: Items create/edit forms, Items summary bars, booking detail equipment warning rows, schedule event creation handoff, and event/dashboard booking deep links.
- Focused tests passed: `npx vitest run tests/booking-create-ux.test.ts tests/create-booking.test.ts tests/booking-create-validation.test.ts`.
- Full gates passed: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.
- Browser smoke passed on `http://localhost:3013/checkouts/new` and `/reservations/new` at desktop and 390px mobile widths with no console warnings/errors; checkout smoke also reached Step 2, selected one item, and reached the confirmation handoff screen.

### Booking Create Hardening (2026-05-30)
- [x] Audit booking creation docs, schema, routes, shared service, availability checks, and existing tests.
- [x] Add shared server guardrails for empty non-draft bookings, duplicate multi-event IDs, and invalid create windows.
- [x] Normalize overlap and transaction race failures to booking conflict responses.
- [x] Add focused service and validation regressions.
- [x] Sync checkout/reservation docs and document verification.

**Review**
- Active tracking lives in `tasks/booking-create-hardening-plan.md`.
- Current root issue: the wizard catches several bad states, but the shared create service should still be authoritative for every booking-create caller, including API routes, reservation conversion, and reservation duplication.
- Implemented shared service validation for invalid windows, empty non-source equipment selections, duplicate `eventIds`, duplicate bulk lines, and invalid bulk quantities.
- Implemented create-schema validation for empty checkout/reservation payloads, while preserving checkout conversion payloads that use `sourceReservationId`.
- Overlap exclusion-constraint races and serializable conflicts now return 409 responses instead of surfacing as unhandled server errors.
- Focused tests passed: `npx vitest run tests/create-booking.test.ts tests/booking-create-validation.test.ts`.
- Shared availability and booking route regressions passed: `npx vitest run tests/availability.test.ts tests/availability-route.test.ts tests/booking-list-routes.test.ts`.
- Full gates passed: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.

### Global Search MVP Hardening (2026-05-21)
- [x] Audit current quick search and full search behavior against navigation, role visibility, and search-page contracts.
- [x] Harden quick search fetch behavior so partial endpoint failures do not collapse the palette.
- [x] Add navigation/action results for common destinations that are not entity records.
- [x] Align empty, loading, and error states between the quick palette and `/search`.
- [x] Update docs and run focused verification.

**Review**
- Current gaps: quick search only returns records, page destinations are not searchable, partial API failures are silent, and the palette does not explain what to try when no results appear.
- Implemented a shared role-aware page-search catalog for core pages, staff/admin tools, settings sections, and report tabs.
- Quick search now uses `Promise.allSettled` across entity endpoints and keeps page/record matches visible when one source fails.
- `/search` now shares the same page catalog and partial-failure behavior; item titles avoid blank brand/model placeholders.
- Docs added in `docs/AREA_SEARCH.md` and `docs/GAPS_AND_RISKS.md`.
- Verified with `npx vitest run tests/search-pages.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.
- Authenticated browser smoke was blocked by local Prisma `P1000` invalid database credentials during login; the protected search UI could not be reached in-browser in this environment.

### Gear Tracker Design Language (2026-05-20)
- [x] Slice 1: Status and accessibility quick wins.
- [x] Slice 2: Shared operational feedback primitives.
- [x] Slice 3: Shared list/filter/page structure.
- [x] Slice 4: Durable docs in `docs/DESIGN_LANGUAGE.md`.
- [x] Slice 5: Shared active-filter chips for operational toolbars.
- [x] Slice 6: Shared row-action menu trigger for operational rows.
- [x] Slice 7: Inline shared empty states for card/table interiors.
- [x] Slice 8: Booking row overflow actions on `OperationalRowActions`.
- [x] Slice 9: Trade Board secondary/destructive row actions on `OperationalRowActions`.
- [x] Slice 10: Trade Board active filter chips.
- [x] Slice 11: Reports active filter chips.
- [x] Slice 12: Item detail secondary actions on `OperationalRowActions`.
- [x] Slice 13: Bulk SKU units inline empty state.
- [x] Slice 14: Battery Ops checked-out units inline empty state.
- [x] Slice 15: Item detail tab empty states on shared `EmptyState`.
- [x] Slice 16: Items bulk action bar selected-toolbar semantics.
- [x] Slice 17: Event crew coverage empty rows on shared inline empty states.
- [x] Slice 18: Login form field names for browser accessibility checks.
- [x] Slice 19: Event crew controls visible and 40px target aligned.
- [x] Slice 20: Item detail header utility controls 40px target aligned.
- [x] Slice 21: Remaining auth form field names aligned with login.
- [x] Slice 22: Event missing-gear actions 40px target aligned.
- [x] Slice 23: Item image edit/add controls keyboard-focus visible.
- [x] Slice 24: Kit detail member row actions and destructive bulk-remove copy aligned.
- [x] Slice 25: Kit detail shared header and add-member clear control aligned.
- [x] Slice 26: Trade Board cancellation confirmation names the affected shift.
- [x] Slice 27: User detail area assignment row actions aligned.

**Review**
- Active tracking lives in `tasks/design-language-plan.md`.
- Initial audit found an existing system foundation, but route-specific drift in status color, queue cards, filter toolbars, hit targets, and page headers.
- Slice 1 corrected pending-pickup color semantics, checkout handoff copy, scan control hit targets, and inline save/cancel target sizes.
- Verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and a protected-route browser smoke to `/scan`.
- Slice 2 added shared operational metric and partial-results warning primitives, then wired them into Fix Today and Inventory Hygiene.
- Slice 2 verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/admin/fix-today` plus `/items/hygiene`.
- Slice 3 added the shared `OperationalToolbar`, moved Items and Users onto it, and put Scan on `PageHeader`.
- Slice 3 verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/items`, `/users`, `/scan`, and `/settings`.
- Slice 4 added `docs/DESIGN_LANGUAGE.md` and cross-linked Dashboard, Items, Users, Scan, and Settings.
- Slice 4 verified with `npx tsc --noEmit`, `git diff --check`, and `npx next build`.
- Slice 5 added a shared active-filter chip row, gave Items removable chips for active facets, and moved Users off its local chip implementation.
- Slice 5 verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/items` plus `/users`.
- Slice 6 added `OperationalRowActions`, moved Items table row actions and Settings Categories row actions onto the shared 40px shadcn dropdown trigger, and preserved existing actions.
- Slice 6 verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/items` plus `/settings/categories`.
- Slice 7 added inline sizing to `EmptyState` and moved Settings Categories plus Departments off local text-only empty placeholders.
- Slice 7 verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/settings/categories` plus `/settings/departments`.
- Slice 8 moved booking table rows, mobile rows, and booking cards onto `OperationalRowActions` while preserving shared menu items and right-click context menus.
- Slice 8 verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/bookings`.
- Slice 9 kept Trade Board Claim/Approve visible and moved Cancel/Decline into `OperationalRowActions` to align row secondary/destructive commands with the shared trigger.
- Slice 9 verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/schedule`.
- Slice 10 moved Trade Board Area, Status, and My trades filter feedback onto `OperationalActiveFilterChips` while preserving existing selector controls and filter query behavior.
- Slice 10 verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/schedule`.
- Slice 11 moved non-default Checkouts, Scans, and Audit report filters onto shared removable active-filter chips through `ReportToolbar`.
- Slice 12 moved item detail secondary actions onto the shared `OperationalRowActions` dropdown wrapper while preserving the existing action policy.
- Slice 13 replaced the Bulk SKU units text-only empty row with shared inline `EmptyState` copy and Add units recovery.
- Slices 11-13 verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke for Reports, item detail, and Bulk SKU detail.
- Slice 14 replaced the Battery Ops checked-out-units text-only empty row with shared inline `EmptyState` copy.
- Slice 14 verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/bulk-inventory/batteries`.
- Slice 15 replaced item detail booking, schedule, insights, and attachments empty states with shared inline `EmptyState` copy.
- Slice 16 tightened the Items bulk action bar with toolbar semantics, clearer selected-item menu language, and 40px action targets.
- Slice 17 replaced event crew coverage text-only empty area rows with shared inline empty states and aligned add-shift icon targets to the 40px baseline.
- Slices 15-17 verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/items`, `/items/test-item-id`, and `/events/test-event-id`.
- Slice 18 added stable `name` attributes to the login email, password, and remember-me fields, clearing the browser form-field warning from protected-route smoke.
- Slice 19 moved event crew assignment, pending-request, approve/decline, and remove controls to visible keyboard-friendly 40px targets.
- Slice 20 moved item detail header refresh, favorite, and secondary action controls to the 40px target baseline.
- Slice 21 added stable field names to register, forgot-password, reset-password, and forced-password-change forms.
- Slice 22 moved event missing-gear Nudge and Create checkout controls to 40px action targets with cleaner narrow-row wrapping.
- Slice 23 made item detail image edit/add buttons keyboard-focus visible instead of relying on hover-only reveal.
- Follow-on Area 1 captured authenticated visual proof for dashboard, items, users, scan, settings, checkout creation, Fix Today, Hygiene, item scan identity, item image modal, and event detail after starting local dev with the working `.env` Neon URL instead of the stale `.env.development.local` database host.
- Follow-on Area 2 moved shared overlay close controls, booking `EquipmentPicker` dense controls, and shift-slot interior actions to the 40px operational target baseline.
- Follow-on Area 3 created `tasks/design-language-route-conformance-checklist.md` for Dashboard, Schedule, Items, Bookings, Users, and Settings. The next design-language slice is Settings sub-page follow-through.
- Follow-on Area 4 completed Settings consistency follow-through: Extend Presets, Kiosk Devices, Allowed Emails, and Database Health now align compact controls and empty states with the shared operational design-language baseline. Verified with TypeScript, migration-prefix check, whitespace check, production build, and authenticated Chrome smoke. The next design-language slice is the state and copy audit.
- Follow-on Area 5 completed the state and copy audit for high-traffic daily flows: dashboard draft recovery, booking detail custody actions, and shift detail staffing actions now use object-specific confirmation, failure, rollback, and retry language. The next design-language slice is shared component consolidation.
- Follow-on Area 6 moved Bookings filters onto `OperationalToolbar`, added shared active-filter chips, and raised shared removable filter controls to the 40px target baseline. Static checks and authenticated Bookings, Items, and Users browser smoke passed with no console errors.
- Follow-on cleanup completed the requested 4, 3, 2 batch: completed design-language plans were archived, proof screenshots are ignored, lower-traffic route conformance coverage now includes Kits, Licenses, Resources, Labels, Notifications, Search, Reports, Battery Ops, Bulk SKU detail, and detail pages, and Schedule View/Venue segmented controls now use shadcn `ToggleGroup` while preserving the schedule-specific command bar.
- Follow-on cleanup verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated `/schedule` browser smoke with no console warnings, errors, or issues.
- Follow-on metrics and targets batch completed Reports metric-card consolidation, Kits and Battery Ops shared metric strips, and Labels/Search compact target cleanup.
- Follow-on metrics and targets batch verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke for `/reports/utilization`, `/kits`, `/bulk-inventory/batteries`, `/labels`, and `/search?q=sony`.
- Follow-on low-traffic controls batch cleaned up Notifications, Licenses, and Resources: shared operational metrics where applicable, shadcn Resources sorting, shared active filter removals, and 40px action/link targets.
- Follow-on low-traffic controls batch verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke for `/notifications`, `/licenses`, and `/resources?filter=contacts&q=erik&sort=recent`.
- Kit detail follow-up moved serialized and bulk member removal onto `OperationalRowActions`, added confirmed/parsed-error bulk member removal copy, and tightened the bulk-member delete route to reject memberships outside the current kit.
- Detail follow-up batch moved Kit detail onto `PageHeader`, clarified Trade Board cancel confirmations with event/shift/owner context, and replaced user area-assignment tiny chip actions with shared operational row actions.

### Settings Navigation Rail (2026-05-20)
- [x] Add grouped desktop Settings rail using existing role-aware section config.
- [x] Preserve horizontal section scroller on smaller screens.
- [x] Preserve Settings search palette and last-tab resume behavior.
- [x] Run verification.

**Review**
- Active tracking lives in `tasks/settings-navigation-rail-plan.md`.
- The current issue is navigation density: 13 settings sections plus Overview were packed into a horizontal tab strip.
- A full always-visible labeled rail would fight the existing settings-split intro columns on laptop screens, so this slice uses the rail only at large desktop sizes and keeps the existing smaller-screen scroller.
- Verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/settings` plus `/settings/categories`.

### Settings Shell Cleanup (2026-05-20)
- [x] Add a shared `SettingsPageShell` component.
- [x] Migrate Settings sub-pages off repeated split-grid markup.
- [x] Keep loading, error, and normal states aligned inside the shared shell.
- [x] Update Settings and design-language docs.
- [x] Run full verification.

**Review**
- Active tracking lives in `tasks/settings-shell-cleanup-plan.md`.
- The current issue was not visual taste. Every Settings sub-page repeated the same intro/main grid, and several pages repeated it again for loading and error states.
- The shared shell makes the intro rail narrower, the heading quieter, and the main column consistent under the new Settings rail.
- Verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/settings/categories`, `/settings/notifications`, and `/settings/kiosk-devices`.

### Settings Actions, Empty States, And Copy (2026-05-20)
- [x] Move Settings lifecycle/destructive row actions onto `OperationalRowActions`.
- [x] Replace remaining local text-only empty states with shared inline empty states.
- [x] Tighten destructive/admin confirmation copy.
- [x] Update Settings and design-language docs.
- [x] Run full verification.

**Review**
- Active tracking lives in `tasks/settings-actions-empty-copy-plan.md`.
- This finishes the three follow-up Settings slices requested after the rail/shell work.
- The batch touched Settings catalog rows, feed/mapping rows, kiosk device cards, extend-presets empty state, and destructive confirmation copy.
- Verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/settings/calendar-sources`, `/settings/locations`, and `/settings/kiosk-devices`.

### Product Image Search Slice 1 (2026-05-20)
- [x] Add optional image-search provider env configuration.
- [x] Add Brave-backed image search helper with filtering and short cache.
- [x] Add authenticated `/api/image-search` probe/search endpoint with RBAC and rate limiting.
- [x] Document env setup in `.env.example`.
- [x] Verify with TypeScript and whitespace checks.

**Review**
- Slice 1 shipped the server foundation.
- Brave is the only shipped provider through `BRAVE_SEARCH_API_KEY`; the old Google fallback was dropped to avoid setup drag.
- `/api/image-search?probe=1` reports configured/provider state without spending provider quota.
- Normal search requests require `asset.edit`, are user-rate-limited, normalize query text, use the provider cache, and return only the modal-ready result shape.
- Verified with `npx tsc --noEmit`, `git diff --check`, and `npx next build`.

### Product Image Search Slice 2 (2026-05-20)
- [x] Add a Search tab to `ChooseImageModal` that self-hides when Brave is unconfigured.
- [x] Auto-probe and auto-search when a seeded item query is available.
- [x] Render loading, empty, quota, failed, and selectable-result states.
- [x] Reuse the existing image URL save path and retry with the thumbnail URL if the full image cannot be re-hosted.
- [x] Thread search seeds through the post-create item handoff, item detail image modal, and bulk SKU header.

**Review**
- Search now appears as the first tab only when Brave is configured and the modal has a search seed.
- Seeded searches auto-run from the product title so staff sees candidates immediately after choosing Add image.
- Brave queries add a hidden `product photo white background` bias while keeping the visible search field clean and editable.
- Paste URL, Upload, and Remove behavior still use the existing modal paths.
- Search-result saves still flow through the existing image re-host endpoints, preserving Blob ownership and audit behavior.
- Verified with TypeScript, whitespace checks, production build, and an unauthenticated route probe. Authenticated browser smoke is blocked locally by Prisma P1000 invalid database credentials during login.

### Product Image Search Slice 4 (2026-05-20)
- [x] Add provider tests for normalization, configuration, Brave mapping, quota handling, filtering, de-dupe, and cache behavior.
- [x] Add API route tests for auth, RBAC, probe, validation, success, quota, and rate limiting.
- [x] Run focused image-search tests.
- [x] Re-run TypeScript and whitespace checks.

**Review**
- Added provider coverage for Brave configuration, outbound request shape, result mapping, image URL filtering, duplicate suppression, quota handling, and cache reuse.
- Added API route coverage for unauthenticated access, student RBAC, provider probe, invalid queries, rate limiting, unconfigured fallback, quota responses, and successful mapped results.
- Verified with `npx vitest run tests/image-search.test.ts tests/api-image-search.test.ts`, `npx tsc --noEmit`, `git diff --check`, and `npx next build`.

### Product Image Search Slice 5 (2026-05-20)
- [x] Update Items docs for Brave-backed human-pick image search.
- [x] Update Bulk Inventory docs for item-family image search handoff.
- [x] Add a durable decision record for the Brave image-search direction.
- [x] Reconcile Gaps and Risks without closing the remaining BulkSku backfill risk.
- [x] Re-run doc/static verification.

**Review**
- Docs now record Brave as the only shipped image-search provider, with no Google setup path and no retailer scraping path.
- Items docs describe the Search tab, seeded product-title searches, source-domain review, and Blob re-host save path.
- Bulk docs describe item-family search seeding through `sku.name` and clarify that future manual picks are re-hosted through the existing bulk image endpoint.
- `GAPS_AND_RISKS.md` keeps the remaining BulkSku cron/backfill issue open because existing external `BulkSku.imageUrl` values are not automatically drained yet.

### Product Image Search Follow-up (2026-05-20)
- [x] Add a source inspection link on search result tiles.
- [x] Re-run focused tests and static checks.

**Review**
- Search result tiles now separate selection from source inspection: clicking the image selects it, and the external-link control opens the source page in a new tab for staff review.
- Verified with `npx vitest run tests/image-search.test.ts tests/api-image-search.test.ts`, `npx tsc --noEmit`, `git diff --check`, and `npx next build`.

### Product Image Search QC Polish (2026-05-20)
- [x] Add lightweight source trust cues for manufacturer, retailer, marketplace, and unknown domains.
- [x] Add quick search suggestion chips for product photo, front, and kit variants.
- [x] Make normal searches prefer B&H through Brave with automatic broad fallback.
- [x] Add focused helper coverage for B&H query construction and result merging.
- [x] Add fallback handling for broken search-result preview images and route 429 responses.
- [x] Limit B&H dominance in the result grid when retailer preview images are blocked.
- [x] Add query-free provider usage logging with provider, status, result count, latency, and quota flag.
- [x] Re-run focused tests and static checks.

**Review**
- Result tiles now show source type cues without blocking or auto-ranking results.
- Query chips refine the current product-title seed while preserving the editable search field.
- Normal searches now try B&H first through Brave's `site:bhphotovideo.com` operator without extra broad bias terms, then merge broader Brave results so B&H can lead the grid without filling every tile when retailer previews are blocked.
- QC follow-up added pure helper tests for B&H query construction and merge de-dupe order, direct-image preview fallback, and temporary-limit handling for 429 responses.
- Server logging intentionally omits query contents so usage can be observed without recording item-specific searches.
- Verified with `npx vitest run tests/api-image-search.test.ts tests/image-search.test.ts`, `npx tsc --noEmit`, `git diff --check`, `npx next build`, and authenticated browser smoke on `http://localhost:3000`.

### Resources Model Rename (2026-05-19)
- [x] **Prisma rename:** Rename Prisma `Guide` model to `Resource` and update `User` relations.
- [x] **DB migration:** Add and apply `0068_rename_guides_to_resources` to rename the live table, indexes, and FK constraints from guides to resources.
- [x] **API identity:** Move `/api/resources` RBAC and audit strings from `guide` to `resource`.
- [x] **Verification:** Run focused resource tests, TypeScript, migration checks, build, live Neon table inspection, and `/resources` route smoke.

**Review**
- Neon now has `public.resources`, `public.guides` is gone, and migration health reports 69/69 applied migrations.
- `@/lib/guides` remains as the compatibility service name, but Prisma access now goes through `db.resource`.
- Unauthenticated smoke proves `/resources` compiles and redirects to `/login`, `/api/resources` returns the expected 401, and `/guides` redirects to `/resources`.

### Trade Board UX/UI Ownership Pass (2026-05-14)
- [x] **Plan:** Audit the current Trade Board against docs, schema, API routes, service behavior, and peer schedule list patterns.
- [x] **Scenarios:** Work through student open/own trade flows, staff claimed-trade review, filters, empty/error states, duplicate clicks, and invalid API filters.
- [x] **Implementation:** Tighten the sheet layout, status language, event/shift context, visible notes/approval context, action states, and API filter validation.
- [x] **Verification:** Run focused trade tests, static checks, production build, and a browser smoke of the Trade Board sheet.

**Review**
- Trade Board now uses compact card rows that fit the right-side sheet instead of a dense six-column table.
- Rows show cleaned schedule titles, shift time, area, approval mode, poster/claimer, notes, and clearer status helper text.
- The normal Schedule list `Trade` shortcut now opens a notes dialog before posting, so the board's note field has a real lightweight entry path outside the full event detail sheet.
- Stale open/claimed trades whose shifts have already started are no longer postable, claimable, approvable, listed as actionable, or counted in the Schedule header badge.
- Trade Board rows now receive opponent and home-away event fields from the API, so their titles use the same cleanup rules as the rest of Schedule.
- Student actions focus on claiming and cancelling their own posts; staff/admin actions focus on approve/decline for claimed trades.
- Mutation handlers now clean up on auth redirects/network failures and use a ref-backed guard against duplicate submits.
- The trade list API now rejects invalid `status` and `area` filters with 400s before querying.
- Verified with focused trade tests, TypeScript, migration-prefix check, whitespace check, and production Next build. Codex browser reached the local dev server and redirected to `/login` without console errors; authenticated sheet review is available on `http://127.0.0.1:3012`.


### Schedule Browser UI Prototype (2026-05-14)
- [x] **Normal schedule hierarchy:** Promote `Assign shifts` as the primary staff action, quiet repeated open-slot badges, and move `Next call` to the first readiness card.
- [x] **Verification:** Browser-check `/schedule`, run focused static checks, and ask for feedback before changing schedule subpages.

**Review**
- `Assign shifts` is now the primary staff/admin action in the Schedule header.
- `Needs staff` remains a filter control, but no longer repeats the count already shown in the readiness strip.
- `Next call` now leads the readiness strip and gets stronger visual treatment.
- The list header now shows the event count only; open-slot totals live in the readiness strip and per-row needs chips.
- Normal schedule rows now use Staff as the generic open-slot label and derive expanded-row Staff/Student labels from the assigned user's role.
- Per-row `Needs ... staff` chips now match the smaller row-badge scale instead of reading louder than coverage badges.
- Rows assigned to the signed-in user now get a subtle primary tint instead of an `Assigned`/`Confirmed` badge; pending requests still keep their badge in My Shifts context.
- Follow-up naming pass: generic schedule coverage copy now uses Staff/covered language, while expanded assignment rows stay role-aware.
- Expanded assignment rows now have a same-area plus action, quieter empty assign rows without dashed boxes, and a hover/focus X for staff/admin assignment removal.
- Hide-event hardening shipped: the visibility API now validates a strict boolean payload, wraps the event update and audit log in one transaction, blocks malformed body drift, shows row-level hiding state, and offers Undo from the hide success toast.
- Assign page polish shipped: `/schedule/assign` now uses the shared schedule title cleanup and venue-tone derivation, trims imported `[N]`/Wisconsin prefixes, shows venue and filled/open slot context in the sticky event column, and uses quieter assignment/no-slot cells with hover remove overlays.
- Assign page area-slot cleanup shipped: the grid no longer has Staff/Student sub-sections, each area column now owns all of its slots, and staff/admin users can add a slot or remove an empty slot inline.
- Assign page current-work cleanup shipped: the grid now follows the normal Schedule list default by showing only active events from today forward, removes past rows and archived shift groups from the current assignment workflow, disables navigation into fully past months, replaces repeated `Add slot`/`Open` text controls with quieter row-style affordances, and uses compact overlapping avatar stacks for assigned people.
- Assigned avatars now use app-styled hover tooltips for names and a small explicit hover/focus X for removal, so the whole avatar is no longer the destructive target.
- Direct assignment now syncs shift worker type from the assigned user's role, keeping the hidden `FT`/`ST` data aligned with the Staff/Student labels derived in the UI.
- Event titles now share one formatter across list, week, and calendar views; matchup text stays primary while dash-suffix event context moves to smaller secondary text.
- Venue indicators now use one shared treatment: Home green, Away orange, Neutral gray. The dashboard Upcoming Events control now includes a Neutral tab.
- Follow-up hardening audit resolved: `/schedule/assign` is now server-gated for staff/admin, assignment mutations use ref-backed duplicate-submit guards with success feedback, and calendar/shift date APIs reject invalid or inverted dates with 400 responses.
- Normal `/schedule` peer pass resolved the remaining current findings from the older audit: inline assignment success feedback, shared week-start math, direct trade-count refetching, stale helper removal, and tokenized conflict colors.
- Follow-up verified with focused Vitest coverage, TypeScript, migration-prefix check, whitespace check, and production Next build.
- Verified with `npx tsc --noEmit`, `git diff --check`, and a live `/schedule` browser refresh with no console warnings or errors.

### Dashboard Browser UI Prototype (2026-05-14)
- [x] **Plan:** Use the live browser audit to prototype a narrower Dashboard visual pass without changing API behavior.
- [x] **Header:** Quiet the refresh/filter controls and keep checkout/reservation creation as the clear primary actions.
- [x] **Stats:** Reduce the weight of zero-value metrics and make nonzero action states easier to spot.
- [x] **Rows/empty states:** Compress empty personal sections and strengthen the active booking row affordance.
- [x] **Verification:** Check the updated Dashboard in browser, run focused static checks, and ask for product feedback before touching the next page.

**Review**
- Prototype only: no API, permission, schema, or booking action behavior changed.
- Header groups refresh/filter as secondary controls and makes `New checkout` the stronger primary action.
- Zero metric cards are quieter, while nonzero metric cards keep stronger foreground treatment and visible link affordance.
- Empty personal gear state is one compact card with direct reserve/check-out actions instead of two tall empty sections.
- Booking rows keep their compact height with a subtle open affordance on hover/focus.
- Follow-up correction: My Gear empty states now use a medium-height centered body, between the original compact row and the larger Team Activity empty cards.
- My Gear reservation rows now use the same purple reservation rail as other reservation rows.
- My Gear checkout rows now use the same blue checkout rail as other checkout rows.
- Verified with `npx tsc --noEmit`, `git diff --check`, and live browser refresh of `/` with no console warnings or errors.

### Focused UI Opportunity Audit (2026-05-14)
- [x] **Plan:** Audit current docs, task notes, route surfaces, and shared UI patterns before choosing any implementation slice.
- [x] **Inventory:** Review all signed-in web surfaces for concrete layout/functionality polish opportunities.
- [x] **Rank:** Produce a repo-grounded short list of focused UI improvement slices with source evidence and suggested verification.

**Review**
- Best next slice: fix booking deep-link/workflow drift first (`sheetTab` ignored, sport filter options derived from current page only, event CTAs detour through list redirects).
- Strong cross-cutting follow-ups: settings/global command-palette collision, duplicate offline banners, settings role-nav flicker, and PageHeader action wrapping at compact widths.
- Strong specialized follow-ups: kits detail item-family add/remove completion, Missing Units filters, Guides body-search parity, and item-family detail tab normalization.

### Bulk Item Families Follow-Through (2026-05-13)
- [x] **Labels parity:** Include item-family parent/bin QR labels in the global print-label queue alongside serialized item labels.
- [x] **Admin/report copy:** Replace remaining normal-user-facing SKU/bulk wording in touched Battery Ops, item-family settings, and missing-unit reporting surfaces.
- [x] **Report naming:** Rename the report tab to Missing Units so staff see the operational problem, not item-family jargon.
- [x] **Creation naming:** Change Add Item tracking choices to Standard, Units, and Quantity with examples, and keep list/picker rows focused on availability instead of type badges.
- [x] **Detail naming:** Polish item-family details so availability, unit grids, QR, settings, and status actions read as normal item detail language with Missing instead of Lost where the UI describes staff follow-up work.
- [x] **Battery Ops naming:** Align Battery Ops and Missing Units report with Missing and Units language instead of Lost, numbered, or implementation-heavy terms.
- [x] **Ops navigation naming:** Rename the admin battery surface to Battery Ops and the item-family operations handoff to Stockroom view.
- [x] **Booking picker guidance:** Recommend compatible battery families from selected cameras, label item-family quantities as requested, and keep exact unit binding at kiosk pickup.
- [x] **Scan lookup polish:** Show exact unit QR scans inside the parent item-family context with explicit unit status and checkout custody details, while keeping app scan lookup-only.
- [x] **Kiosk battery clarity:** Make native kiosk pickup/return battery progress show required/scanned unit counts, exact scanned unit chips, and disabled-confirm guidance.
- [x] **Doc sync:** Update bulk inventory, reports, and the bulk item families plan with the follow-through outcome.
- [x] **Verification:** Run TypeScript, migration-prefix check, whitespace check, and app build.

**Review**
- Naming is now centered on Missing Units for the report surface, battery families for low-stock operations, and item-family/unit language where the UI still needs the family model.
- Add Item now maps Standard to serialized assets, Units to numbered/scannable item families, and Quantity to count-only item families.
- Item-family detail pages now use normal item wording, compact tracking labels, QR copy without web-print assumptions, and Missing language for unit exception states.
- Battery cockpit and Missing Units report now describe battery families using Units and missing-unit events without exposing old numbered/lost wording.
- The admin nav now says Battery Ops, and `/items/bulk-{id}` points staff toward a Stockroom view instead of generic admin operations.
- Booking picker guidance now supports the "request quantity now, scan exact units at pickup" model for battery families.
- App scan exact unit QR results now show the parent item family, unit number, Missing/Checked out/Available status, and checked-out custody context when present.
- Native kiosk pickup and return now show battery unit progress as required/scanned counts, exact scanned/returned unit chips, and clearer disabled pickup-confirm copy when unit scans are still missing.
- Verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.

### iOS Home Event Queue Cleanup (2026-05-13)
- [x] **Header cleanup:** Remove the debug Kiosk button from iOS Home, move Profile to the top-left toolbar, and leave notifications on the top-right.
- [x] **Queue controls:** Remove the inline create button from the Next Up card and remove the shift row calendar shortcut.
- [x] **Freshness placement:** Move the "Updated now" signal into the stat strip so it reads as metadata for the numbers, not a stray page element.
- [x] **Event core model:** Add a dashboard `myEventWork` payload that ties a user's event shift to gear through primary event, `BookingEvent`, and shift-assignment links.
- [x] **Event grouping:** Render event-linked shift and gear work as one Home queue row and suppress the linked standalone gear rows.
- [x] **Event detail:** Open one event page from Home with shift call time and gear reservation or reserve-now action together.
- [x] **Verification:** Run iOS drift/audit checks, scoped whitespace checks, and the Wisconsin simulator build.

**Review**
- Dashboard booking summaries now include all linked event IDs, and `/api/dashboard` exposes `myEventWork` as the event-centric source of truth for a user's shift plus gear.
- Home keeps the bottom-right create action, removes duplicate card-level create and shift calendar buttons, and moves sync freshness into the stat strip as "Synced now" metadata.
- Combined event rows now suppress every event-linked gear booking and show student-facing sublines like "Pickup gear at 10:00 AM" plus "Call time at 10:30 AM"; if no reserved gear exists, the row says "Reserve gear now."
- Event detail now carries the same event work context so the gear action and call time live on one page instead of sending students to separate shift and booking views.
- Follow-up fix: iOS dashboard decoding now defaults new event-linkage fields when the app talks to a server that has not deployed the new `myEventWork` payload yet.
- Verification passed with `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, scoped `git diff --check`, the Wisconsin iOS simulator build, and compile-only `npx next build`.

### Battery Audit Reporting (2026-05-13)
- [x] **GAP-37:** Missing Units now reports unit-tracked battery missing units by unit number, missing rate by family, recent checkout history, and repeated missing family/requester patterns.
- [x] **Shared battery detection:** Battery cockpit and report aggregation now use the same term-boundary SKU matcher.
- [x] **Verification:** Focused report service coverage and TypeScript passed before closeout.

**Review**
- `tasks/archive/battery-audit-reporting-plan.md` tracks the one-slice implementation and doc sync.
- `docs/GAPS_AND_RISKS.md` closes GAP-37 with the shipped Missing Units reporting behavior.

### Gap Reliability Closure (2026-05-13)
- [x] **GAP-58:** Kiosk dashboard now uses partial-result fallbacks instead of failing the idle screen when one read fails.
- [x] **GAP-54:** Deleted the unscheduled `archive-shifts` cron route and documented `morning-refresh` as the single scheduled shift-archive path.
- [x] **GAP-33:** Morning-refresh auto-expires stale pending-pickup checkouts after 48h with allocation, bulk-stock, numbered-unit, scan-session, and system-audit cleanup.
- [x] **Verification:** Run focused tests, TypeScript, migration checks, full build, and doc sync.

**Review**
- `tasks/gap-reliability-plan.md` tracks the three-slice implementation.
- `docs/GAPS_AND_RISKS.md` closes GAP-33, GAP-54, and GAP-58 with the shipped behavior.

### Prisma + Neon Health Runbook (2026-05-13)
- [x] **Replace raw status:** Route `npm run db:migrate:status` through the repo's Neon-backed health checker instead of raw `prisma migrate status`.
- [x] **Add explicit health command:** Add `npm run db:migrate:health` to compare local migration folders with live `_prisma_migrations`.
- [x] **Fail on drift:** Flag pending local migrations, unresolved failed rows, applied DB-only migrations, and newest-local-not-applied state.
- [x] **Document operations:** Add a Prisma + Neon runbook covering `DATABASE_URL`, `DIRECT_URL`, deploy, health, and recovery rules.

**Review**
- Migration status now uses the same source of truth as production recovery: direct Neon inspection through `DIRECT_URL`.
- The health checker is import-safe and covered by focused regressions for clean, pending, failed, DB-only, and rolled-back migration history.
- `docs/PRISMA_NEON_RUNBOOK.md` is the short operational reference for future schema and deploy work.

### Prisma + Neon Cleanup (2026-05-12)
- [x] **Retire one-off migration helpers:** Delete superseded `scripts/apply-migration-0042.mjs`, `0059`, `0060`, and `0061` now that the shared deploy wrapper owns fallback behavior.
- [x] **Tighten fallback safety:** Require `DIRECT_URL` for Neon HTTP migration fallback instead of allowing DDL through pooled `DATABASE_URL`.
- [x] **Cover SQL splitting:** Add focused regression coverage for quoted semicolons, comments, and dollar-quoted blocks in the migration wrapper.
- [x] **Refresh stale notes:** Update active task notes that still said `npm run build` was blocked by Prisma's schema engine.

**Review**
- The migration fallback is now import-safe and testable, with `splitSqlStatements` exported for focused coverage.
- `DIRECT_URL` is mandatory for fallback migration execution. `DATABASE_URL` remains the pooled runtime URL.
- Old migration-specific recovery scripts are gone, so future deploy recovery has one supported path.

### Admin User Photo Management (2026-05-12)
- [x] **UI access:** Let admins open the existing profile-photo menu on any user detail page, while preserving self-service upload for the signed-in user.
- [x] **Permission contract:** Keep the avatar API admin-only for other users and prove staff cannot change another user's photo.
- [x] **Docs and verification:** Sync Users docs and run focused avatar route tests plus TypeScript/whitespace checks.

**Review**
- User detail profiles now render the photo upload/remove menu for the signed-in user or any admin. Staff still see a read-only avatar when viewing someone else.
- `/api/users/[id]/avatar` keeps the other-user mutation boundary admin-only, with dead staff-target role checks removed and clearer profile-photo error wording.
- Focused coverage proves admins can upload/remove another user's profile photo and staff cannot. Verified with `npx vitest run tests/user-avatar-route.test.ts`, `npx tsc --noEmit`, `git diff --check`, and `npm run build`.

### Prisma + Neon Migration Reliability (2026-05-12)
- [x] **Diagnose current failure:** Confirm schema validation and migration prefix checks pass while Prisma DB-facing commands still hit the blank schema-engine error against Neon.
- [x] **Align config with Neon guidance:** Add explicit Prisma config and document pooled runtime vs direct migration URLs.
- [x] **Build-safe migration deploy:** Keep normal `prisma migrate deploy` first, with a Neon HTTP fallback for the known blank schema-engine failure.
- [x] **Verification:** Apply the pending migration, prove Neon migration history is current, and run build-safe checks.

**Review**
- Added `prisma.config.ts` so Prisma CLI uses the direct Neon URL for migration work, while app runtime keeps using the pooled `DATABASE_URL`.
- Added `scripts/prisma-migrate-deploy.mjs` and wired `build`, `migrate`, and `db:migrate:deploy` through it. The wrapper runs standard `prisma migrate deploy` first and only falls back to Neon HTTP when Prisma exits with the known blank schema-engine failure.
- Applied pending migration `0065_add_booking_completed_at` through the fallback. Neon now has `_prisma_migrations.finished_at` for `0065_add_booking_completed_at`, and `bookings.completed_at` exists as a nullable timestamp.
- Verified with `npx prisma validate`, `node --check scripts/prisma-migrate-deploy.mjs`, `npm run db:migrate:check`, idempotent `npm run db:migrate:deploy`, direct Neon inspection, and full `npm run build`.

### iOS Staff TestFlight Feedback Fixes (2026-05-12)
- [x] **Home ownership:** Keep Home's number strip global, but make Home action rows show only the signed-in user's shifts, checkouts, pickups, and reservations.
- [x] **Home controls:** Remove row icons from the Home queue, move profile to the top right, and put creation behind a bottom-right action button.
- [x] **Schedule student fit:** Keep students out of past-event browsing and staff creation/crew setup controls.
- [x] **Navigation feel:** Reset tab-local stacks/filters where expected when users reselect a tab, while preserving native back buttons and swipe-back.
- [x] **Scan reliability:** Stop QR scans from opening the same item page twice.
- [x] **Verification:** Run iOS drift/audit checks, scoped whitespace checks, and the Wisconsin simulator build.

**Review**
- Home now keeps the existing top metrics, but the action queue is personal: overdue/due checkouts, pickups requested by the signed-in user, their reservations, and their shifts.
- Home rows use tone rails instead of ambiguous calendar icons, the profile/avatar action moved to the top right, and booking creation now lives in the bottom-right action button above the tab bar.
- Schedule hides the past-events toggle from students and resets it off for student sessions, while staff/admin users keep the historical browsing control.
- Reselecting tabs now clears local navigation and filters on Home, Bookings, Items, Scan, Schedule, and Users, without disabling the native navigation back button or swipe-back gesture.
- Scan now dedupes repeat QR callbacks in both the sheet-level scanner and the Scan tab lookup flow, so the same sticker does not push the item page twice.
- Verified with `npx tsc --noEmit`, `git diff --check`, `npm run drift:ios`, `npm run audit:ios:gaps`, and the Wisconsin iOS simulator build.

### Awards Collection UI (2026-05-12)
- [x] **Collection shelves:** Rework the web profile badge tab from a flat gallery-first layout into Apple Fitness-inspired award collection shelves.
- [x] **Artifact medallions:** Upgrade the shared badge medallion into a reusable CSS/SVG award object with rarity finish, clean rim, locked state, and category shape options.
- [x] **Category drill-in:** Let users open a collection to browse that award family with existing earned/locked/manual/rare filters and badge detail modal.
- [x] **Docs and verification:** Sync badge docs and run TypeScript, whitespace, app build, and local browser smoke where auth allows.

**Review**
- The web profile Badges tab now opens as an awards collection shelf instead of a flat gallery. Gear Flow, Reliability, Scans, Teamwork, and Staff Picks each show a featured award artifact, preview stack, earned/visible counts, and Show all affordance.
- Opening a collection shows the existing browsable award grid with all, earned, locked, manual, and rare filters plus the current detail modal, so the Apple Fitness structure does not remove operational metadata.
- Shared `BadgeMedallion` now renders a CSS/SVG award artifact with category shapes, a clean rim, locked grayscale state, rarity finish, and scalable icon sizing. The first browser pass removed busy internal linework because it competed with the glyph.
- Closeout audit fixed stale `RETURN` category handling to the shipped `ON_TIME` schema category on web and iOS, and added a regression proving shift request approval does not emit shift badge completion.
- Verified with focused badge/shift tests, `npx tsc --noEmit`, `git diff --check`, `npx next build`, iOS drift/audit checks, and the Wisconsin iOS simulator build.
- Browser smoke found the existing 3000 and 3001 servers were stale, so a temporary clean server on 3010 was used. `/users?tab=badges` compiled and redirected to `/login` with no Chrome console warnings or errors; no authenticated browser session was available.

### iOS Badge Gallery Polish (2026-05-12)
- [x] **Compact profile entry:** Keep the native profile badge card restrained and add a See all action.
- [x] **Full gallery sheet:** Add a native Badge Gallery sheet with all, earned, locked, manual, and rare filters.
- [x] **Expandable details:** Let users tap a badge to see title, description, earned date, source, category, rarity, trigger, note, and progress.
- [x] **Native feel:** Add rarity medallions, recent-award glow, hidden-surprise copy, and haptic feedback.
- [x] **Verification:** Run iOS drift/audit checks, scoped whitespace check, and simulator build.

**Review**
- Native User Detail now mirrors the web gallery model without turning the profile into a trophy wall. Earned badges stay in the profile card; See all opens the full gallery.
- The gallery shows visible earned and locked badges, keeps surprise badges hidden until earned, and supports filters for all, earned, locked, manual, and rare.
- Badge detail sheets expose the badge story and metadata with native SwiftUI layout and progress display where supported.
- Verified with `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check -- ios/Wisconsin/Views/UserDetailView.swift`, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`.

### Badge Gallery UI Polish (2026-05-12)
- [x] **Gallery model:** Replace the split earned/available badge tab with one browsable badge gallery.
- [x] **Filtering:** Add all, earned, locked, manual, and rare filters without adding a top-level nav item.
- [x] **Expandable details:** Let users open any visible badge to see title, description, earned date, source, category, rarity, note, trigger metadata, and progress.
- [x] **Special feel:** Add tactile tile interaction, subtle hover lift, recent-award "New" state, and rarity glow while keeping profile hero clean.
- [x] **Verification:** Run TypeScript, focused badge tests, build, and browser smoke.

**Review**
- The web profile Badges tab now behaves as a full gallery instead of separate earned and available lists. The gallery keeps the existing profile-first placement, adds all/earned/locked/manual/rare filters, and preserves hidden surprise badge behavior.
- Badge tiles are clickable and open a shadcn dialog with the full badge story: title, description, earned date, source, category, rarity, staff note, trigger metadata, and progress for supported locked badges.
- Visual polish added tactile press scale, hover lift, recent-award "New" treatment, and rarity-aware glow without adding badge chrome to the profile hero.
- Verified with `npx tsc --noEmit`, focused badge Vitest coverage, `git diff --check`, `npx next build`, and unauthenticated Chrome smoke of `/users?tab=badges` redirecting to `/login` with no console errors.

### iOS Badge Profile Surface (2026-05-12)
- [x] **Vercel enablement:** Add `BADGES_ENABLED=true` to Vercel Production and Development environments; Preview still needs branch-scope resolution in the Vercel CLI/dashboard.
- [x] **Native badge profile:** Add iOS badge profile models and API client support for `/api/badges/user/{id}`.
- [x] **User profile UI:** Show earned badges on native user profiles without crowding the profile header, and keep badge loading non-blocking when disabled or not visible.
- [x] **Notification routing:** Route iOS `badge_awarded` inbox rows to the awarded user's native profile.
- [x] **Verification:** Run iOS drift/audit checks and Swift build.

**Review**
- Vercel now lists `BADGES_ENABLED` in Production and Development. Preview env creation still needs Vercel branch-scope resolution because the CLI rejected both the multi-environment add and the all-preview non-interactive add with `git_branch_required`.
- Native user profiles now load badge data from `/api/badges/user/{id}` without blocking profile load if badges are disabled or hidden, and earned badges render below the profile header.
- iOS `badge_awarded` notification rows now use trophy styling and route to the awarded user's native profile through the `userId` payload.
- Verified with `npm run drift:ios`, `npm run audit:ios:gaps`, scoped `git diff --check`, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`.

### Custom Badge Awarding (2026-05-12)
- [x] **API path:** Let admins create an active custom manual badge definition while awarding a user, without schema changes or evaluator side effects.
- [x] **Award dialog:** Add a custom-badge mode to the existing user admin Award badge dialog so an admin can create "Guinea Pig" once and award it immediately.
- [x] **Catalog reuse:** Keep custom badges in the normal active catalog so the second and third staff awards can reuse the same definition.
- [x] **Docs and verification:** Sync badge docs and run focused badge tests, TypeScript, Prisma validation, migration-prefix check, whitespace check, full tests, app build, and local browser smoke.

**Review**
- Custom badge creation is part of the existing admin-only manual award endpoint. It creates active `custom_` keyed `BadgeDefinition` rows as `MILESTONE` / `RULE` / `manual`, then awards the target user in the same manual-award flow.
- The user detail Award badge dialog now has Existing and Custom modes. A custom "Guinea Pig" badge can be created and awarded on the first staff profile, then reused from the Existing selector for the next staff profiles.
- Custom awards keep the existing manual-award audit entry, staff attribution, optional note, inbox notification, and profile badge refresh behavior.
- Verification passed with focused badge tests, full Vitest, TypeScript, Prisma validation, migration-prefix check, whitespace check, `npx next build`, and a local unauthenticated `/users` browser smoke with no console errors.

### Users Invite and Password Reset Fixes (2026-05-12)
- [x] **New-user temp password contract:** Mark Users > Add User temporary passwords as forced-change credentials and keep the allowlist record visible as claimed for directly-created staff/student users.
- [x] **Allowed-email feedback:** Stop showing "added" when the API skipped an address that is already allowlisted or registered.
- [x] **No-email reset path:** Keep admin reset password as the working direct temporary-password path while email delivery is not configured.
- [x] **Docs and verification:** Sync Users docs, add focused regressions, and run targeted auth/allowed-email/user tests.

**Review**
- `POST /api/users` now creates temp-password accounts with `forcePasswordChange: true` and atomically creates or claims a visible allowlist row for directly-created staff/student users.
- Settings > Allowed Emails now distinguishes a skipped add from a newly-created row, and newly-created single entries appear immediately while the list refreshes.
- Follow-up fix: adding an address that already has a registered user now backfills a visible claimed allowlist row when one is missing, instead of returning the skipped no-op path.
- Forgot password no longer creates unusable reset tokens or promises an email when `RESEND_API_KEY` is missing; the working recovery path is the admin-generated temporary password.
- Verified with focused Vitest coverage, `npx tsc --noEmit`, `git diff --check`, and `npx next build`.

### Item Thumbnail Reliability (2026-05-12)
- [x] **Trace current thumbnail paths:** Confirm item images flow through the shared gear thumbnail primitives and item detail header.
- [x] **Shared render fix:** Normalize item image URLs, reset failed image state on source changes, and avoid optimizer-dependent rendering for item thumbnails.
- [x] **Docs and verification:** Sync Items docs, add focused regression coverage, and run TypeScript plus focused tests.

**Review**
- Shared `AssetImage` now trims stored URLs, upgrades legacy `http://` item image sources to `https://`, resets fallback state when a row/detail image source changes, and renders item photos without relying on Next image optimization.
- `ItemThumbnailStack` now uses a real lazy image with an error fallback instead of a CSS background image that could fail silently.
- Item detail header uses the same normalization and optimizer bypass as shared thumbnails.
- Verified with `npx vitest run tests/asset-image.test.ts`, `npx tsc --noEmit`, `git diff --check`, `npx next build`, and a local browser smoke of `/items` redirecting cleanly to `/login` with no console errors. Authenticated thumbnail visual smoke was not run because the current in-app browser session is unauthenticated.

### Security Audit and Patches (2026-05-12)
- [x] **Dependency advisory audit:** Confirm TanStack exposure, run current `npm audit --omit=dev`, and record any actionable package patches.
- [x] **App security audit:** Re-verify open auth/kiosk/cron/API risks against current source before patching.
- [x] **Patches:** Ship the smallest confirmed fixes for high-value security findings.
- [x] **Docs and verification:** Sync relevant area/risk docs and run focused tests plus build-safe checks.

**Review**
- TanStack exposure is limited to `@tanstack/react-query`, `@tanstack/react-table`, and related packages, with no compromised versions found in the current lockfile.
- Production dependency audit is clean after resolving the nested Next/PostCSS advisory with a direct dependency override and refreshed lockfile. `npm ls next postcss --depth=2` shows Next deduping to `postcss@8.5.14`.
- Package-manager cooldowns now require newly resolved npm package versions to be at least 7 days old across npm, pnpm, Yarn, and Bun project configs.
- Closed GAP-52, GAP-53, and GAP-55: forced-password users are routed to `/change-password` and blocked from regular app/API access, kiosk sessions have DB-backed server expiry, and notification cron keeps independent job successes when one job fails.
- Focused regressions passed: `npx vitest run tests/api-wrapper.test.ts tests/auth-hardening.test.ts tests/api-hardening-wave11.test.ts tests/kiosk-session-auth.test.ts tests/notification-cron.test.ts`.

### Creation Flow System (2026-05-12)
- [x] **Audit/standard:** Inventory high-impact create flows and define the shared creation-flow standard in `tasks/creation-flow-system-plan.md`.
- [x] **Items slice:** Harden the Items New asset sheet for safe submit, visible form errors, disabled controls, and explicit post-create handoff.
- [x] **Schedule/Users/Kits/Settings propagation:** Standardize the next high-impact create surfaces without converting simple forms into wizards.
- [x] **Docs:** Sync `AREA_ITEMS.md`, `AREA_EVENTS.md`, `AREA_SHIFTS.md`, `AREA_USERS.md`, `AREA_KITS.md`, `AREA_SETTINGS.md`, creation-flow task notes, and relevant gap notes.
- [x] **Verification:** Run TypeScript, focused checks where applicable, migration check, diff whitespace, Next build, and browser smoke on changed creation paths.

**Review**
- Shipped the Items `New asset` creation slice with guarded submit, disabled controls during save, form-level error handling, auth redirect handling, and explicit post-create actions.
- Shipped Schedule New Event, event crew setup/add shift, shift trade post, Kits New Kit, and high-use settings catalog add propagation so those flows now show form-level errors and clearer post-submit handoffs.
- Confirmed Users Add User already matched the standard in current source, and the security patch closes the forced temporary-password follow-up.
- Browser smoke found a real Schedule New Event persistence bug: manual events were modeled as `sourceId: null` in Prisma/source but the database migration history still had `calendar_events.source_id NOT NULL`. Added migration `0063_allow_manual_calendar_events_source_null` and a focused route regression.
- Browser smoke exposed and fixed a real API mismatch: asset creation rejected valid UUID-shaped department IDs from current data as invalid CUIDs.
- Final build exposed and fixed a pre-existing kiosk schema mismatch: the code enforced `sessionExpiresAt`, but Prisma schema/migration lacked the column. GAP-53 is closed and `AREA_KIOSK.md` is synced.
- Verified with `npx prisma validate`, `npm run db:migrate:check`, focused Vitest coverage for assets, manual events, auth, settings catalogs, allowed emails, shifts, kiosk session expiry, and notification cron, `npx tsc --noEmit`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/items`, `/schedule`, `/kits`, `/settings/categories`, and `/users`.
- Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper now handles this blank schema-engine failure and `npm run build` reaches Next compilation after checking/applying migrations.
- Remaining creation-system work is ranked in `tasks/creation-flow-system-plan.md`; deferred admin/specialized surfaces should be handled as focused slices.

### Wisconsin iOS Home Action Queue (2026-05-12)
- [x] **Plan:** Rework `HomeView` from a passive dashboard stack into an iOS-native action queue using the current dashboard payload.
- [x] **Home implementation:** Keep a compact triage strip, promote overdue/due-today/awaiting-pickup/reservation/shift work, and make each row open the relevant booking, shift, or tab target.
- [x] **Docs:** Update `AREA_MOBILE.md`, `IOS_DEVICE_WALKTHROUGH.md`, `hig-audit-ios.md`, and this task note to match the new Home direction.
- [x] **Verification:** Run `npm run drift:ios`, `npm run audit:ios:gaps`, and `xcodebuild -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`.

**Review**
- Home now starts from a compact triage strip and a `Next Up` action queue instead of passive dashboard cards.
- Action rows prioritize overdue gear, due-today returns, awaiting pickup, upcoming reservations, and upcoming shifts, with direct booking or schedule navigation.
- Removed redundant Home scan/search actions: no awaiting-pickup scan button, no Scan gear queue row, and no bottom search FAB.
- Removed the old Home-only Upcoming Events/My Checkouts/Team Checkouts/Team Reservations dashboard stack; staff/admin exception context now sits below the queue.
- Verified after the follow-up cleanup: `npm run drift:ios` passed; `npm run audit:ios:gaps` passed; exact simulator build command passed with `BUILD SUCCEEDED`.
- Remaining questions are real-device/user-feedback checks: VoiceOver and Dynamic Type behavior on the compact strip, whether the due-today fallback needs richer API payload, and how much staff exception work belongs on Home after field use.

### Wisconsin iOS TestFlight Readiness Reconciliation (2026-05-11)
- [x] **Audit reconciliation:** Rechecked current iOS audit records against source for Home, Bookings, Items, Schedule, Scan, Profile, Notifications, Kiosk, and parity drift.
- [x] **Automated checks:** Ran `npm run drift:ios` and `npm run audit:ios:gaps`; both passed on the current checkout.
- [x] **Simulator build:** Built the `Wisconsin` iOS Simulator target through XcodeBuildMCP and with the exact requested `xcodebuild` command.
- [x] **Docs and QA handoff:** Updated mobile readiness docs and left a TestFlight readiness report with remaining hardware-only QA.

**Review**
- Source-verifiable iOS audit blockers are closed. Remaining unchecked audit entries are explicitly deferred P2 parity/polish items or real-device-only checks.
- Verified: `npm run drift:ios` -> no anti-patterns across 45 Swift files; `npm run audit:ios:gaps` -> 34/34 audit-worthy surfaces covered, no gaps; `xcodebuild -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` -> `BUILD SUCCEEDED`.
- Remaining TestFlight work is real-device QA only: camera/DataScanner, haptics, APNs, VoiceOver, Dynamic Type, Bluetooth HID scanner, and unstable-network behavior.
- Caveat: exact shell `xcodebuild` needed CoreSimulator access outside the sandbox; the first sandboxed attempt failed on simulator service permissions, then the escalated exact command succeeded.

### Status/Data Wiring Ship Fixes (2026-05-10)
- [x] **Item status contract:** Treat `PENDING_PICKUP` as an active item state in server read models, item filters, and web/iOS status presentation.
- [x] **Mutation safety:** Make user deactivation cancel pending-pickup work with the same allocation/session cleanup used for reservations.
- [x] **Route semantics:** Harden booking/search/calendar route filters so explicit statuses are not silently widened or overridden.
- [x] **Docs and verification:** Sync area docs and run focused status, route, TypeScript, and build-safe checks.

**Review**
- Shipped: `PENDING_PICKUP` now appears as `Awaiting pickup` in item read models, filters, web/iOS item UI, event command summaries, and status color helpers.
- Shipped: Future reservations stay future context until their window starts; cancelled/completed/draft bookings stay out of active calendar/search/status surfaces.
- Shipped: Cancelling pending-pickup or open checkouts restores outstanding bulk stock and scanned numbered units, and deactivating owners restores pending-pickup bulk stock while `OPEN` checkout custody still blocks deactivation.
- Verified: focused status and cancellation regressions, booking status/query regressions, TypeScript, build-safe checks, and iOS build attempt documented in the final handoff.

### Bookings Status Ship Fixes (2026-05-10)
- [x] **Active checkouts default:** Make `/bookings?tab=checkouts` show checked-out and pending-pickup work together.
- [x] **Stale reservations:** Add a separate dashboard attention surface for past-due `BOOKED` reservations without changing checkout overdue counts.
- [x] **Docs and verification:** Sync area docs, archive the task record, and run focused checks plus build.

**Review**
- Shipped: Checkouts default now includes `OPEN` and `PENDING_PICKUP`, while explicit status filters still narrow to a single lifecycle state.
- Shipped: Dashboard Team Activity now shows past-due `BOOKED` reservations in a separate Stale reservations card linked to the reservation overdue filter, without changing checkout overdue metrics.
- Verified: focused status Vitest slice, TypeScript, whitespace diff check, migration-prefix check, Next production build, and Chrome DevTools smoke on `/bookings?tab=checkouts` plus dashboard `/`.
- Deferred: Checkout overdue stats remain custody-only; `PENDING_PICKUP` auto-expiry remains GAP-33.

### Items Ownership Pass (2026-05-10)
- [x] **Mixed row hardening:** Prevent bulk SKU rows from flowing into serialized-item selection, favorites, labels, and lifecycle mutations.
- [x] **UX/UI polish:** Tighten Items toolbar, summary, and pagination controls without changing the page architecture.
- [x] **Preference safety:** Make persisted density and column visibility hydration-safe.
- [x] **Docs and verification:** Sync Items docs, archive the task record, and run focused checks plus browser smoke.

**Review**
- Shipped: `/items` now restores density and column visibility after hydration instead of reading localStorage during the initial render.
- Shipped: Item-family rows now open their item detail route but cannot be selected for serialized bulk actions, favorited from the Items list, printed as serialized asset labels, or sent through serialized lifecycle actions.
- Shipped: The Items toolbar and pagination controls now use larger hit areas, cleaner pagination copy, and a bulk-only footer that does not expose an invalid rows-per-page selector.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `npx vitest run tests/asset-action-hardening.test.ts tests/api-hardening-wave12.test.ts`, `git diff --check -- src/app/(app)/items/page.tsx src/app/(app)/items/data-table.tsx src/app/(app)/items/columns.tsx src/app/(app)/items/components/items-toolbar.tsx src/app/(app)/items/components/items-pagination.tsx src/app/(app)/items/hooks/use-bulk-actions.ts docs/AREA_ITEMS.md tasks/todo.md tasks/archive/items-ownership-pass.md`, `npx next build`, and authenticated browser smoke on `/items`, `/items?type=bulk`, and `/items?type=serialized`.

### Schedule Ownership Pass (2026-05-10)
- [x] **Core Schedule:** Tighten summary counts, filters, list/week/calendar controls, and schedule empty states.
- [x] **Assignment flows:** Improve `/schedule/assign` and shared assignment controls for touch targets, labels, and filtered recovery.
- [x] **Connected surfaces:** Align event detail, dashboard Upcoming Events, and schedule-feeding settings with the same schedule semantics.
- [x] **Docs and verification:** Sync Schedule/Events/Settings/Dashboard docs, archive the task record, and run focused checks plus browser smoke.

**Review**
- Shipped: `/schedule` now has a clearer readiness snapshot, larger filter/view controls, stronger list/week/calendar empty states, stable hydrated view preferences, and corrected all-day event creation.
- Shipped: `/schedule/assign` now has larger navigation/filter controls, accessible assignment/remove targets, filtered-empty recovery, no-shift labels, and hydration-stable assignment data.
- Shipped: Event detail, shared shift controls, Dashboard Upcoming Events, and Settings Sports now align with Schedule semantics through away-event wording, stronger crew/travel controls, less duplicate open-slot copy, and shared Switch controls.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `npx vitest run tests/shift-assignments.test.ts tests/shift-trades.test.ts tests/calendar-events-query.test.ts tests/event-defaults.test.ts`, `npx next build`, and authenticated Chrome DevTools smoke on `/`, `/schedule`, `/schedule/assign`, `/events/cmmgnauku006rx10l0rkdv1cp`, and `/settings/sports`.
- Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper now handles this blank schema-engine failure and full `npm run build` passes.

### Kits Ownership Pass (2026-05-10)
- [x] **Structure:** Reframe `/kits` with a current list-page summary, toolbar, and row/card hierarchy.
- [x] **UX/UI:** Make search and filters shareable, add filtered-empty recovery, and replace fake row links with real navigation targets.
- [x] **Hardening:** Count serialized and bulk kit contents together, search descriptions, and expose create-sheet validation.
- [x] **Docs and verification:** Sync Kits docs, archive the task record, and run focused checks plus browser smoke.

**Review**
- Shipped: `/kits` now has summary metrics, URL-backed search/sort/filter state, a stronger toolbar, real detail links, clearer desktop/mobile rows, bulk-aware content counts/status, description search, single-toast create success, and visible New Kit validation.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/app/(app)/kits/page.tsx src/app/(app)/kits/new-kit-sheet.tsx src/app/(app)/kits/hooks/use-kits-query.ts src/lib/services/kits.ts docs/AREA_KITS.md tasks/archive/kits-ownership-pass.md tasks/todo.md`, `npx next build`, and authenticated Chrome DevTools smoke on `http://localhost:3002/kits` across desktop and mobile.
- Deferred: Kit detail add/remove composition polish stays out of this list-page pass.

### Items Hygiene Ownership Pass (2026-05-10)
- [x] **Structure:** Turn `/items/hygiene` into a focused cleanup queue with priority, progress, and view controls.
- [x] **UX/UI:** Improve issue cards, sample rows, clean states, touch targets, and refresh feedback while keeping repair links read-only.
- [x] **Hardening:** Surface partial API failures and make labels align with tag-first item identity.
- [x] **Docs and verification:** Sync item docs, task record, and run focused checks plus browser smoke.

**Review**
- Shipped: `/items/hygiene` now has priority sorting, a cleanup queue summary, checklist progress, needs-work/all/clean views, partial API failure warning state, refresh toast feedback, stronger sample rows, and tag-first API sample labels.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/app/(app)/items/hygiene/page.tsx src/app/api/inventory-hygiene/route.ts docs/AREA_ITEMS.md tasks/archive/items-hygiene-ownership-pass.md tasks/todo.md`, `npx next build`, and authenticated Chrome DevTools smoke on `http://localhost:3002/items/hygiene` across desktop and mobile.
- Deferred: No mutation or auto-fix flow was added; repair still launches existing item, kit, and bulk surfaces.

### Guides Review Fixes (2026-05-10)
- [x] **Full-text guide search** — Make `/guides` search match full guide Markdown or legacy guide text, not only the visible summary.
- [x] **Reader heading IDs** — Keep rendered Markdown heading IDs aligned with table-of-contents IDs when headings contain links, emphasis, or code.
- [x] **Featured rank PATCH semantics** — Preserve or clear `featuredRank` from the final featured state instead of optional PATCH field presence.
- [x] **Docs and verification** — Sync Guides docs and run focused regressions.

**Review**
- Shipped: Landing search now indexes full Markdown/plain guide body text, rendered Markdown headings use visible React text for IDs, and guide PATCH rank updates are derived from the final featured state.
- Verified: `npx vitest run tests/guides-service.test.ts tests/markdown-reader.test.ts tests/guide-content.test.ts tests/guide-ranking.test.ts tests/guide-freshness.test.ts`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check -- src/lib/guides.ts src/lib/guide-content.ts src/components/guides/MarkdownReader.tsx tests/guides-service.test.ts tests/markdown-reader.test.ts tests/guide-content.test.ts docs/AREA_GUIDES.md tasks/todo.md`, and `npx next build`.
- Deferred:

### Dashboard Cleanup Polish (2026-05-10)
- [x] **Banner cleanup:** Fix flagged-items banner token classes and remove the dead `status=flagged` inventory link.
- [x] **Filtered counts:** Make dashboard section counts reflect visible filtered rows while preserving unfiltered totals for overflow links.
- [x] **Transient cards:** Hide Awaiting Pickup when a dashboard filter removes every pending-pickup row.
- [x] **Touch polish:** Keep inline dashboard row actions reachable on touch-sized layouts without reintroducing nested actions.
- [x] **Docs and verification:** Sync Dashboard docs and run focused checks.

**Review**
- Shipped: Fixed the flagged-items banner styling and CTA, filtered header counts, filtered pending-pickup hiding, first-run detection coverage, and touch-visible dashboard row actions.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/app/(app)/page.tsx src/app/(app)/dashboard/my-gear-column.tsx src/app/(app)/dashboard/team-activity-column.tsx src/app/(app)/dashboard/flagged-items-banner.tsx docs/AREA_DASHBOARD.md tasks/todo.md`, `npx next build`, and Chrome smoke on `http://localhost:3001/?sport=MBB` redirecting cleanly to `/login` with no console errors.
- Deferred: Authenticated dashboard visual smoke was not run because the current browser session is unauthenticated; the protected route redirect was verified instead.

### Component Audit Track — 6 Surfaces (2026-05-10)
- [x] **1. Forms** — Inputs, textareas, selects, native selects, labels, invalid states, disabled states, and field sizing.
- [x] **2. Overlays** — Dialog, AlertDialog, Sheet, Drawer, popover/menu padding, backdrop, scroll, and elevation contracts.
- [x] **3. Button/loading/motion** — Button variants, icon buttons, loading spinners, reduced motion, and motion helper defaults.
- [x] **4. Avatar/image identity** — UserAvatar, Avatar, AvatarGroup, AssetImage, thumbnail stacks, and people-vs-gear identity rules.
- [x] **5. EquipmentPicker** — Picker search, availability states, scan-to-add, selected-item summary, and booking edit/create reuse.
- [x] **6. Row/action patterns** — List rows, dashboard rows, table links, inline actions, filter clears, and nested-interactive guardrails.

**Forms review**
- Current repo already had most Bucket 1 findings fixed: input shadow/transition parity, NativeSelect invalid styles, `SelectTrigger size="sm"` adoption, and dead `data-size` removal.
- Closed the live drift by making `SelectTrigger size="sm"` own `text-sm`, aligning `NativeSelect` default type with mobile-safe input sizing, and removing redundant small-select text overrides from Schedule assignment, Settings Sports call-time controls, and User Availability.
- Follow-up candidates remain intentionally outside this slice: re-audit `Label` layout after checking checkbox/inline-label consumers, and migrate high-value forms to the installed `form.tsx` primitive when a specific form is being touched.

**Overlays review**
- Current repo already had the original backdrop and radius drift fixed across Dialog, AlertDialog, Sheet, and Drawer.
- Closed the live interaction drift by aligning Dialog and Drawer close-button hover/focus transition treatment with Sheet.
- Kept Drawer as a separate primitive for the scan item-preview bottom sheet, but added matching elevation so it no longer feels flatter than the rest of the overlay family.
- Parked padding-contract and AlertDialog-composition changes because they have broad call-site implications and should be handled as their own migration.

**Button/loading/motion review**
- Current repo already had the main primitive upgrades from the audit: `Button loading`, app-level `MotionConfig reducedMotion="user"`, dead button attributes removed, dead `icon-lg` removed, motion re-export cleanup, and Schedule assignment icon button labels.
- Closed the remaining live drift by migrating high-value license actions and Settings Database diagnostics to the shared `Button loading` API, preserving their busy copy while adding consistent spinner, busy semantics, and automatic disabled behavior.
- Left refresh-icon spinners and inline autosave indicators alone because they are different interaction patterns, not plain primary-action loading buttons.

**Avatar/image identity review**
- Current repo had already made `AvatarGroup` layout-only, removed the dead raw `Avatar lg` branch, and separated dashboard gear thumbnails from people avatars.
- Closed the live size-ownership drift by moving the full `xs` through `xl` people-avatar scale into `Avatar`, making `UserAvatar` consume that primitive size prop, and sizing `AvatarGroupCount` from the same value.
- Kept `AssetImage` and `ItemThumbnailStack` as separate equipment identity primitives, because square gear thumbnails and compact gear stacks should not inherit circular person-avatar behavior.

**EquipmentPicker review**
- Kept this as a targeted hardening pass instead of reopening the larger item-picker decomposition roadmap.
- Closed scan-to-add drift by rejecting unavailable serialized gear with clear scanner feedback, preserving conflict-warning override behavior for otherwise available items, and capping scanned bulk SKUs at available quantity.
- Added in-place retry for picker search/load errors, empty-state recovery actions for search and available-only filters, corrected search match counts to include bulk rows, and tightened the selected shelf so availability checking and Clear all occupy one stable action area.

**Row/action patterns review**
- Confirmed the dashboard booking row already uses the desired pattern: a primary row button with sibling inline actions.
- Brought booking cards, booking mobile rows, and item mobile rows closer to that pattern by replacing fake `role="button"` containers with real primary open buttons and keeping overflow/checkbox controls as sibling actions.
- Adjusted the desktop booking table row so keyboard open behavior lives on a real button in the primary cell, while the overflow menu remains a separate action target.

**Closeout browser smoke**
- Authenticated as the seeded local admin and smoke-tested the touched surfaces across `/bookings`, `/items`, `/licenses`, `/settings/database`, `/schedule/assign`, `/settings/sports`, a student profile Availability tab, and `/checkouts/new`.
- Mobile viewport smoke confirmed checkout cards expose real `View booking` and `More actions` sibling buttons, and item cards expose real `View item` plus selection sibling buttons with no visible fake `div role="button"` row wrappers.
- License add/bulk/renew overlays opened cleanly, the checkout wizard reached the EquipmentPicker step with search, availability-only, scan, select-visible, and item add controls visible, and `/settings/database` diagnostics no longer emits duplicate React key warnings after the key fix.

### Guides Freshness Closeout (2026-05-10)
- [x] **Schema** — Add nullable guide verification fields and migration.
- [x] **API/service** — Let allowed guide editors mark a guide verified with audit coverage.
- [x] **Reader and landing UI** — Show verified/needs-review state on guide cards and reader headers.
- [x] **Docs and verification** — Sync Guides docs and run focused checks plus build.

**Review**
- Guides now store `lastVerifiedAt` and `lastVerifiedById`, with migration `0061_add_guide_freshness` applied and recorded.
- Allowed editors can mark a guide verified from the reader. The mutation uses the existing guide update permissions, writes a `guide_verified` audit entry, and sends `expectedUpdatedAt` so stale pages cannot verify over newer guide edits.
- `/guides` cards and individual reader headers now show Verified or Needs review state, including who last verified the guide when available.
- Verified with `npx vitest run tests/guide-content.test.ts tests/guide-sanitize.test.ts tests/guide-ranking.test.ts tests/guide-freshness.test.ts`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, authenticated `/guides` and guide-reader HTTP 200 smoke, and authenticated mark-verified API smoke.

### Breadcrumbs First-Class UX Pass (2026-05-10)
- [x] **Audit current breadcrumb system** — Confirm global ownership, route derivation, entity labels, sibling jumps, recents, role filtering, and mobile constraints.
- [x] **Interaction polish** — Make breadcrumb links, dropdown triggers, ellipsis, and current page states feel like deliberate navigation controls with accessible hit targets.
- [x] **Dropdown UX** — Add clearer sibling/recent menu framing, current-location indicators, descriptions where available, and predictable truncation.
- [x] **Verification and docs** — Run focused checks and sync the breadcrumb roadmap docs.

**Review**
- Global breadcrumbs now render as a shell-owned navigation strip with stronger current-page treatment, exact hover/focus/press states, and taller skeletons that match final crumb height.
- Link, dropdown, ellipsis, and current-page crumb targets measured 40px tall on desktop and 44px tall on mobile in browser smoke.
- Settings/Reports sibling menus now have explicit menu labels, preserve role filtering, show current-location checkmarks, and include Settings section descriptions from shared nav metadata.
- Verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/components/PageBreadcrumb.tsx docs/AREA_MOBILE.md docs/AREA_SETTINGS.md tasks/todo.md`, `npx next build`, and browser smoke on `/settings/notifications` at desktop and mobile widths.

### Guides URL Navigation (2026-05-10)
- [x] **URL-backed landing filters** — Make reference, area, category, and search state reload-safe and shareable from `/guides`.
- [x] **Contact directory entry links** — Ensure `/guides?view=contacts` opens the live Contacts directory directly.
- [x] **Docs and verification** — Sync Guides docs and run focused checks.

**Review**
- `/guides` now reads `q`, `category`, `view`, and `area` from query params instead of hiding landing-page state in component-only memory.
- Reference links such as `/guides?view=contacts`, `/guides?view=media-drive`, `/guides?view=server-paths`, and `/guides?view=recent` now restore the correct highlighted card and filtered view after reload.
- Area links such as `/guides?area=video` now open directly into that Creative discipline.
- Verified focused Guides tests, TypeScript, migration-prefix check, whitespace check, `npx next build`, and authenticated HTTP 200 smoke for Contacts, Media Drive, Video area, and category-plus-search URLs.

### Guides Contacts Filters (2026-05-10)
- [x] **Role and area filters** — Add Contacts-directory controls for role and Creative area without changing the Users API.
- [x] **Contact hygiene filters** — Add missing phone and missing Slack views for staff/admin cleanup.
- [x] **Docs and verification** — Sync Guides docs and run focused checks.

**Review**
- `/guides` Contacts now filters active user profiles by role and Creative area without adding another API endpoint.
- Staff/admin users get cleanup filters and count badges for missing phone and missing Slack profile data; student readers only get the normal browsing filters.
- Search still includes contact fields, including Slack handle/profile URL text, and filtered empty states now explain that Contacts filters are active.
- Verified focused Guides tests, TypeScript, Prisma validation, migration-prefix check, whitespace check, `npx next build`, authenticated `/guides` HTTP 200, and authenticated `/api/users` payload shape for Contacts data.

### Guides Slack Profile Links (2026-05-10)
- [x] **Schema** — Add a nullable `slackProfileUrl` user field for reliable Slack profile links.
- [x] **API/Profile wiring** — Return and edit the URL through `/api/users`, `/api/users/[id]`, and `/api/profile` with validation.
- [x] **Guides Contacts UI** — Show `@handle` as text and make it open Slack only when a profile URL exists.
- [x] **Docs and verification** — Sync Users/Guides docs and run focused checks.

**Review**
- Added `User.slackProfileUrl` backed by `users.slack_profile_url`, with Slack-only HTTPS URL validation and null normalization.
- `/api/users`, `/api/users/[id]`, and `/api/profile` now return the profile URL; profile and staff/admin user edits can save it with audit diffs.
- `/guides` Contacts now displays `@handle` as text/search data and only turns the Slack line into a link when `slackProfileUrl` exists.
- Verified focused Guides tests, Prisma validation, migration-prefix check, whitespace check, TypeScript, `npx next build`, Neon HTTP fallback application of migration `0060`, authenticated `/guides` HTTP 200, authenticated `/api/users` payload containing `slackProfileUrl`, and invalid non-Slack profile URL rejection.
- Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper supersedes the one-off migration `0060` fallback and full `npm run build` passes.

### Guides Live Contacts Directory (2026-05-10)
- [x] **Live source** — Use the Users API as the source of truth for guide Contacts instead of duplicating staff/student contact fields in Markdown.
- [x] **Contacts UI** — Show active users with avatar, name, title/year, role, area, location, email, phone, and Slack handle when the Contacts reference view is active.
- [x] **Slack seed** — Add a synced `slackHandle` user profile field so Slack contact info follows the user record.
- [x] **Docs and verification** — Sync Guides docs and prove the Contacts view updates from current user profile data.

**Review**
- `User.slackHandle` is now stored as `users.slack_handle`, normalized to `@handle`, editable through user detail/profile self-edit APIs, and returned by `/api/users`, `/api/users/[id]`, and `/api/profile`.
- `/guides` Contacts now uses active Users API data and shows current email, phone, Slack handle, title/year, area, location, avatar, and profile link.
- Verified focused Guides tests, TypeScript, Prisma validation, migration-prefix check, whitespace check, `npx next build`, Neon HTTP fallback application of migration `0059`, authenticated `/guides` HTTP 200, and authenticated `/api/users` payload containing `slackHandle`.
- Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper supersedes the one-off migration `0059` fallback and full `npm run build` passes.

### Guides Reference Navigation (2026-05-10)
- [x] **Category framing** — Treat Contacts, Building Numbers, Media Drive, and Server Paths as distinct reference categories.
- [x] **Landing navigation** — Split Guides quick cards into area browsing and reference browsing while preserving ranked guide order.
- [x] **Authoring templates** — Add starter templates for Media Drive overview and Building Numbers entries.
- [x] **Verification and docs** — Run focused Guides checks and sync `AREA_GUIDES.md`.

**Review**
- `/guides` now shows separate Browse by area and Reference library sections. Media Drive filters as its own reference category instead of being conflated with Server Paths.
- `/guides/new` now offers Contacts, Building Numbers, Media Drive, Server Paths, SOP, and Troubleshooting starter templates, and the category datalist includes the new reference categories.
- Verified with focused Guides tests, TypeScript, migration-prefix check, whitespace check, production build, authenticated browser smoke on `/guides`, and authenticated route smoke on `/guides/new`.

### Mobile Web Nav Polish (2026-05-10)
- [x] **Bottom nav IA** — Keep the V1 mobile destinations intact while making Scan read as the primary one-tap action.
- [x] **Badges and active states** — Surface urgent checkout counts in the mobile nav and tighten active, hover, focus, and press states.
- [x] **Mobile shell spacing** — Adjust safe-area padding and hit areas so content clears the refined bottom bar.
- [x] **Verification and docs** — Run focused checks and update `AREA_MOBILE.md` with the shipped polish.

**Review**
- `npx tsc --noEmit`, `npm run db:migrate:check`, and `git diff --check` passed.
- `npx next build` compiled successfully, then failed during page-data collection for existing route resolution errors: `/events` and `/guides/[slug]/edit`.
- Dev server browser smoke reached `/login` at mobile width after a cache-bypassing reload. Authenticated app-shell smoke was not completed because signing in with seed credentials would create a real session and login audit event.

### Protected App Console Cleanup (2026-05-09)
- [x] **Production console diagnosis** — Vercel production logs were clean, but unauthenticated `/reports/badges` browser smoke showed three expected-but-noisy 401 resource errors before redirect.
- [x] **Server-side app auth gate** — Move the protected `(app)` layout to `requireAuth()` on the server and redirect unauthenticated users to `/login` before client shell APIs mount.
- [x] **Shell polling guard** — Seed the current-user React Query cache from the server user and only fetch notification/dashboard badge counts after an authenticated user exists.
- [x] **Verification** — Reran TypeScript, focused auth/API tests, full tests, Prisma validation, migration-prefix check, whitespace check, app build, and browser console smoke.

### Student Badge Achievements Slice 1 (2026-05-09)
- [x] **Schema and seed** — Add badge catalog, earned badge, streak tables, user relations, peer-visibility SystemConfig default, and 20 idempotent badge definitions.
- [x] **Service skeleton** — Add a flag-gated badge service API that returns before evaluator work while disabled.
- [x] **Docs and decisions** — Create AREA_BADGES and record the durable launch decisions from v4.
- [x] **Verification** — `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, focused badge test, full `npm test`, `npx tsc --noEmit`, and `npx next build` passed. `npm run db:migrate:status` failed with Prisma's blank Schema engine error against Neon even after read-only network escalation.

### Student Badge Achievements Slice 2 (2026-05-09)
- [x] **Checkout opened events** — Wire kiosk direct checkout and kiosk pickup confirmation to `onCheckoutOpened` after audit success.
- [x] **Checkout returned events** — Emit `onCheckoutReturned` from `markCheckoutCompleted`, partial serialized auto-complete, bulk auto-complete, and kiosk check-in auto-complete.
- [x] **Evaluator logic** — Award checkout count, on-time count, and on-time streak badges with `StudentBadge` idempotency and `BadgeStreak.lastSourceKey` dedupe. On-time counts now use durable `Booking.completedAt` with a legacy `updatedAt` fallback, so later booking edits do not corrupt badge eligibility.
- [x] **Verification** — Focused badge/checkout tests, full `npm test`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. `npm run lint` is blocked by the deprecated interactive `next lint` setup prompt.

### Student Badge Achievements Slice 3 (2026-05-09)
- [x] **Kiosk scan events** — Wire checkout, pickup, and check-in kiosk scan routes to feature-flagged `onScanResult` calls for success and failure outcomes.
- [x] **Scan streaks** — Add a dedicated scan success counter streak type while keeping clean-scan streak resets separate.
- [x] **Legacy contract** — Keep regular app scan stubs kiosk-gated 403 routes that award no badges.
- [x] **Verification** — `npx prisma validate`, `npm run db:migrate:check`, focused badge/scan route tests, full `npm test`, `npx tsc --noEmit`, `git diff --check`, and `npx next build` passed. XcodeBuildMCP could not run an iOS simulator build because this session has no configured project/scheme defaults and this checkout exposes no `.xcodeproj`, `.xcworkspace`, or `Package.swift`.

### Student Badge Achievements Slice 4 (2026-05-09)
- [x] **Badge APIs** — Add active catalog and user badge profile endpoints with self/staff/peer visibility rules.
- [x] **Profile tab** — Add a user-wide `Badges` tab on `/users/{id}` using shadcn primitives, with no badge chrome in the profile hero.
- [x] **Historical display** — Hide inactive definitions from discovery while still showing earned historical inactive awards.
- [x] **Flag-off path** — Badge APIs return disabled/empty payloads before badge table queries while `BADGES_ENABLED` is off.
- [x] **Verification** — `npx prisma validate`, `npm run db:migrate:check`, focused badge API tests, full `npm test`, `npx tsc --noEmit`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/users/{id}?tab=badges` passed.

### Student Badge Achievements Slice 5 (2026-05-09)
- [x] **Trade completion events** — `claimTrade` immediate completion and `approveTrade` now queue trade badge events after the `COMPLETED` transition, awarding both poster and claimer exactly once through badge idempotency.
- [x] **Manual awards** — Admins can award active badges from the existing user admin actions menu with an optional note. The API persists `source=MANUAL`, `awardedById`, and rejects duplicate awards.
- [x] **Award notifications** — Manual awards create persistent inbox notifications that link to `/users/{id}?tab=badges` and respect `notificationPrefs.badges`.
- [x] **Seed fallback** — `prisma/seed.mjs` now uses the Neon adapter when `DATABASE_URL` points at Neon, and `tasks/badge-definitions-neon-seed.sql` is available for badge-only SQL Editor seeding when full `db:seed` is too broad.
- [x] **Verification** — Focused Slice 5 tests, full `npm test`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, `npx tsc --noEmit`, and `npx next build` passed. Browser smoke on `/users/{student}` verified the Admin actions Award badge dialog and Badges tab render cleanly with no console errors; connected Neon currently has 0 badge definitions until the badge-only seed SQL is run.

### Student Badge Achievements Slice 7 Staff Report (2026-05-09)
- [x] **Badge report API** — Added `GET /api/reports/badges` behind existing report permissions with aggregate award metrics, leaderboard, distribution, and recent awards.
- [x] **Report page** — Added `/reports/badges` to the shared Reports tab set after Audit, using existing report primitives and CSV export. It remains staff analytics, not the primary profile badge surface.
- [x] **Badge hardening** — Badge evaluator transactions now use Serializable isolation with one Prisma conflict retry, flag-off service calls perform no badge transaction work, and `captureBadgeError` forwards to Sentry when `SENTRY_DSN` is configured while preserving structured logs.
- [x] **User-wide recognition** — Badge profiles and manual awards now apply to every active user role, including staff and admins, and the catalog includes ten fun manual-recognition badges for clean workflows, clutch coverage, event help, reliability, and above-and-beyond moments.
- [x] **Game-feel polish** — Badge cards show schema-free rarity labels, surprise badges stay hidden until earned, and manual award selection includes admin guidance for fun badges.
- [x] **Verification** — `npm test -- tests/badges-report-route.test.ts`, full `npm test`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome DevTools smoke on `/reports/badges` passed with no console errors.

### Student Badge Achievements Front-End Polish (2026-05-09)
- [x] **Deferred schema cleanup** — Keep the legacy `StudentBadge` model/table name for now and document the later rename as a dedicated migration cleanup, not a UI polish change.
- [x] **Badge medallions** — Replace plain icon wells with a reusable rarity-aware medallion using existing lucide icons and shadcn-compatible styling.
- [x] **Earned details** — Show manual award notes, recent-award "New" state, and visible surprise badge count on the profile badge tab.
- [x] **Motion polish** — Add restrained staggered grid entrance using existing motion primitives.
- [x] **Progress display** — Add real progress counts for supported threshold badges without inventing progress for manual/deferred badges.
- [x] **Reports insight polish** — Make `/reports/badges` more staff-useful with manual award rate, underused definitions, and recent manual recognition details.
- [x] **Verification** — Focused badge tests, full `npm test`, TypeScript, Prisma validation, migration-prefix check, whitespace check, and app build passed. Local browser smoke reached the login wall on `localhost:3000`; authenticated visual smoke remains pending.

### Labels UI Polish (2026-05-09)
- [x] **Print queue framing** — Add header context, matching/selected/ready metrics, and an Items escape link without changing browser-print output.
- [x] **Selector cleanup** — Replace the raw checklist with a searchable queue, selected count badge, accessible checkbox labels, and filtered-empty recovery.
- [x] **Row clarity** — Keep tag-first identity, surface location and scan codes, add selected-state icon rhythm, and provide item-detail links for misqueued gear.
- [x] **Verification** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/labels` passed; smoke caught and fixed nested row/link semantics plus the missing search input `id`/`name`.

### Notifications UI Polish (2026-05-09)
- [x] **Action inbox summary** — Add unread, read, and total metrics above the notification list.
- [x] **Toolbar and role cleanup** — Add explicit refresh, keep URL-backed unread filtering, and show overdue processing only to STAFF/ADMIN users.
- [x] **Row clarity** — Add notification type badges, clearer unread/read state, named destination actions, and stronger hover/focus rhythm without changing delivery or API contracts.
- [x] **Verification** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke passed; smoke caught and fixed reservation notifications falling back to checkout links when `bookingKind` was absent.

### Settings Control Map Polish (2026-05-09)
- [x] **Overview nav state** — Add `/settings` as an active Overview entry in the shared Settings nav.
- [x] **Role-aware map polish** — Surface current role, visible section counts, group counts, and destination role badges on the Settings control map.
- [x] **Interaction polish** — Tighten group card headers, link row hover/focus treatment, and tabular count badges without changing settings permissions or subpage behavior.
- [x] **Verification** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/settings` plus `/settings/departments` passed.

### Reports UI Polish Slice 1 (2026-05-09)
- [x] **Shared Reports shell** — Add shared toolbar, metric-grid, section-card, and loading patterns for Reports.
- [x] **Six-page migration** — Apply the shared rhythm to Utilization, Checkouts, Overdue, Scans, Missing Units, and Audit without changing data contracts.
- [x] **Verification + browser smoke** — TypeScript, migration-prefix, whitespace, and app build gates pass; authenticated Chrome DevTools smoke rendered Utilization, Checkouts, Overdue, Missing Units, Scans, and Audit with the seeded admin session.

### Reports Chart Runtime Cleanup (2026-05-09)
- [x] **Recharts sizing guard** — Add stable responsive-container sizing in the shared shadcn chart wrapper after authenticated browser smoke exposed an initial width/height warning.
- [x] **Verification** — Reloaded Utilization in Chrome DevTools and confirmed no console warnings after the chart wrapper fix.

### Reports Chart Polish Slice 2 (2026-05-09)
- [x] **Chart-card consistency** — Move report chart components onto the shared report chart-card wrapper.
- [x] **Shared chart palette** — Replace per-file color arrays with one Reports palette and tighten numeric chart legends.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Filter Polish Slice 3 (2026-05-09)
- [x] **Shared segmented controls** — Add a Reports segmented-control helper using shadcn ToggleGroup.
- [x] **Filter migration** — Replace hand-rolled period and phase button loops on Checkouts, Scans, and Audit reports without changing URL behavior.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports State Polish Slice 4 (2026-05-09)
- [x] **Shared states** — Add report-level error, empty, and pagination helpers.
- [x] **Page migration** — Utilization, Checkouts, Overdue, Scans, Missing Units, and Audit now share retry/error handling where applicable.
- [x] **Empty copy** — Report empty states explain what data would populate the section instead of stopping at terse labels.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Row Polish Slice 5 (2026-05-09)
- [x] **Shared row primitives** — Add report-level table-link, mobile-card, mobile-card-link, and compact-list-row helpers.
- [x] **List migration** — Checkouts, Scans, Utilization, Missing Units, and Overdue use the shared row rhythm where applicable.
- [x] **Disclosure polish** — Overdue expandable rows use lucide chevrons while preserving click and keyboard expansion.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Export Polish Slice 6 (2026-05-09)
- [x] **Shared export action** — Add a report-level CSV export button with a download icon.
- [x] **CSV helper** — Centralize browser CSV download and escaping for report exports.
- [x] **Page migration** — Utilization, Checkouts, Overdue, Scans, and Audit now use the shared export helper.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Loading Cleanup Slice 7 (2026-05-09)
- [x] **Shared chart loading** — Add a report-level chart loading helper for dynamic chart imports.
- [x] **Placeholder migration** — Utilization and Checkouts chart fallbacks now use the shared loading helper.
- [x] **Row adoption cleanup** — Checkouts requester mobile rows now use the shared report list row.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Overdue Presentation Slice 8 (2026-05-09)
- [x] **Shared nested links** — Let `ReportTableLink` accept click handlers and use it for expanded Overdue mobile booking links.
- [x] **Color cleanup** — Replace Overdue inline red text styles with report-compatible utility classes.
- [x] **Behavior preservation** — Keep row expansion and booking navigation separate.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Metadata Line Slice 9 (2026-05-09)
- [x] **Shared metadata helper** — Add a report-level metadata line for compact row details.
- [x] **Checkout row migration** — Replace raw separator strings in mobile checkout rows.
- [x] **Overdue row migration** — Replace raw separator strings in expanded overdue booking rows.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Scan Route Gate Contract Slice (2026-05-08)
- [x] **Stale scan-rate-limit correction** — Verify the regular app checkout/check-in scan endpoints are kiosk-gated 403 stubs, so the old per-session rate-limit TODO no longer describes an active execution path.
- [x] **Verification + docs** — Add a regression contract, sync scan docs and the task registry, then rerun the safe verification gates.

### Public Endpoint Abuse Contract Testing Slice (2026-05-08)
- [x] **Public abuse-control inventory** — Add a static regression that every intentionally public unauthenticated API route is either rate-limited by client IP or explicitly disabled behind the seed endpoint gate.
- [x] **Verification + docs** — Run focused contract tests plus the safe verification gates and document the coverage.

### High-Impact Regression Testing Slice (2026-05-08)
- [x] **RBAC route contract matrix** — Add a static regression that verifies every route-level `requirePermission()` call references a defined permission.
- [x] **Booking lifecycle route contracts** — Add focused route tests for required optimistic locking, stale edit rejection, and checkout/reservation update dispatch.
- [x] **Verification + docs** — Run focused tests, TypeScript, migration-prefix, whitespace, and build checks; sync docs with coverage benefits.

### API Wrapper Contract Testing Slice (2026-05-08)
- [x] **Route wrapper inventory** — Add a static regression that every exported API HTTP method is wrapped by `withAuth`, `withKiosk`, `withHandler`, or `withCron`, including shared handler aliases.
- [x] **Verification + docs** — Run focused contract tests plus the safe verification gates and document the coverage.

### API Hardening Wave 13 (2026-05-08)
- [x] **Booking/check-in hardening** — Verify booking search indexes, tighten conflict expectations, add damage-report dedup, and reduce orphan-photo risk.
- [x] **Kiosk/user/calendar/report bounds** — Add rate limits, cursor validation, result caps, and list caps across remaining hot read/write routes.
- [x] **Shift/catalog/license/upload bounds** — Add Serializable isolation, rate limits, filename sanitization, and bounded histories.
- [x] **Regression coverage + docs** — Add focused tests, close audit bullets, sync area docs, and run safe checks.

### API Hardening Wave 12 (2026-05-08)
- [x] **Import conflict feedback** — Stop silently masking asset tag or scan-code conflicts during asset import.
- [x] **Asset/bulk route bounds** — Add rate limits, limit caps, timeout guards, and transaction isolation where missing.
- [x] **Bulk list/activity hardening** — Verify list balance loading is already batched and scope activity cursors to their SKU.
- [x] **Regression coverage + docs** — Add focused tests, close audit bullets, sync area docs, and run safe checks.

### API Hardening Wave 11 (2026-05-08)
- [x] **Admin reset-password containment** — Stop returning reusable temp-password state without a forced-change marker.
- [x] **Bulk inventory mutation bounds** — Add upper quantity bounds and verify numbered-unit status updates are already transactional.
- [x] **Reservation race guards** — Confirm convert re-checks status inside `createBooking` and block duplicate from terminal reservations after reload.
- [x] **Report/audit/kiosk request bounds** — Cap report lookback, bound audit-log cursors to the booking, and harden kiosk enumeration/activation rate limits.
- [x] **Shift regenerate auditability** — Correct stale finding: regenerate adds missing shifts only, skips manual groups, and already audits added count.
- [x] **Regression coverage + docs** — Add focused tests, close the audit bullets, sync area docs, and run safe checks.

### API Hardening Wave 10 (2026-05-08)
- [x] **Shift ICS public feed bounds** — Reject malformed tokens, rate-limit by IP and token, serve only active-user feeds, and cap assignment reads to a 500-row rolling calendar window.
- [x] **Calendar source sync lease** — Add database-backed per-source sync lease fields and guard manual sync plus post-sync shift generation from concurrent execution.
- [x] **Asset lifecycle/favorite hardening** — Move retire read/update/audit into one SERIALIZABLE transaction and add explicit `asset.favorite` permission plus asset existence validation.
- [x] **Regression coverage** — Add focused tests for ICS feed hardening, sync lease behavior, asset action hardening, and `asset.favorite` RBAC.
- [x] **Verification + docs** — Sync area docs/audit registry and run safe checks.

### API Hardening Wave 9 (2026-05-08)
- [x] **Allowed-email enumeration guard** — Return generic skip success for already-registered or already-allowlisted emails instead of revealing membership via 409 or skipped email lists.
- [x] **Allowed-email regression coverage** — Update route tests for generic skip behavior.
- [x] **Verification + docs** — Sync users/settings docs and run safe checks.

### API Hardening Wave 8 (2026-05-08)
- [x] **License CSV injection guard** — Add shared CSV escaping that neutralizes formula-like values and apply it to license and user exports.
- [x] **CSV helper regression coverage** — Cover formula prefixes plus quoting for commas, quotes, and newlines.
- [x] **Verification + docs** — Sync license hardening docs and run safe checks.

### API Hardening Wave 7 (2026-05-08)
- [x] **Guide content sanitization** — Sanitize guide BlockNote JSON recursively before create/update storage.
- [x] **Guide sanitizer regression coverage** — Cover scriptable string stripping and prototype-pollution key removal.
- [x] **Verification + docs** — Sync guide hardening docs and run safe checks.

### API Hardening Wave 6 (2026-05-08)
- [x] **Cron auth wrapper** — Extract shared `withCron()` bearer-token validation and migrate all cron routes to it.
- [x] **Cron auth regression coverage** — Cover missing secret, bad token, and accepted token behavior.
- [x] **Verification + docs** — Sync cron hardening docs and run safe checks.

### API Hardening Wave 5 (2026-05-08)
- [x] **Nudge spam scope** — Add active-assignment validation plus per-actor hourly, per-assignment, and per-recipient nudge rate limits.
- [x] **Nudge regression coverage** — Cover student denial, inactive assignment rejection, and layered rate-limit calls.
- [x] **Verification + docs** — Sync notification hardening docs and run safe checks.

### API Hardening Wave 4 (2026-05-08)
- [x] **Calendar travel roster scope** — Rejected the read-access finding: students are allowed to see staffing/travel roster context for all events; route now only verifies the event exists before listing.
- [x] **Calendar travel mutation guard coverage** — Add regressions proving STUDENT cannot add or remove event travel members.
- [x] **Verification + docs** — Sync hardening docs and run safe checks.

### API Hardening Wave 3 (2026-05-08)
- [x] **User export PII scope** — Redact staff/admin athletics email and phone fields from STAFF exports while preserving ADMIN full export and student operational contact rows.
- [x] **Org chart hierarchy scope** — Restrict org chart API and nav entry to STAFF/ADMIN so STUDENT callers cannot read direct-report chains.
- [x] **Form-options directory scope** — Stop returning email and limit STUDENT callers to their own user option instead of the full active-user directory.
- [x] **Verification + docs** — Add focused regression coverage, sync docs, and run safe checks.

### API Hardening Wave 2 (2026-05-08)
- [x] **Dashboard read resilience** — Convert dashboard, dashboard-stats, inventory hygiene, and items-page-init query bundles to partial-failure handling.
- [x] **Mutation audit coverage** — Add audit entries for shift attendance, event creation, event visibility, and force-delete metadata.
- [x] **Verification + docs** — Add focused coverage where useful, sync docs, and run safe checks.

### API Hardening Wave 1 (2026-05-08)
- [x] **Profile password sessions** — Make self-service password changes update the hash and invalidate existing sessions atomically.
- [x] **Reset token consumption** — Consume reset tokens inside the transaction so a concurrent request cannot reuse the same token window.
- [x] **Seed route hard gate** — Disable `/api/seed` unless explicitly enabled, and keep production/admin gating as a second layer.
- [x] **Shift permission contract** — Add the missing `shift.manage` permission used by shift group and travel mutation routes.
- [x] **Verification + docs** — Add focused tests, sync hardening docs, and run safe checks.

### Next.js May 2026 Security Patch (2026-05-08)
- [x] **Patch dependency floor** — Updated Next.js to `15.5.16` and aligned React packages to `19.2.6`.
- [x] **Verify runtime dependency tree** — Confirmed installed `next@15.5.16`, `react@19.2.6`, and `react-dom@19.2.6` after lockfile refresh.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and `npm audit --omit=dev` completed; audit still reports Next's nested PostCSS advisory until upstream Next updates that dependency.

### Items List Context Menu (2026-05-07)
- [x] **Row context menu** — Add right-click actions for open, open in new tab, select/deselect, copy tag, favorite, print label, duplicate, maintenance, and retire.
- [x] **Bulk row guardrails** — Keep bulk inventory rows on safe navigation/copy/selection actions and remove serialized-only mutations from the existing kebab menu.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. `AREA_ITEMS.md` synced.

### Damage Report Photos + Avatar Polish (2026-05-07)
- [x] **Report photo evidence** — Add optional photo evidence to damaged/lost check-in reports without restoring scrubbed checkout/check-in condition-photo gates.
- [x] **User photo polish** — Resize profile avatars before upload and surface an admin roster cue for users missing profile photos.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and checkout/scan/users docs synced.

### Active Backlog Index (2026-05-06)
- [x] **Next recommended slice: Admin Fix Today queue** — Shipped `/admin/fix-today` as an admin-only read queue for overdue gear, pending pickup handoffs, offline kiosks, flagged maintenance items, low batteries, calendar sync failures, and license expirations.
- [x] **Battery follow-through** — Shipped the explicit kiosk battery scan step: typed numbered-battery rows and scan-summary counts in checkout detail, plus dedicated iOS pickup/return battery progress cards.
- [ ] **Admin helpers** — Work through Admin Helper Backlog in this order: Fix Today queue, Kiosk admin cockpit, People offboarding assistant, Inventory hygiene center, Admin exception review, Renewal and expiry calendar, Morning digest.
- [ ] **Ops V2/V3 deferred work** — Keep deeper battery reporting, inventory health, attachment slot schema, and templates/presets behind slice plans.
- [ ] **Low-priority systemic gaps** — Keep SystemConfig UI and scan endpoint rate limiting visible but behind daily-ops work.

### Avatar + shadcn Cleanup (2026-05-07)
- [x] **Shared people avatar groups** — Added `UserAvatarGroup` and migrated schedule/dashboard assignment previews to one tooltip/overflow pattern.
- [x] **Shared gear thumbnail stacks** — Added `ItemThumbnailStack` and migrated dashboard/bookings gear previews away from person-avatar primitives.
- [x] **Control cleanup** — Moved booking filter clear actions and event staffing icon/request controls onto shadcn `Button`/`Badge` variants.
- [x] **Verification + browser smoke** — `npx tsc --noEmit`, focused checkout tests, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and browser smoke on bookings, dashboard, schedule, and event detail passed.

### Booking Creation Ownership Pass (2026-05-07)
- [x] **Event picker window** — Checkout and reservation creation now fetch and label the documented next-30-days event window instead of a 3-day slice.
- [x] **Draft multi-event persistence** — `/api/drafts` now accepts ordered `eventIds[]`, writes `BookingEvent` draft links, rejects mixed `eventId`/`eventIds`, and returns ordered `events[]` for resume.
- [x] **Draft resume wiring** — Resumed drafts restore `selectedEvents` in the shared booking wizard so event-linked interrupted work does not collapse to ad hoc creation.
- [x] **Item-list shadcn alignment** — Creation now uses the Items list/header/form standard with shared `PageHeader`, shadcn switch/button/badge primitives, quiet bordered surfaces, item-style form rows, and browser-clean labels.
- [x] **Item picker flow** — `EquipmentPicker` now hydrates deep-linked/draft-selected assets, uses shadcn item-list composition, restores scan-to-add in Step 2, adds select-visible/clear-section controls, and lets valid selections review immediately.
- [x] **Item picker hardening** — Availability preview now checks visible plus selected assets, section searches persist, conflict-warning rows stay selectable, and booking detail edit excludes its own booking from picker conflict checks.
- [x] **Stale selection recovery** — Unresolved deep-linked or draft asset IDs render as removable unavailable rows and no longer count toward review, confirmation, draft, or create payloads.
- [x] **Verification + docs** — `npx tsc --noEmit`, focused Vitest coverage, `npm run db:migrate:check`, `git diff --check`, `npx next build`, local HTTP route checks, Arc smoke on `/checkouts/new` and `/reservations/new`, and checkout/reservation area docs synced.

### Page Ownership Skill (2026-05-06)
- [x] **Create execution skill**: Add a `page-ownership-pass` skill for full-page and page-slice UX/UI/consistency/hardening work.
- [x] **Keep audit boundary clean**: Cross-reference `audit-page-web` so readiness audits remain diagnostic while ownership passes can implement.
- [x] **Verify skill shape**: Check markdown/frontmatter, trigger language, and source-control diff before calling it done.

### Dashboard Upcoming Events Parity (2026-05-06)
- [x] **Plan + audit** — Compare Schedule event rows with the dashboard quick view and keep scope read-only.
- [x] **API/type parity** — Add staffing coverage metadata to dashboard event summaries without changing event behavior.
- [x] **Dashboard quick view UI** — Render schedule-style event identity, home/away, location/time, assignment preview, and coverage signals; remove quick-create controls.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. `AREA_DASHBOARD.md` and `AREA_EVENTS.md` synced.

### Item Detail Tabs Final Polish (2026-05-06)
- [x] **Schedule agenda clarity** — Add a month agenda layer and reduce calendar chrome that does not help operators act.
- [x] **Schedule cancellation correctness** — Keep cancelled bookings out of the calendar grid and month agenda while preserving them in history surfaces.
- [x] **Schedule bar continuity** — Render month-grid bookings as continuous week-spanning bars instead of split per-day pills.
- [x] **Quick context cleanup** — Remove cancelled bookings from Past Bookings quick context and keep QR details owned by the QR preview.
- [x] **Booking preview sheet alignment** — Keep calendar clicks in an in-place preview, but align the sheet header, sections, footer, and action language with the current UI.
- [x] **Booking preview identity polish** — Add requester and creator avatars so the preview reads as human activity, not only metadata rows.
- [x] **Insights metric confidence** — Make age human-readable and stop overstating return-timing accuracy.
- [x] **Attachments empty state** — Fix empty-state rule language so unattached items do not imply they travel with a parent.
- [x] **Verification + docs** — Run focused checks, live tab checks, and sync `AREA_ITEMS.md`.

### Item Detail Tabs Follow-up (2026-05-06)
- [x] **Schedule correctness** — Stop rendering the same long booking title on every overlapping calendar day.
- [x] **Past Bookings context** — Wire requester avatar photos through the item detail API and reduce row text density.
- [x] **History polish + backend** — Improve the history surface UX and make older activity pagination usable.
- [x] **Verification + docs** — Run focused checks, live route checks, and sync `AREA_ITEMS.md`.

### Item Detail Tab Direction Pass (2026-05-06)
- [x] **Tab ownership cleanup** — Remove redundant Bookings tab, rename Calendar to Schedule, and keep tab labels/counts focused.
- [x] **Info booking context** — Add a quick Past Bookings surface below upcoming reservations for operational context.
- [x] **Secondary tab direction** — Make History the full touch log, keep Insights lightweight, and strengthen Attachments/Settings structure.
- [x] **Verification + docs** — Run focused checks and sync `AREA_ITEMS.md`.

### Item Detail Data Form Hardening (2026-05-06)
- [x] **Shared form guardrails** — Harden inline text, select, date, notes, and QR edit flows against double-submit, stale saving state, and weak disabled states.
- [x] **PATCH normalization** — Align asset PATCH validation with the detail form by trimming inputs, allowing nullable clearable fields, and preserving DB-required fields.
- [x] **Form surface polish** — Normalize select/category/date control framing, use gray picker surfaces, convert fiscal year to a year selector, use the shared badge treatment for admin scan identity, and top-align textarea rows.
- [x] **Local save unblock** — Fix shared API CSRF origin comparison so same-origin localhost PATCH requests are not rejected as cross-origin, while bad origins still return 403.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail UX/UI Cleanup Slice 4 (2026-05-06)
- [x] **Scan identity density** — Make the admin scan identity panel use space better while keeping QR, serial, and scan actions obvious.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail UX/UI Cleanup Slice 3 (2026-05-06)
- [x] **Header button layout** — Make the item action cluster read as primary workflow first, secondary item actions second, and utilities last.
- [x] **Freshness row cleanup** — Removed the blocking refresh tooltip and baked date/time into the visible Updated line.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail UX/UI Cleanup Slice 2 (2026-05-06)
- [x] **Header identity cleanup** — Drop serial number from the header, make the product subline smarter, and add clearer separators for location/category/department.
- [x] **Action flow cleanup** — Reduce competing header buttons and make secondary creation actions feel secondary.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail UX/UI Cleanup Slice 1 (2026-05-06)
- [x] **Overview hierarchy** — Make the default detail view lead with operational state and keep item metadata as the secondary facts column.
- [x] **Header simplification** — Reduce decorative weight, clarify derived status, and make action availability explicit.
- [x] **Tracking identity placement** — Move QR/scan identity into the item facts card instead of a detached admin-only sidebar.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail Missing Server Chunk Runtime Fix (2026-05-06)
- [x] **Runtime diagnosis** — Confirmed `Cannot find module './1893.js'` was stale/inconsistent `.next` output, not a current source/build problem.
- [x] **Narrow fix** — Regenerated the Next server bundle with `npx next build`; the rebuilt runtime loads chunk `1893` through `.next/server/chunks/1893.js`.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `npx next build`, `git diff --check`, and a local production `curl -I /items/test-runtime-chunk` check passed.

### Home Dashboard Focused Pass (2026-05-05)
- [x] **Audit current dashboard surface** — Read area docs, decisions, gaps, schema, API routes, existing audits, and dashboard components before editing.
- [x] **Framework/debug pass** — Removed stale `/api/reservations/[id]/extend` branch; dashboard extend now uses canonical `/api/bookings/[id]/extend`.
- [x] **Structure pass** — Extracted shared `DashboardBookingRow` for My Gear and Team Activity booking rows.
- [x] **UX/UI pass** — Split row navigation from inline action buttons, made filter clear a separate icon button, and tightened row truncation/mobile behavior.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed. Follow-up 2026-05-12: full `npm run build` now passes through the shared Prisma/Neon migration wrapper.

### Home Dashboard Follow-up Pass (2026-05-05)
- [x] **Overdue banner controls** — Split overdue row navigation from check-in and nudge actions.
- [x] **Saved filter controls** — Split saved preset apply and delete into sibling controls.
- [x] **Browser verification** — Production server rendered `/login` cleanly. Protected dashboard visual inspection is blocked without an authenticated session cookie.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `npx next build`, and `git diff --check` passed.

### Home Dashboard Console Polish (2026-05-05)
- [x] **Metric strip polish** — Reduced stat-card visual weight and moved labels above numbers for faster scanning.
- [x] **Section header standardization** — Added shared `DashboardSectionHeader` for dashboard cards with consistent count and affordance treatment.
- [x] **Verification** — `npx tsc --noEmit`, `npm run db:migrate:check`, `npx next build`, and `git diff --check` passed.

### Home Dashboard Live Browser Polish (2026-05-05)
- [x] **Local login unblock** — Added gitignored local session env, reset the approved dev admin seed, and fixed dev CSP/service-worker behavior so the login form hydrates instead of falling back to `GET /login?`.
- [x] **Dev-console cleanup** — Fixed the `dashboard-stats` cache reader by providing a query function, clearing the remaining TanStack Query warning in the live browser.
- [x] **Interaction polish** — Replaced broad `transition-all` on shared buttons/toggles with explicit transition properties plus `active:scale-[0.96]`, and added focus-visible treatment to dashboard stat/row links.
- [x] **Responsive header polish** — Let the Upcoming Events header place its Home/Away filter on a second line so the title stays readable in narrow dashboard columns.

### Sidebar Polish Pass (2026-05-05)
- [x] **Navigation hierarchy** — Removed permanent trailing item index numbers from sidebar nav rows; they added visual load without a shipped shortcut layer.
- [x] **Interaction polish** — Replaced sidebar `transition-all` usage with explicit transition properties and added `active:scale-[0.96]` to nav buttons and quick-create actions.
- [x] **Collapsed-state check** — Verified icon-only sidebar mode in the live browser after the nav cleanup.
- [x] **Shell upgrade pass** — Strengthen section separation and normalize utility action feedback.

### Schedule Page Focused Pass (2026-05-05)
- [x] **Audit current schedule surface** — Read North Star, shift/events/mobile docs, decisions, gaps, student availability brief, current schedule components, and live dev behavior before editing.
- [x] **Framework/debug pass** — Cleared live console issues, hardened New Event sheet failure paths, fixed empty Select values, and kept legacy HTTPS thumbnails compatible with CSP.
- [x] **UX/UI pass** — Tightened schedule toolbar interaction feedback, removed row-as-link semantics from the desktop list, and added rapid-click guards to inline assignment/trade actions.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npx vitest run tests/query-client.test.ts`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and live Arc schedule/New Event checks passed.

### Schedule Command Bar + Coverage Pass (2026-05-05)
- [x] **Command bar hierarchy** — Promote view, venue, coverage, and secondary filters into clearer groups so the staff-critical coverage filter is not buried.
- [x] **Coverage-first list treatment** — Make under-covered events easier to scan with gap counts, stronger coverage copy, and subtle row emphasis.
- [x] **Verification + docs** — Run focused TypeScript/whitespace checks, verify `/schedule` live in Arc, and sync shift docs.

### Schedule Readiness Polish Pass (2026-05-05)
- [x] **Operational snapshot** — Add compact readiness metrics so staff can see events, open slots, my shifts, and trade-board state without scanning rows.
- [x] **Surface polish** — Tighten the schedule surface so filters, metrics, and list read as one workflow rather than separate controls.
- [x] **Verification + docs** — Run focused checks, verify `/schedule` live in Arc, and sync shift docs.

### Schedule Inline Assignment Matrix Pass (2026-05-05)
- [x] **Expanded event matrix** — Replace repeated expanded shift rows with an event-level slot matrix that groups staffing work into scannable assignment tiles.
- [x] **Inline actions** — Preserve staff assignment from open slots and student post-for-trade actions without nesting interactive controls in clickable rows.
- [x] **Verification + docs** — Run focused checks, verify `/schedule` live in Arc, and sync shift docs.

### Schedule Collapsed Staffing Preview Pass (2026-05-05)
- [x] **Collapsed avatar group** — Add a shadcn-style avatar group to collapsed event rows so fully staffed events read at a glance.
- [x] **Expanded row detail** — Replace large expanded slot cards with polished dense rows that preserve assignment and trade actions.
- [x] **Verification + docs** — `npx tsc --noEmit`, `git diff --check`, and live Arc `/schedule` checks passed, including the expanded assign-slot popover.

### Schedule Role Language Polish (2026-05-05)
- [x] **Role-aware needs** — Replace raw `ST`/`FT` labels with readable staff/student slot language and grouped open-need summaries.
- [x] **Travel event cleanup** — Remove away/neutral call-time placeholders from collapsed and expanded schedule rows.
- [x] **Verification + docs** — `npx tsc --noEmit`, `git diff --check`, and live Arc `/schedule` checks passed, including the expanded assign-slot popover.

### Cross-Page DevTools Cleanup (2026-05-06)
- [x] **Filter chip HTML validity** — Split active filter clear controls into sibling buttons so booking/status filters no longer render nested buttons.
- [x] **Manifest icon cleanup** — Pointed app manifest metadata at the existing 192/512 SVG icons instead of declaring the 72px Badgers logo as any-size.
- [x] **Search field identifiers** — Added stable `id`/`name` attributes to the visible search fields flagged by Chrome DevTools.
- [x] **Dashboard/schedule copy cleanup** — Fixed dashboard event title spacing/home-away language and removed zero-duration call ranges from schedule rows.
- [x] **Verification + docs** — `npx tsc --noEmit`, `git diff --check`, and Chrome DevTools MCP smoke checks passed on dashboard, schedule, bookings, items, users, and guides.

### Items Page Hardening Pass (2026-05-06)
- [x] **Audit current items surface** — Read item docs, decisions, gaps, schema, existing item audits, and current list/detail files before editing.
- [x] **Async action resilience** — Make item export, duplicate, maintenance, and retire handlers always release busy state, including auth redirects and unexpected failures.
- [x] **Filter/list correctness** — Keep selection and empty states aligned with item type, favorites, attachment filters, sorting, and mixed serialized/bulk result sets.
- [x] **Export filter parity** — Keep CSV export aligned with the visible list filters where the export route supports them.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. AREA_ITEMS.md synced.

### Items Page UX/UI Polish Pass (2026-05-06)
- [x] **Command bar hierarchy** — Restructure search, view filters, advanced filters, favorites, clear actions, and header action sizing so the toolbar reads as one workflow.
- [x] **Operational telemetry** — Rework the status summary strip so it scans like inventory health instead of a second toolbar.
- [x] **Row hierarchy** — Improve desktop rows and mobile cards so tag identity, product metadata, status, location, and category have clearer priority.
- [x] **Verification + docs** — `npx tsc --noEmit` and `git diff --check` passed. AREA_ITEMS.md synced.

### Items Compact + Fill Gaps Upgrade (2026-05-06)
- [x] **Compact table mode** — Make compact mode read like a plain shadcn data table by removing row thumbnails and tightening row rhythm.
- [x] **Fill gaps queue** — Make the gap wizard more resilient with batch prefetch, retryable failures, smarter same-category suggestions, explicit no-photo handling, skipped-item review, and mixed serialized/bulk gap cleanup.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, Chrome for Testing Fill gaps layout checks, and a read-only Prisma data check for legacy bulk category-name department hints passed. AREA_ITEMS.md and AREA_BULK_INVENTORY.md synced.

### Cheqroom Import QR Repair (2026-05-06)
- [x] **Importer QR precedence** — Use Cheqroom `Codes` as the primary QR/scan value before `Barcodes`, and preserve both source values for traceability.
- [x] **Re-import repair path** — Let upserts repair existing QR/primary scan values when there is no unique-owner conflict.
- [x] **Current data repair** — Applied a guarded repair from the 2026-05-06 Cheqroom export: created 2 missing assets, repaired 20 QR values, repaired 23 primary scan values, refreshed duplicate-name rows by source/tracking match, and cross-checked all 43 CSV rows cleanly.
- [x] **Verification + docs** — `npx tsc --noEmit`, `node --check scripts/import-cheqroom-items.mjs`, `npm run db:migrate:check`, `git diff --check`, and source-aware Prisma cross-check passed. AREA_IMPORTER.md and GAPS_AND_RISKS.md synced.

### Item Detail Hardening + Polish Pass (2026-05-06)
- [x] **Header resilience** — Wire the detail action busy state into header controls, guard optimistic favorites against rapid repeats, and replace failed-photo blanks with the standard no-photo fallback.
- [x] **Bookings/calendar polish** — Use the shadcn toggle-group pattern for booking filters and add a mobile calendar list so the tab is useful below desktop width.
- [x] **Async cleanup** — Cancel stale insights, activity, and attachment-search fetches; preserve 401 redirect handling; and make category/QR save flows always release saving state.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. AREA_ITEMS.md synced.

### Camera Attachments (2026-05-05)
- [x] **Attachment model implementation** — Treat camera-tied SD cards/cages/fixed parts as non-bookable item attachments and preserve QR-coded batteries as numbered bulk units. Verified with focused tests, TypeScript, migration-prefix check, and local Next build.

### Derived Bulk Unit QR Scans (2026-05-05)
- [x] **Numbered unit QR scan path** — Let QR values like `94e068d1-7` resolve to the parent numbered bulk SKU and unit #7 without opening the picker. Verified with focused tests, TypeScript, migration-prefix check, local Next build, and whitespace check.

### Bulk Battery Hardening (2026-05-05)
- [x] **Kiosk-scanned numbered batteries** — Treat battery booking as quantity at creation, then bind/return specific numbered units through kiosk unit QR scans. Add low-availability camera-model battery warnings at creation. Verified with focused tests, TypeScript, migration-prefix check, local Next build, and whitespace check.
- [x] **Kiosk battery client and labels** — Include batteries in iOS kiosk pickup/return checklists, block pickup confirm until planned units are scanned, align compatibility rules to the current import snapshot, and improve Brother P-Touch unit labels. Verified with focused tests, TypeScript, migration-prefix check, local Next build, iOS simulator build, and whitespace check.
- [x] **Battery Unit Cockpit** — Added `/bulk-inventory/batteries` plus an Admin nav entry for active unit-tracked battery families, unit status counts, low-stock signals, checked-out aging, booking/requester context, and audited unit status actions.
- [x] **Kiosk battery mismatch polish** — Kiosk pickup/return now distinguishes wrong battery type, duplicate scans, units checked out elsewhere, units not checked out on the booking, and lost/retired units.
- [x] **Battery compatibility lows** — Battery Ops now flags low compatible battery families by matching active camera inventory against existing battery compatibility rules.
- [ ] **Kiosk explicit battery scan step** — Make pickup clearly call out required battery unit scans before confirm, while preserving current unit-binding behavior.
- [ ] **Kiosk admin override visibility** — Preserve admin override, but make battery-related override use visible and audit-friendly in the pickup flow.
- [ ] **Booking-create battery guidance polish** — Make compatible battery warnings feel like actionable guidance instead of generic alerts, without requiring unit selection before pickup.
- [ ] **Booking-create optional gear suggestions** — Suggest compatible support gear such as batteries, media, readers, and cages from selected camera context.
- [x] **Attachment management polish** — Improved camera attachment add, detach, and move-parent flows while keeping slot identity display-only for now. Shipped a structured candidate dialog, status warnings, clearer detach copy, parent count hover text, and hidden-attachment filter copy.
- [x] **Battery audit/reporting** — Add missing batteries by unit, loss rate by family, unit checkout history, repeated missing-unit patterns, and aging checked-out battery reporting.
- [ ] **Inventory health dashboard** — Add operational health signals for low stock by location, missing camera-system attachments, batteries below threshold by camera family, and retired/lost trends.
- [ ] **Attachment slot schema decision** — Revisit nullable `attachmentSlot` only if slot filters, required attachment checks, completeness reports, or slot-level maintenance workflows justify schema work.
- [ ] **Templates/presets** — Add camera kit presets such as FX6 shoot or FX3 shoot that suggest batteries and optional gear while keeping batteries as numbered bulk inventory.

### Admin Helper Backlog (2026-05-06)
- [ ] **Admin Fix Today queue** — Single admin-only action queue for overdue gear, pending pickup orphans, offline kiosks, damaged/lost/maintenance flags, low batteries, calendar sync failures, and expiring licenses.
- [x] **Battery unit cockpit** — Shipped `/bulk-inventory/batteries` with available/out/lost/retired counts, aging checked-out units, quick unit actions, and low compatible batteries by camera family.
- [ ] **Kiosk admin cockpit** — Show each iPad location, active state, last seen, current mode, pending pickup count, failed scan count, stale activation state, and repair actions such as deactivate, regenerate code, clear stuck pickup, and fix wrong-person attribution.
- [ ] **Admin exception review** — One feed for admin overrides, kiosk-source activity, location exceptions, failed scans, manual releases, retired/lost changes, and destructive actions.
- [ ] **People offboarding assistant** — On user deactivation, show and resolve open checkouts, upcoming reservations, shift assignments, Photo Mechanic license slots, active sessions, and allowed-email claims tied to that person.
- [x] **Inventory hygiene center** — Shipped `/items/hygiene` as a staff/admin checklist for missing category, missing department, missing primary scan code, missing image, duplicate scan identity, retired items still in kits, camera bodies with no attachments, and bulk SKUs below threshold.
- [ ] **Renewal and expiry calendar** — One admin calendar for Photo Mechanic renewals, warranty dates, calendar feed health, expiring credentials, and deadline-based admin attention.
- [ ] **Admin-only morning digest** — Daily email, push, or in-app summary for overdue count, due today, pickups waiting, kiosk offline, low batteries, expiring licenses, and calendar sync errors.

### Deferred Gaps To Keep Visible (2026-05-06)
- [ ] **SystemConfig admin surface** — `SystemConfig` has no admin UI; keep deferred until more config keys exist beyond internal escalation settings. Source: GAP-21.
- [ ] **PENDING_PICKUP auto-expiry** — Decide whether stale pickups should auto-expire after a fixed window or stay manual via Fix Today. Source: GAP-33.
- [ ] **Mobile staff parity review** — iOS still intentionally lacks some web power-user filters/conflict badges/admin item actions; revisit after web admin helpers settle. Sources: GAP-34, GAP-35, GAP-36.

### Codex Readiness (2026-05-05)
- [x] **Worktree hygiene** — classified untracked Codex/agent files, kept useful project-scoped guidance, and removed tracked local `.DS_Store` noise from future diffs
- [x] **Codex config cleanup** — deduped local hook config and verified no secrets in Codex/agent guidance files
- [x] **Verification gate** — ran migration-prefix check, JSON validation, diff whitespace check, and secret-pattern scan
- [x] **Next optimization plan** — wrote `tasks/react-query-cache-plan.md`; GAP-11 is a cache-key audit follow-up, not a migration

### Review
- Design Language Touch Target Batch shipped: event detail travel roster controls now use 40px shadcn action targets and shared inline empty state copy; image-search result selection/source controls now have visible focus and 40px source-link targets; item detail scan identity now uses explicit 40px QR/serial copy buttons and a focused QR preview. Verification is tracked in `tasks/design-language-touch-target-batch-plan.md`.
- Design Language Goal Area 2 started: shared `Dialog`/`Sheet`/`Drawer` close buttons, booking `EquipmentPicker` dense controls, and event `ShiftSlotCard` staffing actions now use the 40px operational target baseline. Area 1 authenticated visual proof remains blocked by local Prisma `P1000` login failure and is tracked in `tasks/design-language-goal-plan.md`.
- Design Language Goal Area 1 unblocked and completed: authenticated Chrome proof now covers dashboard, items, users, scan, settings, checkout creation, Fix Today, Hygiene, item scan identity, item image modal, and event detail. The blocker was stale `.env.development.local` database host drift; the working proof used quote-stripped `.env` `DATABASE_URL`/`DIRECT_URL` overrides for `next dev`.
- Next.js May 2026 Security Patch shipped: package and lockfile now pin the patched 15.x framework floor (`next@15.5.16`) plus React `19.2.6`, matching the disclosed React Server Components patch floor. The local dependency tree confirms those installed versions, and the production Next build compiled successfully on `Next.js 15.5.16`. `npm audit --omit=dev` still reports the separate nested `next -> postcss@8.4.31` moderate advisory; a scoped override made npm mark the Next dependency invalid, so that was backed out and left for an upstream Next release.
- Page Ownership Skill shipped: added a project skill for end-to-end web page and page-slice execution passes, including orientation, peer comparison, structure/UX/UI/consistency/hardening lenses, verification, docs sync, and propagation candidates. `audit-page-web` now points full-page implementation requests at the new skill while staying a diagnostic readiness audit. Verification passed for frontmatter/heading scan and `git diff --check`.
- Dashboard Upcoming Events Parity shipped: the dashboard Upcoming Events card now uses schedule-style read-only coverage metadata from `/api/dashboard`, shows event title, time, location, home/away state, staffing avatars, filled/total coverage, open-slot warnings, and home call time when available. Quick-create controls were removed from the widget, keeping `/schedule` as the management surface. Verification passed for TypeScript, migration-prefix check, whitespace, and local Next build.
- Item Detail Tabs Final Polish shipped: Schedule now pairs the month grid with a compact agenda row list, continuous week-spanning booking bars, quieter Today control, completed trailing calendar cells, and filters cancelled bookings out of occupied schedule and quick Past Bookings views. QR details are owned by the QR preview instead of a separate visible action. Calendar booking clicks keep users in context with a lighter booking preview sheet that matches the current app chrome, uses requester/creator avatars for human context, and routes deeper work to the full booking page. Insights now uses completion audit activity for return timing when available, labels the metric honestly, and shows item age in years for older gear. Attachments now hides the travel rule when no children exist and explains when fixed accessories should be added. Verification passed for TypeScript, migration-prefix check, whitespace, local route checks, authenticated Chrome DevTools tab checks, and console review.
- Item Detail Tabs Follow-up shipped: Schedule now uses clickable continuation/end markers instead of repeating long booking names across every occupied day. Past Bookings now pulls requester avatar URLs through the detail API and renders compact rows with title, requester, date range, kind, and status. History now has All / Item updates / Bookings scopes, backend scope filtering, cursor pagination, cleaner legacy audit labels, and quieter import metadata handling. Verified with TypeScript, migration-prefix check, whitespace check, local route checks, and authenticated Chrome DevTools checks on Info, Schedule, and History.
- Item Detail Tab Direction Pass shipped: the detail tab rail now uses a quieter thin active underline, removes the redundant Bookings tab, renames Calendar to Schedule, and removes visible shortcut numerals. Info now includes Past Bookings beneath upcoming reservations with requester avatars and clearer booking context. Insights is a compact signal view, History is framed around the full item touch log, Attachments has operational summary/direction, and Settings reads as workflow eligibility policy. Verification passed for TypeScript, migration-prefix check, whitespace, local route checks, and `npx next build`.
- Item Detail Data Form Hardening shipped: shared inline save controls now use a ref guard against rapid duplicate saves, show saving state instead of competing save/cancel controls, disable text/select/date/notes/QR inputs while requests are active, and toast actual save errors. Asset PATCH now trims incoming strings, accepts clearable nullable fields, allows zero-value financial fields, saves department by ID, and parses server error bodies consistently. The shared API CSRF guard now compares against the actual request origin, so localhost item saves are not rejected before auth/permissions while bad origins still return 403. The info card now uses consistent gray picker surfaces for select/category/date/year controls, a year-only Fiscal Year picker, a shared Admin badge, and a top-aligned notes row.
- Home Dashboard Focused Pass shipped: dashboard rows now use one shared row component, no longer nest action buttons inside clickable row buttons, and use a safer mobile layout with predictable truncation. Filter clear no longer nests a focusable pseudo-button inside the popover trigger. Docs synced in `AREA_DASHBOARD.md`. Verification passed for TypeScript, migration-prefix check, and local Next build. Follow-up 2026-05-12: full `npm run build` now passes through the shared Prisma/Neon migration wrapper.
- Home Dashboard Follow-up Pass shipped: overdue banner rows now split open/check-in/nudge into sibling controls, saved filter presets now split apply/delete into sibling controls, and the production browser check confirms the app can render `/login`; dashboard visual inspection still needs an authenticated browser session.
- Home Dashboard Console Polish shipped: stat cards are quieter and section headers now share one component, reducing repeated header styling across My Gear and Team Activity.
- Home Dashboard Live Browser Polish shipped: local login now works on `localhost:7001`, the dashboard renders without the Next dev issue badge, buttons/toggles have explicit tactile transitions, and the Upcoming Events header stays readable in narrow columns.
- Sidebar Polish Pass shipped: sidebar nav rows are quieter without permanent index numbers, icon states are clearer, hover/active transitions are explicit, and collapsed mode was checked live.
- Schedule Page Focused Pass shipped: New Event no longer relies on invalid empty Select values, location loading and event creation redirect/error paths are explicit, schedule row expansion uses a real expand control instead of a focusable row-link hybrid, inline schedule mutations have ref-backed duplicate-submit guards, and the live Arc console is down to normal dev noise after a reload.
- Schedule Command Bar + Coverage Pass shipped: Needs staff is now a first-class schedule command, secondary filters keep their own count, the list header/rows surface open-slot coverage gaps without requiring the shift panel, and the live shift-trades reload error is cleared.
- Schedule Readiness Polish Pass shipped: schedule now opens with an operational snapshot for open slots, ready events, my shifts, open trades, and next visible call time before the date-grouped list.
- Schedule Inline Assignment Matrix Pass shipped: expanded events now show one scannable slot matrix, staff can assign open slots directly from each tile, students keep inline trade posting, and the event manager is exposed as one clear action instead of relying on row-click behavior.
- Schedule Collapsed Staffing Preview Pass shipped: collapsed rows now show assigned-staff avatar groups and open-slot counts, those previews fade on expand, and expanded content returns to dense assignment rows for fully staffed events.
- Schedule Role Language Polish shipped: schedule rows now state staff/student needs in plain language, keep event start/all-day context with the event title, keep expanded role labels neutral to avoid competing color systems, avoid repeating the same need in the collapsed avatar preview, and reserve the right column for real home call times.
- Cross-Page DevTools Cleanup shipped: active filter clears no longer nest buttons, manifest icons use correctly declared app assets, search inputs have stable identifiers, dashboard event titles read cleanly, and schedule call ranges no longer repeat identical start/end times. Authenticated Chrome DevTools checks are clean on dashboard, schedule, bookings, items, users, and guides; abort/retry fetches remain intentional stale-request cancellation.
- Items Page Hardening Pass shipped: item export, duplicate, maintenance, and retire handlers now release busy state through auth redirects and failures; item-list empty states and pagination now key off merged serialized/bulk rows; selection clears when item type, favorites, attachments, filters, or sort changes; CSV export now honors favorites and the same search fields as the list.
- Items Page UX/UI Polish Pass shipped: the toolbar now reads as one command bar with advanced filters behind a toggle, header actions share a compact 32px rhythm, the inventory summary is a compact health grid, and item rows/cards lead with tag plus product identity without duplicating serial or department metadata in the name stack.
- Items Compact + Fill Gaps Upgrade shipped: compact density now removes thumbnails for a plainer shadcn table read, and Fill gaps now preloads a mixed serialized/bulk queue, exposes retryable count/load/save failures, ranks suggestions with same-category department hints including legacy bulk category text, makes no-photo items explicit, and lets staff review skipped items before closing the session.
- Item Detail UX/UI Cleanup Slice 1 shipped: the default Overview now leads with active checkout/upcoming reservation context, keeps item facts as the secondary right column, moves QR scan identity into the facts card, and quiets the header so derived status plus available actions are easier to read.
- Item Detail UX/UI Cleanup Slice 2 shipped: serial number left the header, duplicated brand/model sublines collapse when the product name already contains that identity, location/category/department now have clear slash separators, Check out is the primary available action while Reserve stays secondary, and scan identity rows are labeled.
- Item Detail UX/UI Cleanup Slice 3 shipped: the header action cluster now puts workflow buttons first, keeps Actions with the workflow controls, moves refresh/favorite plus freshness text into a quieter utility row, and removes the blocking freshness tooltip by baking date/time into the Updated line.
- Item Detail UX/UI Cleanup Slice 4 shipped: the admin scan identity panel now uses a compact inset layout with labeled QR/Serial values, matching copyable mono text, and a larger QR preview that owns the manage/view action without a redundant text button.
- Item Detail Hardening + Polish Pass shipped: detail header controls now respect action busy state, favorite toggles are rapid-click guarded, failed item photos render the no-photo fallback, mobile calendar shows a booking list instead of a blank grid area, booking filters use the standard toggle-group, and detail tab fetches clean up stale requests.
- Item Detail Missing Server Chunk Runtime Fix completed: the reported `Cannot find module './1893.js'` error came from stale `.next` server output. Regenerating the Next build produced a coherent `/items/[id]` bundle, and a local production route check returned `200 OK`.
- Camera Attachments shipped: item detail now uses grouped Attachments, SD card slot labels render for tags such as `MBB 17 IV 1A`, scan lookup shows parent/slot context, and docs lock QR-coded batteries to numbered bulk semantics. Follow-up 2026-05-12: full `npm run build` now passes through the shared Prisma/Neon migration wrapper.
- Derived Bulk Unit QR Scans shipped: QR values generated by the numbered bulk QR tab, such as `94e068d1-7`, now submit as one validated numbered unit under the parent SKU without converting batteries into serialized items.
- Bulk Battery Hardening shipped: kiosk pickup/check-in now scans numbered battery unit QRs one by one, lookup resolves unit QRs, checkout creation warns on low compatible battery availability, and camera-battery guidance is no longer a hard gate.
- Battery Unit Cockpit shipped: admins/staff now have `/bulk-inventory/batteries` for active unit-tracked battery families, low-stock signals, checked-out aging, booking/requester context, and audited quick unit actions.
- Kiosk battery mismatch polish shipped: derived unit scans now return operator-specific feedback for wrong battery type, duplicate pickup scan, checked-out elsewhere, not checked out on this booking, and lost/retired unit cases.
- Kiosk battery client and labels shipped: kiosk detail payloads include battery units in the checklist, pickup confirm blocks unscanned planned battery quantities, the iOS pickup subtitle counts bulk quantities, Brother P-Touch labels emphasize the unit number, and battery reporting is pinned as GAP-37.
- React Query cache migration was already shipped in code and documented in `docs/NORTH_STAR.md`; stale GAP-11 status is reconciled in `docs/GAPS_AND_RISKS.md`.
- Cache Slice 1 shipped: repeated `["me"]` and `["form-options"]` query functions now use shared hooks; `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed.
- Cache Slice 2 shipped: persisted query allowlist is now a tested helper; `tests/query-client.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed.
- Duplicate allocation check converted from scratch task file into `npm run db:check:dupe-allocations`; `node --check scripts/check-dupe-allocations.mjs` and `npm run db:migrate:check` passed.
- Cache Slice 3 shipped: booking list requester/location filter metadata failures now show a retryable alert instead of silently degrading to empty filters.
- Bookings Past Scope shipped: `/bookings` now keeps Active and Past as explicit URL-backed scopes. All active requests send `active=true`, Past requests send `past=true` across combined, checkout, and reservation list APIs, and the list copy names the current scope. Verified with typecheck, focused checkout tests, migration-prefix check, diff check, Next build, and authenticated DevTools network/console smoke.
- Booking Creation Step 2 UX Polish shipped: the shared checkout/reservation picker now reports valid, warning, unavailable, and checking counts to the wizard, Step 2 shows those counts in one compact status strip, and the footer CTA now names warning and unresolved states before review.
- Booking Creation Final Screen Polish shipped: Step 3 now leads with role-clear handoff language for checkout versus reservation, shows next step/location/timing facts, and uses "Create pickup" so checkout creation does not imply kiosk custody already happened.
- Kiosk Pickup Scan Guard shipped: live staff checkout smoke found that failed serialized scans did not block pickup confirmation. Kiosk pickup scans now record successful serialized scan evidence, confirmation blocks until every serialized item has that evidence, serial-number scanner input resolves through kiosk lookup, and the smoke checkout/kiosk test data was cleaned up. Verified with focused route tests, full Vitest, TypeScript, migration-prefix check, whitespace check, production Next build, and live API smoke.
- Busy Day Availability Stress shipped: mocked a same-day run of overlapping reservations, pending-pickup checkout, non-overlapping reuse, exact handoff edges, and bulk media commitments through the live API. Fixed the two edge cases it exposed: `PENDING_PICKUP` serialized allocations now block overlapping bookings, and overlapping `BOOKED` bulk reservations reduce available quantity before create. Confirmed `endsAt === next.startsAt` is allowed while one-minute overrun fails. All temporary stress bookings were cancelled during cleanup.
- Future Booking Context shipped: `/api/availability/check` now returns the next future serialized commitment for selected assets, and the shared picker plus booking Equipment tab show exact "Back before" timing so staff can see when an item is needed next before extending or editing.
- Turnaround Risk Guard shipped: availability preview now stays advisory but calls out short handoff windows, next-use location transfers, recent damage/lost check-in reports, and tight future bulk bookings directly on serialized and bulk rows.

### Reservations (P2)
- [x] ~~**Resolve equipment conflict badges**~~ (AC-8) — Already implemented in `BookingEquipmentTab.tsx:53-106`. Fetches conflicts for BOOKED/DRAFT bookings. Verified 2026-04-06.

### Users (P2)
- [x] ~~**Add sport/area assignment CRUD**~~ — Shipped 2026-03-28 (GAP-23). Popover multi-select in UserInfoTab.
- [x] ~~**Session-level active enforcement**~~ — Shipped 2026-04-06. `requireAuth()` checks `user.active` + deactivation deletes sessions.

### Known Bugs (documented with proof tests)
- [x] ~~**Fix `claimTrade()` missing isolation**~~ — Fixed 2026-03-30: SERIALIZABLE added to all shift-trades.ts + shift-assignments.ts transactions.
- [x] ~~**Fix bulk scan TOCTOU**~~ — Fixed 2026-03-30: Quantity guard moved inside SERIALIZABLE transaction.
- [x] ~~**Fix `markCheckoutCompleted` double-return**~~ — Fixed 2026-03-30: Now subtracts `checkedInQuantity` from return amount.
- [x] ~~**Fix CSRF bypass with missing Origin**~~ — Fixed 2026-03-30: Origin header required on all mutating requests (cron exempted via Bearer auth).

---

## Scan Flow — Low Priority (from 2026-04-09 stress test)
- [x] ~~**Admin override detail logging**~~ — Shipped 2026-04-14: `createAdminOverride` now queries the active scan session, calls `buildScanCompletionState`, and stores `bypassed.missingSerialized`, `bypassed.missingBulk`, `bypassed.missingUnits`, and `bypassed.phase` in the `details` field of both the `OverrideEvent` and the audit entry.
- [x] ~~**Server-side rate limiting on scan endpoints**~~ — Reconciled 2026-05-08: `/api/checkouts/[id]/scan` and `/checkin-scan` are kiosk-gated 403 stubs, so the old per-session rate-limit risk no longer applies to an active execution path. Kiosk scan execution remains under `withKiosk`; broader Redis/Upstash migration remains tracked by GAP-32.
- [x] ~~**Device context never sent from client**~~ — Shipped 2026-04-14: `use-scan-submission.ts` now sends `deviceContext: navigator.userAgent` on all scan POST requests (both `submitScan` and the numbered-bulk inline fetch).

---

## Phase B Backlog (needs briefs before implementation)

- [x] ~~**Shift email notifications**~~ — Trade lifecycle emails shipped for claimed, completed, approved, and declined trades; broader assignment emails remain out of scope
- [x] ~~**Student availability tracking**~~ — Shipped as recurring weekly unavailability blocks with profile Availability tab and assignment conflict indicators; date-specific exceptions remain optional follow-up
- [x] ~~**Date range grouping**~~ — Already shipped in `BookingInfoTab`: the booking detail "When" field shows connected start/end values with duration. Reconciled 2026-05-05.
- [x] ~~**Game-Day Readiness Score**~~ — Scrubbed 2026-05-13. We are not planning a readiness-score / ops-view surface.

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)

---

## Wins Sprint (2026-04-30)

- [x] Replace `img` with `next/image` in booking detail condition photos
- [x] Remove silent JSON parse swallowing in booking + scan client flows
- [x] Add missing indexes (`notifications.sent_at`, `override_events.created_at`, `bulk_stock_balances.bulk_sku_id`)
- [x] Run `npm run test` (fails on pre-existing unrelated tests: equipment-guidance, shift-trades, create-booking)
- [x] Run `npm run build` (follow-up 2026-05-12: full build now passes through the shared Prisma/Neon migration wrapper)

### Review
- Shipped low-effort hardening on booking + scan client paths and added missing operational indexes.
- Verification complete for compilation. Follow-up 2026-05-12: full `npm run build` succeeds through the shared Prisma/Neon migration wrapper. Test suite was red at the time for unrelated pre-existing failures.
