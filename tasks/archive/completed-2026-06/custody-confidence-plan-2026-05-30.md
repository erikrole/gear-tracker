# Custody Confidence Sweep Plan

## Goal
Make checkout, pickup, return, extension, cancellation, and booking detail behavior impossible to misunderstand. The sweep keeps the unified Booking model, preserves kiosk-owned pickup/return custody, and aligns UI confidence with server truth.

## Source Audit
- `AGENTS.md`: plan first, read area docs/schema/gaps before implementation, use shadcn/ui for UI work, verify before done, keep docs in sync.
- `docs/NORTH_STAR.md`: operational speed, clarity, trust, derived status, audit everything, integrity before velocity, explicit failure handling.
- `docs/AREA_CHECKOUTS.md`: desktop checkout creation creates `PENDING_PICKUP`; kiosk pickup scans start custody; active checkouts include `OPEN` and `PENDING_PICKUP`; conflict and stale-selection recovery must be explicit.
- `docs/AREA_RESERVATIONS.md`: reservations use the unified detail page, `BOOKED` reservations convert to checkout, and past-due reservation planning must not inflate checkout custody counts.
- `docs/AREA_KIOSK.md`: iOS kiosk is canonical for pickup and return; web app scan is not custody execution; numbered batteries bind at kiosk pickup and return through kiosk endpoints.
- `docs/DECISIONS.md`: D-001 derived status, D-002 unified Booking, D-006 SERIALIZABLE and overlap constraints, D-007 audit logging, D-012 lifecycle guardrails, D-022 unit custody, D-031 multi-event booking.
- `docs/GAPS_AND_RISKS.md`: relevant kiosk/session and booking audit gaps are closed; current residual risk is functional drift between route defaults, wizard payloads, and detail copy.
- `prisma/schema.prisma`: Booking, BookingEvent, allocations, scan sessions, scan events, bulk unit allocations, and audit logs support the intended custody model.

## Current Findings
- Booking create UI already carries selection warnings, stale unavailable selections, bulk count recovery, and kiosk handoff copy.
- Service-level create hardening already rejects empty equipment, invalid windows, duplicate event links, duplicate bulk lines, and allocation races.
- Kiosk pickup and return endpoints keep scan execution in kiosk-only routes and preserve serialized plus numbered-battery validation.
- High-impact defect found: `POST /api/checkouts` still resolves sport default `eventId` when `eventIds[]` is already present. The wizard sends `eventIds[]` plus `sportCode` for event-linked checkouts, so the route can pass both `eventId` and `eventIds` into `createBooking`, causing a 400 instead of creating the pending pickup.

## Slice 1: Checkout Event-Link Payload Drift
- [x] Fix checkout creation so sport defaults run only when neither `eventId` nor `eventIds[]` is present.
- [x] Add a focused route regression proving a checkout payload with `eventIds[]` and `sportCode` reaches `createBooking` without a synthesized `eventId`.
- [x] Verify focused tests for changed route behavior.
- [x] Update checkout area docs for the shipped route fix.

## Remaining Slices
- [x] Detail action clarity: audit full booking detail and sheet actions for stale visible data, duplicate action guards, vague toasts, and conflict copy on extend/cancel/convert.
  - Finding: the full booking detail page labels open checkout returns as `Return at kiosk`, but still passes `checkinBulk` into the equipment table, which renders a desktop `Return All` mutation for bulk items. This contradicts kiosk-owned custody and can make operators believe a web click executed a standard return.
  - Shipped: removed the full-detail desktop bulk return affordance while preserving server-side/admin override capability elsewhere, then locked the hidden-action behavior with a focused source-contract test.
  - Shipped: shared full-detail and sheet action copy for cancellation and reservation conversion. Conversion now says it creates a pending pickup and that gear custody still begins at kiosk pickup.
- [x] Kiosk pickup/return story: audit serialized and numbered-battery scan copy, confirm-route race behavior, and stale `PENDING_PICKUP` visibility.
  - Finding: numbered battery pickup scans reject duplicate units, but serialized pickup scans create another successful `ScanEvent` for the same asset. A repeated barcode scan can look like new progress even though it changed nothing.
  - Finding: pickup confirmation reads scan evidence, updates the booking, then writes audit/badge side effects outside a transaction. Two fast confirmations can both pass the pre-read and duplicate success/audit around the same `PENDING_PICKUP` -> `OPEN` transition.
  - Finding: kiosk session activation had drifted back to `sessionExpiresAt: null` even though `AREA_KIOSK` and `GAPS_AND_RISKS` record 7-day DB-backed session expiry as a closed trust gap.
  - Shipped: serialized pickup duplicate scans now return explicit duplicate feedback, pickup confirmation validates scan evidence and performs the status transition plus audit in one `SERIALIZABLE` transaction with a status-guarded update, and kiosk activation/validation again persists and enforces the 7-day `sessionExpiresAt` trust gate.
