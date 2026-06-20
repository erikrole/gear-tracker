# Completed Booking Create Cleanup - 2026-05-30

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: Booking Create UX Ownership Pass (2026-05-30)
- [x] Audit checkout and reservation create docs, schema, routes, services, wizard components, picker, and peer surfaces.
- [x] Write active slice plan in `tasks/archive/completed-2026-06/booking-create-ux-goal-plan-2026-05-30.md`.
- [x] Improve Step 1 event/ad hoc context clarity.
- [x] Improve Step 2 availability warning hierarchy and mobile-friendly summary.
- [x] Improve Step 3 confirmation handoff and submit confidence.
- [x] Add focused helper/component-flow coverage.
- [x] Sync checkout/reservation docs and run required verification.

**Review**
- Active tracking lives in `tasks/archive/completed-2026-06/booking-create-ux-goal-plan-2026-05-30.md`.
- Shipped: Step 1 now explains calendar-linked versus ad hoc booking mode, shows selected-event count, previews the derived window/location, and gives no-event users a direct ad hoc recovery action.
- Shipped: Step 2 now receives selected hard-conflict, next-use, serialized-turnaround, and bulk-turnaround counts from `EquipmentPicker`, then separates those states in the summary strip and footer CTA.
- Shipped: Step 3 now repeats selected availability warnings before submit, while checkout and reservation success toasts name the highlighted destination in `/bookings`.
- Peer patterns checked: Items create/edit forms, Items summary bars, booking detail equipment warning rows, schedule event creation handoff, and event/dashboard booking deep links.
- Focused tests passed: `npx vitest run tests/booking-create-ux.test.ts tests/create-booking.test.ts tests/booking-create-validation.test.ts`.
- Full gates passed: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.
- Browser smoke passed on `http://localhost:3013/checkouts/new` and `/reservations/new` at desktop and 390px mobile widths with no console warnings/errors; checkout smoke also reached Step 2, selected one item, and reached the confirmation handoff screen.

## Completed: Booking Create Hardening (2026-05-30)
- [x] Audit booking creation docs, schema, routes, shared service, availability checks, and existing tests.
- [x] Add shared server guardrails for empty non-draft bookings, duplicate multi-event IDs, and invalid create windows.
- [x] Normalize overlap and transaction race failures to booking conflict responses.
- [x] Add focused service and validation regressions.
- [x] Sync checkout/reservation docs and document verification.

**Review**
- Active tracking was archived to `tasks/archive/completed-2026-06/booking-create-hardening-plan-2026-05-30.md`.
- Current root issue: the wizard catches several bad states, but the shared create service should still be authoritative for every booking-create caller, including API routes, reservation conversion, and reservation duplication.
- Implemented shared service validation for invalid windows, empty non-source equipment selections, duplicate `eventIds`, duplicate bulk lines, and invalid bulk quantities.
- Implemented create-schema validation for empty checkout/reservation payloads, while preserving checkout conversion payloads that use `sourceReservationId`.
- Overlap exclusion-constraint races and serializable conflicts now return 409 responses instead of surfacing as unhandled server errors.
- Focused tests passed: `npx vitest run tests/create-booking.test.ts tests/booking-create-validation.test.ts`.
- Shared availability and booking route regressions passed: `npx vitest run tests/availability.test.ts tests/availability-route.test.ts tests/booking-list-routes.test.ts`.
- Full gates passed: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.
