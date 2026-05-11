# Kits Ownership Pass - 2026-05-10

## Goal
- Make `/kits` feel like a current operational list page: clear counts, shareable filters, accurate kit contents, accessible navigation, and a create flow that explains validation problems.

## Peer patterns checked
- `/labels`: metric strip above the queue, explicit search identifiers, filtered-empty recovery, and real item links.
- `/settings/departments`: compact admin catalog rhythm with immediate mutation feedback and simple controls.
- `/items/hygiene`: workflow summary, filter recovery, and stronger row/card hierarchy for operators.

## Plan
- [x] Structure
- [x] UX
- [x] UI
- [x] Consistency
- [x] Hardening
- [x] Verification
- [x] Docs

## Propagation candidates
- [ ] Kit detail: evaluate whether bulk member add/remove should adopt the same count and validation language in a later pass.
- [ ] Other catalog lists: keep search URL state and clear-filter behavior consistent when touching older lists.

## Review
- Shipped: `/kits` now has summary metrics, URL-backed search/sort/filter state, a stronger toolbar, real detail links, clearer desktop/mobile rows, bulk-aware content counts/status, description search, single-toast create success, and visible New Kit validation.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/app/(app)/kits/page.tsx src/app/(app)/kits/new-kit-sheet.tsx src/app/(app)/kits/hooks/use-kits-query.ts src/lib/services/kits.ts docs/AREA_KITS.md tasks/archive/kits-ownership-pass.md tasks/todo.md`, `npx next build`, and authenticated Chrome DevTools smoke on `http://localhost:3002/kits` across desktop and mobile.
- Deferred: Kit detail add/remove composition polish stays out of this list-page pass.