- [x] Booking list recovery: audit `/bookings`, `/checkouts`, and `/reservations` state filters, highlight behavior, row actions, and refresh-preserves-data semantics.
  - Finding: active list row-menu cancellation optimistically changes the row status to `CANCELLED`, but a successful response does not remove or refresh the row. Operators can keep seeing a cancelled checkout/reservation inside an Active work queue until a later reload, which makes the list contradict its own filters.
  - Shipped: successful checkout and reservation row-menu cancellation now removes the booking from the current cached list, keeps the visible total aligned, and asks the server list to refresh. Failed cancels still roll back to the previous row data.
- [x] History/audit confidence: confirm audit log pagination and denied/error paths do not look like valid empty history.
  - Finding: the booking detail sheet's history pagination only reports thrown network errors. A 400/403/500 response or malformed successful payload leaves the visible history unchanged with no inline explanation, so older audit entries can silently stay hidden behind an inert-looking load-more action.
  - Shipped: shared booking detail sheet history pagination now validates successful payload shape, shows an inline destructive alert for stale cursors, access changes, server failures, malformed responses, and network failures, and offers the correct recovery action: refresh for stale/access failures, retry for transient or malformed responses.
- [x] Browser smoke: authenticated checks for `/checkouts/new`, `/reservations/new`, `/bookings`, and one booking detail flow.

## Verification Plan
- Focused tests for changed behavior.
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated browser smoke for `/checkouts/new`, `/reservations/new`, `/bookings`, and one booking detail route.

## Deferred
- No schema changes in this sweep unless source audit exposes a correctness gap.
- No desktop pickup or return scan execution.
- No changes to kiosk trust model or PENDING_PICKUP handoff rules.

## Review
Shipped: Slice 1 fixed `POST /api/checkouts` so wizard payloads with explicit `eventIds[]` and `sportCode` no longer get a synthesized legacy `eventId` before `createBooking`.

Verified:
- `npx vitest run tests/booking-list-routes.test.ts tests/booking-create-validation.test.ts tests/create-booking.test.ts tests/booking-create-ux.test.ts`
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated in-app browser smoke: `/checkouts/new`, `/reservations/new`, `/bookings`, reservation sheet, and `/reservations/cmoxazros000tkv5urn1jvvv0`.

Benefits:
- Event-linked checkout creation no longer fails because route defaults contradict the wizard's multi-event contract.
- The checkout create route now matches D-031: callers choose `eventId` or `eventIds[]`, never both.
- Regression coverage locks the route behavior before the service boundary, where the user-facing failure happened.

Remaining risks:
- This slice does not finish the full custody-confidence story. Detail action stale-data copy, kiosk pickup/return confirmation races, booking list recovery, and audit-history empty/error states remain in the next slices.
- Authenticated browser smoke verified page loading and a detail route, not a full create/submit flow against live inventory.

Shipped: Slice 2 removed the misleading desktop `Return All` bulk-return action from the full checkout detail equipment table and aligned full-detail/sheet cancellation and conversion copy with the kiosk-owned custody model.

Verified:
- `npx vitest run tests/booking-detail-custody-contract.test.ts tests/scan-route-gate-contract.test.ts tests/booking-list-routes.test.ts`
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated in-app browser smoke after restarting the dev server: `/checkouts/new`, `/reservations/new`, `/bookings`, `/reservations/cmoxazros000tkv5urn1jvvv0`, `/bookings?tab=checkouts&past=true`, checkout sheet from the past checkout list, and `/checkouts/cmohdd85x0001js04mhrcymhv`. The checkout full-detail snapshot showed no `Return All` action.

Benefits:
- Operators no longer see contradictory web return execution on a page that tells them returns belong at the kiosk.
- Reservation conversion no longer implies active checkout custody; it names the pending-pickup state and kiosk pickup handoff.
- Cancellation copy now names irreversible history retention and equipment commitment release without implying every cancellation is a normal return.

Remaining risks:
- This slice does not change the server `checkin` action matrix or admin override routes; it removes the misleading full-detail affordance only.
- Active checkout data was not present in the local seed state, so browser smoke used a past checkout detail route for the hidden-action contract.
- Kiosk pickup/return confirmation races, booking list recovery, and audit-history empty/error states remain in the next slices.

