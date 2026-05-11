# Bookings State Polish Pass - 2026-05-10

## Goal
- Make current, future, cancelled, overdue, awaiting-pickup, and past booking states read consistently across `/bookings`, booking details, and dashboard entry points before shipping.

## Peer Patterns Checked
- Items: URL-backed filters, stable status labels, shadcn primitives, and clear empty states.
- Schedule: page-level scope controls, direct route links, and action surfaces separated from read-only overview rows.

## Plan
- [x] Structure: audit bookings, checkout, reservation, dashboard, schema, and docs state contracts.
- [x] UX: repair awaiting-pickup links and action availability.
- [x] UI: repair pending-pickup labels and orange status visual.
- [x] Consistency: align client and server action matrices.
- [x] Hardening: add focused regression coverage.
- [x] Verification: run focused tests, typecheck, migration check, diff check, and build.
- [x] Docs: sync checkout/dashboard/status docs and archive this record.

## Propagation Candidates
- [ ] Search/results status labels: confirm they already use the shared status helpers before the next search pass.

## Review
- Shipped: pending-pickup list/detail/report labels, orange list status visual, client row actions, reservation detail overdue alignment, dashboard awaiting-pickup checkout deep links, and stale dashboard comments.
- Verified: `npx vitest run tests/checkout-actions-client.test.ts tests/checkout-rules.test.ts tests/booking-status-labels.test.ts tests/dashboard-pending-pickup-link.test.ts tests/booking-list-routes.test.ts tests/availability.test.ts`, `npx tsc --noEmit --pretty false`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and local browser smoke to `/bookings?tab=checkouts&status=PENDING_PICKUP` redirecting cleanly to login when unauthenticated.
- Deferred: PENDING_PICKUP auto-expiry remains GAP-33 and is intentionally not part of this ship pass.
