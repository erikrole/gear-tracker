# Web Booking Detail iOS Alignment Plan - 2026-07-21

## Goal
- Bring the latest native booking-detail hierarchy to the shared web checkout and reservation detail surface while preserving the web's denser operator context, staff actions, equipment manifest, history, and kiosk custody boundary.

## Route
- Owner area: Reservations and Checkouts, with Mobile as the visual reference.
- Ledger: `tasks/todo.md` and the Reservations/Checkouts area changelogs.
- Existing references: `tasks/archive/completed-2026-07/ios-booking-detail-sheet-redesign-plan.md`, `tasks/archive/completed-2026-07/ios-booking-surface-alignment-plan.md`, and `tasks/archive/completed-2026-07/ios-item-detail-hierarchy-plan.md`.

## Source Checks
- `BookingDetailPage` already serves both `/checkouts/[id]` and `/reservations/[id]` under D-002. The slice stayed shared.
- The existing detail response already contains requester, schedule, location, event, kit, equipment, status, allowed actions, and freshness state. No API, schema, or permission change was required.
- Native Booking Detail now leads with booking identity, live timing, requester, location, and the next allowed action, then keeps details and equipment quieter.
- Native Item Detail and Bookings rows use title, live timing, requester, location, and item count as the shared booking anatomy.
- Web retained its operator-only breadth: staff action menus, inline editing, equipment detail, activity history, linked events, sync health, and admin close-without-scan.
- Existing web peer surfaces established two reused patterns: Item Detail keeps identity and derived state above dense content, while the booking quick-view sheet uses a compact overview before equipment.

## Stop Conditions
- Stop if the current booking payload cannot express the summary without a new read-model or API change.
- Stop if the pass removes web-only operator context, changes action policy, adds a custody mutation, or forks checkout and reservation detail implementations.
- Stop visual signoff if an authenticated local detail route cannot be opened.

## Slices
- [x] Slice 1: Recompose `BookingHeader` around title, lifecycle state, live timing, requester, pickup/return location, equipment count, and event context while retaining current actions and freshness controls.
- [x] Slice 2: Add focused source-contract coverage for the shared hierarchy, requester visibility, status semantics, kiosk handoff language, and retained operator actions.
- [x] Slice 3: Verify the shared checkout/reservation detail surface, sync area docs and task review, and record authenticated browser proof.

## Verification
- [x] Focused booking-detail and status/custody source-contract tests.
- [x] Focused ESLint for touched TypeScript/TSX files.
- [x] `npx tsc --noEmit --pretty false`.
- [x] `npm run verify:docs`.
- [x] `git diff --check` for the bounded slice.
- [x] `npm run build:app`.
- [x] Authenticated browser smoke for one checkout detail and one reservation detail at desktop and 900px tablet widths.

## Review
- Shipped: Shared checkout and reservation detail now leads with lifecycle state, live timing, booking identity, named requester, pickup location, physical gear count, and event context. Web-only editing, actions, equipment, freshness, and history remain available.
- Verified: 22 focused tests, focused ESLint, TypeScript, docs/codemap checks, whitespace checks, production app build, and authenticated checkout/reservation browser proof passed. Both desktop and tablet layouts rendered without browser console warnings or errors.
- Deferred: Broader cross-surface alignment remains separate, bounded work.
- Blocked: None.
- Proof artifacts: Authenticated local checkout and multi-event reservation detail observations in the in-app browser.
- Next slice or stop: Stop. Use this summary-first, control-room-second approach for the next explicitly selected web surface.