Shipped: Slice 3 tightened kiosk pickup trust paths. Repeated serialized pickup scans now tell the kiosk client the item was already scanned instead of recording another successful scan event. Pickup confirmation now revalidates required serialized and numbered-battery evidence and writes the `OPEN` transition plus kiosk audit inside one `SERIALIZABLE` transaction guarded by `status = PENDING_PICKUP`. Kiosk session activation again stores the same 7-day expiry used by the cookie, and `requireKiosk()` clears expired sessions before rejecting them.

Verified:
- `npx vitest run tests/kiosk-bulk-detail-routes.test.ts`
- `npx vitest run tests/kiosk-session-auth.test.ts tests/kiosk-bulk-detail-routes.test.ts tests/bulk-unit-kiosk-scans.test.ts tests/pending-pickup-expiry.test.ts tests/scan-route-gate-contract.test.ts`
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated in-app browser smoke after restarting the dev server: `/checkouts/new`, `/reservations/new`, `/bookings`, and `/reservations/cmoxazros000tkv5urn1jvvv0`; all loaded without login redirects or runtime overlays.

Benefits:
- Repeated serialized pickup scans no longer look like new progress.
- Fast repeated pickup confirmation can no longer duplicate kiosk success/audit around the same checkout opening.
- Kiosk device trust is bounded by the documented 7-day server-side expiry again instead of relying only on an intact cookie.

Remaining risks:
- This slice hardens pickup confirmation and kiosk session expiry, but does not yet audit every iOS screen copy branch or simulate a full live kiosk pickup/return against hardware.
- Return completion already routes through `kioskCompleteCheckin()` with a serializable transaction; a separate pass should still inspect return-screen empty/error copy and partial-return visible state.
- Booking list recovery and audit-history empty/error states remain in the next slices.

Shipped: Slice 4 tightened booking list recovery for row-menu cancellation. When the server accepts checkout or reservation cancellation from the active `/bookings` queue, the row is removed from the current cached list, the visible total is adjusted, and a server refresh is requested. If the mutation fails, the previous row data is restored.

Verified:
- `npx vitest run tests/booking-list-recovery.test.ts tests/booking-list-status-query.test.ts tests/booking-list-routes.test.ts`
- `npx tsc --noEmit` after `npx next build` regenerated `.next/types`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated in-app browser smoke after restarting the stale dev server: `/checkouts/new`, `/reservations/new`, `/bookings`, and `/reservations/cmoxazros000tkv5urn1jvvv0` all rendered expected authenticated content without login redirects or visible runtime overlays. Dev server output showed 200 responses for the smoke routes.

Benefits:
- Active Checkouts and Active Reservations no longer keep a cancelled row visible after a successful row-menu cancel.
- Visible list totals stay aligned with the cached rows while the server refresh catches up.
- The rollback path still restores the previous row data when cancellation fails.

Remaining risks:
- This slice focuses on row-menu cancellation recovery. Audit-history empty/error states remain in the next slice.
- The browser log API continued to show one preserved stale module error from before the dev-server restart; the restarted server log did not show an active runtime error during the final smoke pass.

Shipped: Slice 5 tightened shared booking detail sheet audit-history pagination. Older-history loads now validate that successful responses include an audit entry array, show an inline shadcn Alert when older history did not load, and choose recovery copy/action based on failure class: stale cursor or access change prompts refresh; server, network, and malformed-response failures prompt retry. The visible history is still labeled as current, while the UI warns that older entries may be hidden.

Verified:
- `npx vitest run tests/booking-audit-history-recovery.test.ts tests/api-hardening-wave11.test.ts`
- `npx next build`
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- Authenticated in-app browser smoke after restarting the stale dev server: `/checkouts/new`, `/reservations/new`, `/bookings`, and `/bookings?tab=reservations&id=cmoxazros000tkv5urn1jvvv0&sheetTab=history`. The reservation history sheet opened, `/api/bookings/cmoxazros000tkv5urn1jvvv0` returned 200, and there was no Next error overlay.

Benefits:
- Operators no longer have to infer whether "Load older entries" failed, did nothing, or reached the end of history.
- Stale audit cursors no longer trap the sheet in a retry loop; the UI asks for a booking refresh.
- Malformed successful responses no longer collapse into an empty append that looks like complete history.
- The helper test locks the recovery copy/action contract without adding a brittle browser-only assertion.

Remaining risks:
- Full booking detail pages still show only the initially loaded audit slice; this pass focused on the sheet pagination path where the user can request older entries.
- Browser smoke verified route load and the history sheet, not an induced live 400/500 from the audit-log endpoint.
- The dev server had to be restarted after `next build` because the old process served stale development chunks; the restarted server handled the final smoke routes with 200 responses.
