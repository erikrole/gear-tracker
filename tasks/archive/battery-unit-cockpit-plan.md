# Battery Unit Cockpit Plan

Last updated: 2026-05-06

## Goal

Make numbered battery operations easier for admins and staff without changing the core data model:

- Batteries remain numbered bulk SKUs.
- Booking creation remains quantity-based.
- Kiosk pickup/check-in continues to bind exact unit numbers by scan.
- Full battery reporting stays deferred until the operational view is easier to run.

## Slice 1 — Cross-SKU Battery Cockpit

- [x] Add a read API for numbered battery SKUs with unit counts, checked-out unit context, and low-stock signals.
- [x] Add `/bulk-inventory/batteries` as an admin/staff operational page.
- [x] Surface available, checked out, lost, and retired counts per SKU.
- [x] Surface checked-out unit aging with requester and booking context.
- [x] Add obvious quick actions for available/lost/retired transitions using the existing audited unit status endpoint.
- [x] Add an Admin nav entry so the page is discoverable.
- [x] Verify TypeScript, migration-prefix health, whitespace, and local Next build.

## Out of Scope

- New schema fields.
- Exact-unit selection at booking creation.
- Battery loss reports and trend charts.
- Camera attachment schema changes.

## Review

Shipped 2026-05-06. Added `/bulk-inventory/batteries`, `GET /api/bulk-skus/batteries`, and an Admin nav entry. The page gives admins/staff a cross-SKU cockpit for active numbered battery SKUs with low-stock signals, checked-out aging, booking/requester context, and direct audited unit status actions. Verification passed with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.
