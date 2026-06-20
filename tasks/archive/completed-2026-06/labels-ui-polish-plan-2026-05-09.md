# Labels UI Polish - 2026-05-09

## Goal
- Make `/labels` feel like an intentional print queue for selected gear labels while preserving the existing browser-print output.

## Peer patterns checked
- `/licenses`: compact metric strip, icon-only utilities, and action-forward header rhythm.
- `/guides`: simple search and filtered-empty recovery.
- `/search`: direct search surface with clear state handling.

## Plan
- [x] Structure: Add header description, queue metrics, and a clearer selector/preview split.
- [x] UX: Preserve URL preselection, improve select/clear behavior, add filtered-empty copy, and keep print disabled until the queue has items.
- [x] UI: Use shadcn primitives, explicit icon actions, tabular counts, and stronger selected-row treatment.
- [x] Consistency: Keep tag-first asset identity and avoid changing `/api/assets` contracts or print CSS.
- [x] Hardening: Avoid nested interactive row controls and keep checkbox labels accessible.
- [x] Verification: Run TypeScript, migration-prefix, whitespace, build, and browser smoke on `/labels`.
- [x] Docs: Sync Items area and task queue.

## Propagation candidates
- [ ] `/bulk-inventory`: consider this compact metric-plus-queue rhythm for numbered-unit batch actions later.

## Review
- Shipped: `/labels` now has queue metrics, a clearer search/selection toolbar, checkbox-owned selection rows, item-detail escape links, filtered-empty recovery, and singular/plural print labeling while preserving the existing print grid.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome DevTools smoke on `/labels` passed. Browser smoke caught and fixed one nested-interactive row issue and one missing search input `id`/`name`.
- Deferred: No API or print CSS changes; physical label-stock validation still belongs to a real print test.
