# Bookings Status Ship Fixes - 2026-05-10

## Goal
- Make active checkout work and stale reservation cleanup show up in the right daily surfaces before ship.

## Peer patterns checked
- Dashboard: transient action cards hide when empty, cap at 5 rows, and link to the full filtered bookings surface.
- Bookings: Active/Past scope owns operational separation while status filters narrow inside that scope.

## Plan
- [x] Checkouts default: show `OPEN` and `PENDING_PICKUP` together as active checkout work.
- [x] Dashboard: add a separate stale-reservations attention card for `BOOKED` reservations whose end time is in the past.
- [x] Tests: cover default multi-status checkout routing and dashboard stale-reservation wiring.
- [x] Docs: sync Checkouts, Reservations, Dashboard, and gaps/task notes.
- [x] Verification: run focused Vitest, TypeScript, migration check, diff check, and Next build.

## Propagation candidates
- [ ] Dashboard stats: keep checkout-overdue custody count separate unless product direction changes.

## Review
- Shipped: `/bookings?tab=checkouts` now defaults to `OPEN` plus `PENDING_PICKUP`, explicit status filters still narrow to one state, and dashboard Team Activity shows Stale reservations as a separate red card linked to the reservation overdue filter.
- Verified: `npx vitest run tests/booking-list-status-query.test.ts tests/dashboard-pending-pickup-link.test.ts tests/booking-detail-status-read-model.test.ts tests/booking-status-labels.test.ts tests/checkout-actions-client.test.ts tests/checkout-rules.test.ts tests/booking-list-routes.test.ts tests/availability.test.ts`, `npx tsc --noEmit --pretty false`, `git diff --check`, `npm run db:migrate:check`, `npx next build`, and Chrome DevTools smoke on `/bookings?tab=checkouts` plus `/`.
- Deferred: Dashboard checkout overdue stats intentionally remain checkout-custody-only. `PENDING_PICKUP` auto-expiry remains GAP-33.
