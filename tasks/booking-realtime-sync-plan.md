# Booking Real-Time Sync Plan - 2026-06-24

## Goal
- Main booking surfaces refresh from committed booking lifecycle changes without operators manually refreshing.
- A browser reload or route remount must not keep persisted dashboard/detail cache as operational truth after server state changed.
- Dashboard counts, dashboard rows, booking lists, and open booking details converge through one bounded server truth signal.
- Refresh failures preserve currently visible data and clearly keep the operator on the last known state.

## Route
- Owner area: Dashboard.
- Secondary areas: Reservations, Checkouts, Mobile/iOS API contract.
- Active ledger: `tasks/booking-realtime-sync-plan.md` plus the matching active queue entry in `tasks/todo.md`.
- Existing related plan refs:
  - `tasks/todo.md` active entry: `Booking real-time sync planning (2026-06-24)`.
  - `tasks/archive/completed-2026-06/booking-create-cleanup-2026-05-30.md` for prior booking-create ownership context.
  - `tasks/archive/completed-2026-06/active-queue-cleanup-2026-06-18.md` for dashboard/kiosk/all-day cleanup context.
- Routing decision: update this active plan instead of creating a new one. The user asked for a rerun through the updated `gt-plan` workflow, not implementation.
- Planned archive destination after all slices ship: `tasks/archive/completed-2026-06/`.

## Source Checks
- `AGENTS.md`: Non-trivial work requires planning, progress tracking, verification, docs sync, and full-file reads before edits. Vercel deploys standard Node.js serverless functions, so long-lived delivery should not be the default V1.
- `docs/NORTH_STAR.md`: Operational trust comes from derived truth, fast action surfaces, auditability, and mobile-aware API changes.
- `tasks/README.md` and `tasks/INDEX.md`: Active plans stay in `tasks/`; completed plans move into the current completed archive bucket.
- `tasks/lessons.md`: Preserve visible data on refresh failure, verify API response envelopes before client work, prefer source-contract tests for drift-prone contracts, and require browser proof for operator-facing booking surfaces.
- `docs/AREA_DASHBOARD.md`: Dashboard is the daily action console. Existing acceptance criteria already protect refresh failures and fetch races, while the documented edge case still calls out temporary stale row/count mismatches.
- `docs/AREA_RESERVATIONS.md`: AC-12 remains open: list and detail views must stay consistent after edit, cancel, and kiosk pickup fulfillment.
- `docs/AREA_CHECKOUTS.md`: Checkout custody remains kiosk-owned under D-040; app/web surfaces still need current read visibility for active custody.
- `docs/AREA_MOBILE.md`: Shared API changes must remain additive or defensively decoded so native clients tolerate deployment skew.
- `docs/DECISIONS.md`: D-001, D-002, D-006, D-007, D-012, and D-040 keep booking truth derived, booking unified, mutations transactional, audit meaningful, transitions guarded, and custody kiosk-only.
- `docs/GAPS_AND_RISKS.md`: React Query/stale detection gaps are recorded as closed, but reservations AC-12 still owns list/detail consistency debt.
- `prisma/schema.prisma`: `Booking.updatedAt`, `AuditLog.createdAt`, and the `AuditLog(entityType, entityId, createdAt)` index give bounded committed-change evidence without a schema migration in V1.
- API response shapes checked before client work:
  - `/api/dashboard`: `ok({ data, partialFailures })`.
  - `/api/dashboard/stats`: `ok({ data, partialFailures })`.
  - `/api/bookings`: `ok({ data, total, limit, offset })`.
  - `/api/bookings/[id]`: `ok({ data: { ...detail, allowedActions } })`.
  - `/api/reservations` and `/api/checkouts`: list envelope returned through `listBookings()` as `{ data, total, limit, offset }`.
- Current client facts:
  - Full dashboard query uses `DASHBOARD_KEY`, persists, and has `staleTime: 5 * 60_000`.
  - Dashboard stats query refreshes faster and overlays totals only; row arrays stay owned by the full dashboard payload.
  - Persisted query roots are `dashboard` and `booking`; booking lists are not persisted.
  - Booking list queries use `["bookingList", kind, listUrl]` and currently refetch on window focus.
  - Booking detail queries use `["booking", id]` and currently refetch on window focus.

## Stop Conditions
- Stop before implementation if any route envelope above is contradicted by current source.
- Stop if the change signal cannot be answered by indexed, bounded database reads. Do not add an unbounded audit/dashboard-sized scan.
- Stop if `Booking.updatedAt` fails to advance for a visible booking mutation and no indexed audit fallback identifies the changed booking id.
- Stop if a new shared API response shape would require iOS changes without additive/default-safe decoding or source-contract proof.
- Stop if client invalidation creates a refetch loop or risks rate-limit pressure on `/api/dashboard` or `/api/dashboard/stats`.
- Stop if authenticated browser proof cannot log in locally; record the blocked browser proof and keep focused source/test proof.
- Stop if Vercel Node serverless constraints make long-lived delivery necessary for correctness. V1 should remain a lightweight polling/change-cursor strategy unless product requirements demand different infrastructure.

