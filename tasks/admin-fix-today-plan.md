# Admin Fix Today Queue - 2026-05-13

## Goal
- Give admins one read-only daily action queue for operational issues that otherwise require checking separate pages.
- Keep the first slice admin-only, resilient, and linked to existing repair surfaces instead of adding new mutation paths.

## Peer patterns checked
- `/items/hygiene`: read-only cleanup queue, priority ordering, partial failure metadata, direct repair links.
- `/settings`: role-aware control-center framing and compact admin cards.
- Dashboard area docs: daily operations should be action-first, not chart-first.

## Plan
- [x] Structure: add a dedicated `/admin/fix-today` page and sidebar entry.
- [x] API/service: add `GET /api/admin/fix-today` with `ADMIN` role enforcement.
- [x] UI: render grouped queue cards with counts, samples, refresh, empty, error, and partial-failure states.
- [x] Consistency: link each queue item to the existing owning page instead of adding bespoke fixes.
- [x] Hardening: use bounded queries and partial-failure fallbacks.
- [x] Verification: run typecheck, migration prefix check, route tests, diff check, and app build.
- [x] Docs: update dashboard/system docs and active backlog.

## Propagation candidates
- [ ] `/items/hygiene`: consider reusing queue-card primitives later if the admin queue becomes broader.
- [ ] Settings pages: consider linking this page from the control center after admin usage proves it belongs there.

## Review
- Shipped: `/admin/fix-today`, `GET /api/admin/fix-today`, and a true admin-only sidebar entry. The queue covers overdue gear, pending pickup handoffs, offline kiosks, flagged maintenance items, low battery families, calendar sync failures, and expiring licenses.
- Verified: `npx vitest run tests/admin-fix-today-route.test.ts`, `npm run db:migrate:check`, `git diff --check`, `npx prisma validate`, `npx tsc --noEmit`, and `npx next build`.
- Deferred: mutation shortcuts and digest notifications. This first slice stays read-only and links to existing repair surfaces.
