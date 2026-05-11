# Items Hygiene Ownership Pass - 2026-05-10

## Goal
- Make `/items/hygiene` feel like a focused admin cleanup queue: clear priority, clean repair links, resilient refresh behavior, and visible fallback state without adding new mutation paths.

## Peer patterns checked
- `/items`: tag-first item identity, compact health metrics, direct repair routes, and recovery states.
- `/bulk-inventory/batteries`: operator-first metric cards, clear exception rows, and refresh feedback.
- `/settings/departments`: admin catalog rhythm with lightweight tables, action grouping, and toast-backed retries.

## Plan
- [x] Structure
- [x] UX
- [x] UI
- [x] Consistency
- [x] Hardening
- [x] Verification
- [x] Docs

## Propagation candidates
- [ ] Future Admin Fix Today queue: reuse the issue queue, progress, partial-failure warning, and sample-row pattern if it stays read-only.

## Review
- Shipped: `/items/hygiene` now has priority sorting, top cleanup summary, progress health card, needs-work/all/clean views, partial-failure warning state, refresh toast feedback, stronger sample rows, and tag-first API sample labels.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome DevTools smoke on `http://localhost:3002/items/hygiene` passed. Browser smoke covered needs-work/all/clean filters, refresh toast, desktop and mobile viewport snapshots, no console warnings/errors, `GET /api/inventory-hygiene` 200 responses, no horizontal overflow, and no undersized new main-content targets.
- Deferred: No new mutation or auto-fix path was added. Repair still launches existing item, kit, and bulk surfaces.