## Slices
- [x] Slice 1: Fresh-on-mount correctness
  - Set dashboard, dashboard stats, booking detail, and booking list queries to refetch on mount for operational surfaces.
  - Keep visible cached data while the truth fetch runs.
  - Add source-contract coverage that persisted dashboard/detail cache cannot remain treated as fresh for the operational pages after remount.
- [x] Slice 2: Booking change signal API
  - Add a bounded authenticated `GET /api/bookings/changes?since=<cursor>` route.
  - Return `ok({ data: { cursor, changedBookingIds } })`.
  - Derive the cursor from committed booking/audit evidence, preferring `Booking.updatedAt` and using indexed audit evidence for mutation paths that need id-level precision.
  - Require normal booking view authorization and route rate limiting.
  - Add focused route coverage for auth, authorization, cursor advancement, bounded reads, and empty-change responses.
- [x] Slice 3: Client invalidation wiring
  - Add a shared booking-change sync hook used by Dashboard and the shared booking list surface.
  - Poll only while the document is visible and the browser is online; trigger an immediate check on visibility return.
  - Invalidate `DASHBOARD_KEY`, `DASHBOARD_STATS_KEY`, `["bookingList"]`, and known changed `["booking", id]` detail queries.
  - Preserve local optimistic updates and visible stale data during background refresh failures.
- [x] Slice 4: Docs, verification, and operational proof
  - Update `docs/AREA_DASHBOARD.md` acceptance criteria/change log for automatic booking freshness.
  - Update `docs/AREA_RESERVATIONS.md` AC-12 only if list/detail consistency is actually proven.
  - Update `docs/AREA_CHECKOUTS.md` if checkout read freshness is materially affected.
  - Update `docs/GAPS_AND_RISKS.md` only if this closes or opens a tracked gap.
  - Refresh `docs/TESTING.md` if new verification expectations or tests are added.
  - Record final status in `tasks/todo.md`, then archive this plan only after all slices ship.

## Verification
- [x] `npx vitest run tests/booking-change-signal-route.test.ts tests/booking-realtime-sync-source.test.ts`
- [ ] `npx tsc --noEmit --pretty false`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [ ] `npm run build:app`
- [ ] Full `npm run build` only when migration deploy preflight is safe or explicitly approved.
- [ ] iOS drift/build gates only if an existing shared API envelope changes. A new additive web-only route does not require native build proof by itself.
- [ ] Authenticated browser smoke:
  - [x] Open Dashboard.
  - [x] In another authenticated client, create and mutate a reservation using local seeded admin credentials.
  - [x] Confirm dashboard row data and counts update without manual refresh.
  - [ ] Confirm `/bookings?tab=checkouts` list data converge without manual refresh.
  - [x] Confirm `/bookings?tab=reservations` list data converge without manual refresh.
  - [x] Open a booking detail sheet, mutate that booking elsewhere, and confirm the detail refreshes.
  - [x] Cancel the smoke reservation and confirm active reservation views drop it.
  - [x] Reload Dashboard and confirm no stale persisted row remains after the truth fetch completes.
  - [x] Save screenshots/log notes under `tasks/archive/proofs/` if the implementation slice reaches browser proof.

## Review
- Shipped: Slice 1 set `refetchOnMount: "always"` on dashboard full payload, dashboard stats, booking detail, and shared booking-list queries, then pinned those source contracts in `tests/booking-realtime-sync-source.test.ts`. Slice 2 added bounded authenticated `GET /api/bookings/changes?since=<cursor>` with booking view permission, per-user rate limiting, an opaque cursor, committed booking/audit evidence, viewer-scoped `changedBookingIds`, and route coverage in `tests/booking-change-signal-route.test.ts`. Slice 3 added `useBookingChangeSync`, mounted it on Dashboard and the shared booking list, polled only while visible/online, and invalidated dashboard, stats, booking-list, and changed booking-detail query keys. Slice 4 browser proof found that `BookingDetailsSheet` owned local fetch state outside React Query, so the change-sync hook now dispatches `BOOKING_CHANGE_SYNC_EVENT` and open detail sheets silently refetch only when their current booking id changes.
- Verified: `npx vitest run tests/booking-change-signal-route.test.ts tests/booking-realtime-sync-source.test.ts`; `npm run codemap`; `npm run verify:docs`; `npm run db:migrate:check`; `git diff --check`; authenticated browser smoke for Dashboard, `/bookings?tab=reservations`, open booking detail, cancellation, and Dashboard reload.
- Deferred: `/bookings?tab=checkouts` no-manual-refresh browser proof and actual kiosk pickup fulfillment proof were not exercised in this reservation-based smoke. The shared booking-list hook covers checkout tabs by construction, but no checkout mutation was performed in the browser smoke.
- Blocked: `npx tsc --noEmit --pretty false` and `npm run build:app` currently fail on unrelated `hiddenFromRoster` Prisma-client/schema drift in `src/app/api/kiosk/users/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/api/users/route.ts`, and `src/lib/user-visibility.ts`.
- Proof artifacts: `tasks/archive/proofs/booking-realtime-dashboard-final.png`; `tasks/archive/proofs/booking-realtime-sync-2026-06-24.md`.
- Next slice or stop: Stop. Reservation-based Dashboard/list/detail realtime sync is shipped locally; checkout-specific and kiosk-pickup browser proof can be a future targeted smoke when suitable local test data is available.
