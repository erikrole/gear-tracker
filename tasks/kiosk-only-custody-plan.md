# Kiosk-Only Custody Plan

Date: 2026-06-15
Status: Slice 5 implemented and browser-smoked

## Product Contract

Checkout and return are physical custody events. They can only happen at a kiosk.

If a user is not at a kiosk with the gear in front of them, the app and web should create or manage a reservation. Direct checkout remains available only through the kiosk for "I need this now" gear-room handoff. Return remains available only through the kiosk return flow.

`PENDING_PICKUP` can remain, but its meaning should narrow: gear is expected for pickup because the reservation window has started or a kiosk pickup session is in progress. It should not be the normal result of a web/app checkout creation flow.

## Source-Grounded Current State

- Web checkout creation exists at `/checkouts/new` and posts to `/api/checkouts`.
- Web reservation detail can currently convert a `BOOKED` reservation into a `PENDING_PICKUP` checkout through "Start checkout."
- App/web scan is already lookup-only; custody scans are kiosk-owned.
- Kiosk iOS is already the canonical checkout, pickup, and return surface.
- The `Booking` model already supports a checkout linked to a source reservation through `sourceReservationId`.

## Decision For Implementation

When kiosk pickup fulfills a reservation, the source reservation should close in one durable way.

Decision: set the source reservation to `COMPLETED` when kiosk pickup creates or opens the linked checkout custody record. Reason: the reservation did its job. It was not cancelled by the user, and treating it as cancelled makes history and reporting lie. Keep `sourceReservationId` on the checkout for traceability.

## Slice 1 - Contract Docs And Decisions

- Update `docs/DECISIONS.md` with a new accepted decision: kiosk-only custody.
- Update `docs/AREA_CHECKOUTS.md` so checkout creation is kiosk-only and web checkout detail is a read/manage surface for active custody records.
- Update `docs/AREA_RESERVATIONS.md` so app/web create reservations only, and kiosk pickup fulfills reservations.
- Update `docs/AREA_KIOSK.md` with reservation pickup as the handoff bridge.
- Update `docs/AREA_SCAN.md` only if any wording still implies app/web custody scans.
- Update `docs/GAPS_AND_RISKS.md` to record that the decision was accepted without opening a new gap.

Verification:
- `npm run verify:docs`
- `git diff --check`

## Slice 2 - Server-Side Custody Boundary

- [x] Keep kiosk routes under `withKiosk()` as the only mutation path that can create immediate checkout custody, confirm pickup, or complete returns.
- [x] Block authenticated app/web checkout creation endpoints from creating non-kiosk checkout custody.
- [x] Remove or disable reservation conversion from regular authenticated routes.
- [x] Keep read/export/history endpoints for checkouts because active and historical checkout records still exist.
- [x] Add regression tests proving non-kiosk callers cannot create checkout custody, convert reservations to pickup, or return gear.

Verification:
- [x] Focused route/service tests for checkout creation, reservation actions, and blocked non-kiosk pickup/return routes.
- [x] `npx tsc --noEmit --pretty false` run; blocked only by pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.
- [x] `git diff --check`

## Slice 3 - Web/App Affordance Removal

- [x] Remove `New checkout`, `Check out`, `Start checkout`, and `Create checkout` affordances from non-kiosk web surfaces.
- [x] Replace item and event gear actions with reservation creation when the user is outside kiosk.
- [x] Preserve links to existing active checkout detail records as status/history, not creation actions.
- [x] Update iOS non-kiosk booking surfaces so creation is reservation-first and no app action starts checkout custody.
- [x] Keep copy direct: "Reserve" for future claim, "Pick up at kiosk" for custody.

Verification:
- [x] Source-contract tests for removed labels/routes where existing tests cover UI text.
- [ ] Authenticated browser smoke for dashboard, items detail, events detail, bookings/reservations.
- [ ] iOS source tests plus `npm run drift:ios` and `npm run audit:ios:gaps` if native surfaces change.

## Slice 4 - Kiosk Reservation Pickup

- [x] Extend kiosk student hub so upcoming due reservations become pickup work at the kiosk.
- [x] On kiosk pickup confirmation, create or open the linked checkout custody record from the reservation only after required scans pass.
- [x] Link the checkout through `sourceReservationId`.
- [x] Close the source reservation according to the open decision above.
- [x] Preserve availability and bulk/unit binding rules: quantity intent during reservation, exact unit binding at kiosk pickup.
- [x] Ensure stale pickup cleanup handles any remaining `PENDING_PICKUP` records consistently.

Verification:
- [x] Focused kiosk pickup route/service tests for serialized assets, bulk quantities, numbered batteries, duplicate scans, and source reservation linkage.
- [x] Conflict and wrong-location route coverage for reservation pickup follow-up.
- [x] iOS kiosk contract tests.
- [x] Kiosk simulator build.

## Slice 5 - Reporting, Search, Wording, And Final Verification

- [x] Audit dashboard, reports, global search, item insights, settings, notifications, and exports for checkout-vs-reservation wording.
- [x] Keep checkout analytics for actual custody only.
- [x] Treat stale reservations and awaiting pickup separately from overdue active checkouts.
- [x] Update area docs and task review with the shipped behavior.

Verification:
- [x] Focused report/search/dashboard tests where touched.
- [x] `./node_modules/.bin/next build`
- [ ] `npm run build` before commit if network/database access is available and approved.
- [x] Authenticated browser smoke for touched web surfaces.
- [x] iOS build not rerun; no native code changed in Slice 5 after the Slice 4 simulator proof.

## Stop Conditions

- Stop if current production data relies on web-created `PENDING_PICKUP` rows in a way that cannot be safely migrated or relabeled.
- Stop if source-reservation closure cannot be made auditable without schema or report changes larger than this slice.
- Stop if tests show kiosk direct checkout and reservation pickup need conflicting allocation semantics.
